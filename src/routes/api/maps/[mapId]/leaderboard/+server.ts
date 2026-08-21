import { error, type RequestHandler } from '@sveltejs/kit';
import type { StageMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { createStageDataFromMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { normalizeReplay } from '$lib/game/replay.js';
import { findIdentity } from '$lib/server/identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { verifyStageReplay } from '$lib/server/replay-simulator.js';

interface MapScoreBody {
	replay?: unknown;
}

interface MapScoreRow {
	nickname: string;
	stars: string | number;
	clear_time_ms: number;
	ink_ratio: number;
	hint_views: number;
	updated_at: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		const mapId = requireUuid(event.params.mapId ?? null, '지도 ID');
		await ensurePostgresSchema();
		await enforceRateLimit(event, 'get-map-leaderboard', undefined, 60, 60 * 1000);
		const rawLimit = Number(event.url.searchParams.get('limit') ?? 20);
		const limit = Number.isInteger(rawLimit) ? Math.min(20, Math.max(1, rawLimit)) : 20;
		const result = await getPostgresPool().query<MapScoreRow>(
			`SELECT nickname, stars, clear_time_ms, ink_ratio, hint_views, updated_at
			 FROM ${tableName('map_scores')} WHERE map_id = $1
			 ORDER BY stars DESC, clear_time_ms ASC, ink_ratio DESC, updated_at ASC LIMIT $2`,
			[mapId, limit]
		);
		return jsonResponse(
			{
				entries: result.rows.map((row) => ({
					nickname: row.nickname,
					stars: Number(row.stars),
					clearTimeMs: row.clear_time_ms,
					inkRatio: Number(row.ink_ratio),
					hintViews: row.hint_views,
					updatedAt: row.updated_at.toISOString()
				}))
			},
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps/[mapId]/leaderboard GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const mapId = requireUuid(event.params.mapId ?? null, '지도 ID');
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'submit-map-score', user.userId, 10, 10 * 60 * 1000);
		const mapResult = await getPostgresPool().query<{ document: StageMapDocument }>(
			`SELECT document FROM ${tableName('published_maps')} WHERE id = $1 LIMIT 1`,
			[mapId]
		);
		const map = mapResult.rows[0];
		if (!map) throw error(404, '온라인 지도를 찾을 수 없습니다.');
		const body = await readJson<MapScoreBody>(event);
		let replay;
		try {
			replay = normalizeReplay(body.replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 형식이 올바르지 않습니다.');
		}
		let result;
		try {
			result = verifyStageReplay(createStageDataFromMapDocument(map.document), replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 검증에 실패했습니다.');
		}
		if (result.status === 'failed' || !result.score) {
			return jsonResponse({ accepted: false, status: result.status, reason: result.reason, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio }, { 'cache-control': 'no-store' });
		}

		const stored = await getPostgresPool().query(
			`INSERT INTO ${tableName('map_scores')} AS current
				(map_id, user_id, nickname, stars, clear_time_ms, ink_ratio)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (map_id, user_id) DO UPDATE SET
				nickname = EXCLUDED.nickname,
				stars = EXCLUDED.stars,
				clear_time_ms = EXCLUDED.clear_time_ms,
				ink_ratio = EXCLUDED.ink_ratio,
				verified_at = now(),
				updated_at = now()
			 WHERE EXCLUDED.stars > current.stars
				OR (EXCLUDED.stars = current.stars AND EXCLUDED.clear_time_ms < current.clear_time_ms)
				OR (EXCLUDED.stars = current.stars AND EXCLUDED.clear_time_ms = current.clear_time_ms AND EXCLUDED.ink_ratio > current.ink_ratio)
			 RETURNING map_id`,
			[mapId, user.userId, user.nickname, result.score.stars, result.clearTimeMs, result.inkRatio]
		);
		return jsonResponse({ accepted: stored.rowCount === 1, status: result.status, score: result.score, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps/[mapId]/leaderboard POST');
	}
};
