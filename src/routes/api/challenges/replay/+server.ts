import { error, type RequestHandler } from '@sveltejs/kit';
import { normalizeReplay } from '$lib/game/replay.js';
import { CHALLENGE_STAGE_MAX, CHALLENGE_STAGE_MIN, isChallengeStage } from '$lib/game/stages/challenge.js';
import { findIdentity } from '$lib/server/identity.js';
import { verifyAndStoreStageReplay } from '$lib/server/player-progress.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';

interface ReplayBody {
	replay?: unknown;
}

interface ChallengeScoreRow {
	nickname: string;
	stars: string | number;
	clear_time_ms: number;
	ink_ratio: number;
	verified_at: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		const stageId = parseStageId(event.url.searchParams.get('stageId'));
		await ensurePostgresSchema();
		await enforceRateLimit(event, 'get-challenge-leaderboard', undefined, 60, 60 * 1000);
		const result = await getPostgresPool().query<ChallengeScoreRow>(
			`SELECT u.nickname, s.stars, s.clear_time_ms, s.ink_ratio, s.verified_at
			 FROM ${tableName('stage_scores')} s
			 JOIN ${tableName('users')} u ON u.id = s.user_id
			 WHERE s.stage_id = $1
			 ORDER BY s.stars DESC, s.clear_time_ms ASC, s.ink_ratio DESC, s.verified_at ASC
			 LIMIT 20`,
			[stageId]
		);
		return jsonResponse(
			{
				stageId,
				entries: result.rows.map((row) => ({
					nickname: row.nickname,
					stars: Number(row.stars),
					clearTimeMs: row.clear_time_ms,
					inkRatio: Number(row.ink_ratio),
					verifiedAt: row.verified_at.toISOString()
				}))
			},
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/challenges/replay GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'submit-challenge-replay', user.userId, 20, 10 * 60 * 1000);
		const body = await readJson<ReplayBody>(event);
		let replay;
		try {
			replay = normalizeReplay(body.replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 형식이 올바르지 않습니다.');
		}
		if (!isChallengeStage(replay.stageId)) throw error(400, `시드 도전은 ${CHALLENGE_STAGE_MIN}~${CHALLENGE_STAGE_MAX}단계입니다.`);
		return jsonResponse(await verifyAndStoreStageReplay(user, replay), { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/challenges/replay POST');
	}
};

function parseStageId(value: string | null): number {
	const stageId = Number(value);
	if (!Number.isInteger(stageId) || !isChallengeStage(stageId)) throw error(400, `시드 도전은 ${CHALLENGE_STAGE_MIN}~${CHALLENGE_STAGE_MAX}단계입니다.`);
	return stageId;
}
