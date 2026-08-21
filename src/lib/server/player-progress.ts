import { createHash } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import type { StageReplay } from '$lib/game/replay.js';
import type { StageScore } from '$lib/game/scoring.js';
import { getStage } from '$lib/game/stages/index.js';
import { CHALLENGE_STAGE_MAX } from '$lib/game/stages/challenge.js';
import { verifyStageReplay } from './replay-simulator.js';
import type { UserIdentity } from './identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from './postgres.js';

export interface PublicPlayerProgress {
	highestStage: number;
	lastPlayedStage: number;
	totalClears: number;
	totalStars: number;
	stageStars: Record<string, number>;
	version: 1;
}

export interface ProgressSyncPayload {
	lastPlayedStage: number;
	version: 1;
}

export interface StoredReplayResult {
	accepted: boolean;
	status: 'cleared' | 'failed';
	reason?: string;
	clearTimeMs: number;
	inkRatio: number;
	score?: StageScore;
	progress?: PublicPlayerProgress;
}

interface ProgressRow {
	highest_stage: number;
	last_played_stage: number;
	total_unique_clears: number;
	total_stars: string | number;
	stage_stars: Record<string, number>;
}

interface ProgressAggregate {
	stageStars: Record<string, number>;
	maxClearedStage: number;
	storedLastPlayedStage: number;
}

export async function getPlayerProgress(userId: string): Promise<PublicPlayerProgress> {
	await ensurePostgresSchema();
	const pool = getPostgresPool();
	await pool.query(`INSERT INTO ${tableName('player_progress')} (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
	return syncStoredProgress(userId);
}

export async function mergePlayerProgress(userId: string, incoming: ProgressSyncPayload): Promise<PublicPlayerProgress> {
	await ensurePostgresSchema();
	const pool = getPostgresPool();
	await pool.query(`INSERT INTO ${tableName('player_progress')} (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
	return syncStoredProgress(userId, incoming.lastPlayedStage);
}

export function normalizePlayerProgress(value: unknown): ProgressSyncPayload {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw error(400, '진행 기록 형식이 올바르지 않습니다.');
	const raw = value as Partial<PublicPlayerProgress>;
	return {
		lastPlayedStage: Math.min(CHALLENGE_STAGE_MAX, Math.max(1, Math.floor(Number(raw.lastPlayedStage) || 1))),
		version: 1
	};
}

export async function verifyAndStoreStageReplay(user: UserIdentity, replay: StageReplay): Promise<StoredReplayResult> {
	const currentProgress = await getPlayerProgress(user.userId);
	if (replay.stageId < 1 || replay.stageId > CHALLENGE_STAGE_MAX) throw error(400, '지원하지 않는 단계입니다.');
	if (replay.stageId > currentProgress.highestStage) throw error(403, '아직 열리지 않은 단계입니다.');

	const stage = getStage(replay.stageId);
	const result = verifyStageReplay(stage, replay);
	if (result.status === 'failed' || !result.score) {
		return {
			accepted: false,
			status: result.status,
			reason: result.reason,
			clearTimeMs: result.clearTimeMs,
			inkRatio: result.inkRatio
		};
	}

	const pool = getPostgresPool();
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const accepted = await upsertBestStageScore(client, user.userId, replay, result.score, result.clearTimeMs, result.inkRatio);
		const progress = await rebuildProgress(client, user.userId, replay.stageId + 1);
		await client.query('COMMIT');
		return {
			accepted,
			status: 'cleared',
			clearTimeMs: result.clearTimeMs,
			inkRatio: result.inkRatio,
			score: result.score,
			progress
		};
	} catch (cause) {
		await client.query('ROLLBACK');
		throw cause;
	} finally {
		client.release();
	}
}

async function upsertBestStageScore(
	client: PoolClient,
	userId: string,
	replay: StageReplay,
	score: StageScore,
	clearTimeMs: number,
	inkRatio: number
): Promise<boolean> {
	const replayHash = createHash('sha256').update(JSON.stringify(replay)).digest('hex');
	const result = await client.query(
		`INSERT INTO ${tableName('stage_scores')} AS current
			(user_id, stage_id, seed, stars, clear_time_ms, ink_ratio, replay_hash)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (user_id, stage_id) DO UPDATE SET
			seed = EXCLUDED.seed,
			stars = EXCLUDED.stars,
			clear_time_ms = EXCLUDED.clear_time_ms,
			ink_ratio = EXCLUDED.ink_ratio,
			replay_hash = EXCLUDED.replay_hash,
			verified_at = now()
		 WHERE EXCLUDED.stars > current.stars
			OR (EXCLUDED.stars = current.stars AND EXCLUDED.clear_time_ms < current.clear_time_ms)
			OR (EXCLUDED.stars = current.stars AND EXCLUDED.clear_time_ms = current.clear_time_ms AND EXCLUDED.ink_ratio > current.ink_ratio)
		 RETURNING user_id`,
		[userId, replay.stageId, replay.seed ?? null, score.stars, Math.round(clearTimeMs), inkRatio, replayHash]
	);
	return result.rowCount === 1;
}

async function rebuildProgress(client: PoolClient, userId: string, preferredLastPlayedStage: number): Promise<PublicPlayerProgress> {
	const existingResult = await client.query<ProgressRow>(
		`SELECT highest_stage, last_played_stage, total_unique_clears, total_stars, stage_stars
		 FROM ${tableName('player_progress')} WHERE user_id = $1 FOR UPDATE`,
		[userId]
	);
	const existing = existingResult.rows[0];
	const summary = await client.query<{
		total_unique_clears: number;
		total_stars: string | number;
		stage_stars: Record<string, number>;
		max_stage: number;
	}>(
		`SELECT
			count(*)::integer AS total_unique_clears,
			coalesce(sum(stars), 0) AS total_stars,
			coalesce(jsonb_object_agg(stage_id::text, stars ORDER BY stage_id), '{}'::jsonb) AS stage_stars,
			coalesce(max(stage_id), 0)::integer AS max_stage
		 FROM ${tableName('stage_scores')}
		 WHERE user_id = $1`,
		[userId]
	);
	const aggregate = summary.rows[0];
	if (!aggregate) throw new Error('진행도 집계에 실패했습니다.');
	const progress = buildAuthoritativeProgress(
		{
			stageStars: aggregate.stage_stars ?? {},
			maxClearedStage: aggregate.max_stage,
			storedLastPlayedStage: existing?.last_played_stage ?? 1
		},
		preferredLastPlayedStage
	);
	const updated = await client.query<ProgressRow>(
		`UPDATE ${tableName('player_progress')}
		 SET highest_stage = $2,
			last_played_stage = $3,
			total_unique_clears = $4,
			total_stars = $5,
			stage_stars = $6,
			updated_at = now()
		 WHERE user_id = $1
		 RETURNING highest_stage, last_played_stage, total_unique_clears, total_stars, stage_stars`,
		[userId, progress.highestStage, progress.lastPlayedStage, progress.totalClears, progress.totalStars, progress.stageStars]
	);
	const row = updated.rows[0];
	if (!row) throw new Error('진행도 저장에 실패했습니다.');
	return toPublicProgress(row);
}

export function buildAuthoritativeProgress(
	aggregate: ProgressAggregate,
	preferredLastPlayedStage = aggregate.storedLastPlayedStage
): PublicPlayerProgress {
	const stageStars = Object.fromEntries(
		Object.entries(aggregate.stageStars ?? {}).map(([stageId, stars]) => [stageId, Number(stars)])
	);
	const clearedStages = new Set(
		Object.entries(stageStars)
			.filter(([, stars]) => Number(stars) > 0)
			.map(([stageId]) => Number(stageId))
			.filter((stageId) => Number.isInteger(stageId) && stageId >= 1 && stageId <= CHALLENGE_STAGE_MAX)
	);
	let contiguousClearedStage = 0;
	while (clearedStages.has(contiguousClearedStage + 1)) {
		contiguousClearedStage += 1;
	}
	const highestStage = Math.min(
		CHALLENGE_STAGE_MAX,
		Math.max(1, contiguousClearedStage + 1)
	);
	const lastPlayedStage = Math.min(
		highestStage,
		Math.max(1, Math.floor(Number(preferredLastPlayedStage) || 1))
	);
	const totalClears = Object.values(stageStars).filter((stars) => stars > 0).length;
	const totalStars = Object.values(stageStars).reduce((sum, stars) => sum + stars, 0);
	return {
		highestStage,
		lastPlayedStage,
		totalClears,
		totalStars,
		stageStars,
		version: 1
	};
}

function toPublicProgress(row: ProgressRow): PublicPlayerProgress {
	return {
		highestStage: row.highest_stage,
		lastPlayedStage: row.last_played_stage,
		totalClears: row.total_unique_clears,
		totalStars: Number(row.total_stars),
		stageStars: Object.fromEntries(Object.entries(row.stage_stars ?? {}).map(([stageId, stars]) => [stageId, Number(stars)])),
		version: 1
	};
}

async function syncStoredProgress(userId: string, preferredLastPlayedStage?: number): Promise<PublicPlayerProgress> {
	const pool = getPostgresPool();
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const existingResult = await client.query<ProgressRow>(
			`SELECT highest_stage, last_played_stage, total_unique_clears, total_stars, stage_stars
			 FROM ${tableName('player_progress')} WHERE user_id = $1 FOR UPDATE`,
			[userId]
		);
		const existing = existingResult.rows[0];
		if (!existing) throw new Error('플레이어 진행도를 생성하지 못했습니다.');
		const summary = await client.query<{
			stage_stars: Record<string, number>;
			max_stage: number;
		}>(
			`SELECT
				coalesce(jsonb_object_agg(stage_id::text, stars ORDER BY stage_id), '{}'::jsonb) AS stage_stars,
				coalesce(max(stage_id), 0)::integer AS max_stage
			 FROM ${tableName('stage_scores')}
			 WHERE user_id = $1`,
			[userId]
		);
		const aggregate = summary.rows[0];
		if (!aggregate) throw new Error('진행도 집계에 실패했습니다.');
		const progress = buildAuthoritativeProgress(
			{
				stageStars: aggregate.stage_stars ?? {},
				maxClearedStage: aggregate.max_stage,
				storedLastPlayedStage: existing.last_played_stage
			},
			preferredLastPlayedStage
		);
		const updated = await client.query<ProgressRow>(
			`UPDATE ${tableName('player_progress')}
			 SET highest_stage = $2,
				last_played_stage = $3,
				total_unique_clears = $4,
				total_stars = $5,
				stage_stars = $6,
				updated_at = now()
			 WHERE user_id = $1
			 RETURNING highest_stage, last_played_stage, total_unique_clears, total_stars, stage_stars`,
			[userId, progress.highestStage, progress.lastPlayedStage, progress.totalClears, progress.totalStars, progress.stageStars]
		);
		await client.query('COMMIT');
		const row = updated.rows[0];
		if (!row) throw new Error('진행도 저장에 실패했습니다.');
		return toPublicProgress(row);
	} catch (cause) {
		await client.query('ROLLBACK');
		throw cause;
	} finally {
		client.release();
	}
}
