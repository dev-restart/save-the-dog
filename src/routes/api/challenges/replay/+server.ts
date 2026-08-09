import { error, type RequestHandler } from '@sveltejs/kit';
import { getStage } from '$lib/game/stages/index.js';
import { CHALLENGE_STAGE_MAX, CHALLENGE_STAGE_MIN, getChallengeSeed, isChallengeStage } from '$lib/game/stages/challenge.js';
import { normalizeReplay } from '$lib/game/replay.js';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { findIdentity } from '$lib/server/identity.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { verifyStageReplay } from '$lib/server/replay-simulator.js';

interface ReplayBody {
	replay?: unknown;
}

interface ChallengeScoreRecord {
	_id: string;
	stageId: number;
	seed: string;
	userId: string;
	nickname: string;
	stars: number;
	clearTimeMs: number;
	inkRatio: number;
	verifiedAt: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		const stageId = parseStageId(event.url.searchParams.get('stageId'));
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		await enforceRateLimit(db, event, 'get-challenge-leaderboard', undefined, 60, 60 * 1000);
		const limitParam = Number(event.url.searchParams.get('limit') ?? 20);
		const limit = Number.isInteger(limitParam) ? Math.min(20, Math.max(1, limitParam)) : 20;
		const rows = await db.collection<ChallengeScoreRecord>('challenge_scores')
			.find({ stageId }, { projection: { _id: 0, userId: 0 } })
			.sort({ stars: -1, clearTimeMs: 1, inkRatio: -1, verifiedAt: 1 })
			.limit(limit)
			.toArray();
		return jsonResponse(
			{ stageId, seed: getChallengeSeed(stageId), entries: rows.map((row) => ({ nickname: row.nickname, stars: row.stars, clearTimeMs: row.clearTimeMs, inkRatio: row.inkRatio, verifiedAt: row.verifiedAt.toISOString() })) },
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/challenges/replay GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		const user = await findIdentity(db, event);
		if (!user) throw error(401, '닉네임을 먼저 만들어야 합니다.');
		await enforceRateLimit(db, event, 'submit-challenge-replay', user.userId, 5, 10 * 60 * 1000);

		const body = await readJson<ReplayBody>(event);
		let replay;
		try {
			replay = normalizeReplay(body.replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 형식이 올바르지 않습니다.');
		}
		if (!isChallengeStage(replay.stageId)) throw error(400, `시드 도전은 ${CHALLENGE_STAGE_MIN}~${CHALLENGE_STAGE_MAX}단계입니다.`);
		const expectedSeed = getChallengeSeed(replay.stageId);
		if (replay.seed !== expectedSeed) throw error(400, 'replay seed가 올바르지 않습니다.');

		let result;
		try {
			result = verifyStageReplay(getStage(replay.stageId), replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 검증에 실패했습니다.');
		}
		if (result.status === 'failed' || !result.score) {
			return jsonResponse({ accepted: false, status: result.status, reason: result.reason, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio }, { 'cache-control': 'no-store' });
		}

		const record: ChallengeScoreRecord = {
			_id: `${replay.stageId}:${user.userId}`,
			stageId: replay.stageId,
			seed: expectedSeed,
			userId: user.userId,
			nickname: user.nickname,
			stars: result.score.stars,
			clearTimeMs: result.clearTimeMs,
			inkRatio: result.inkRatio,
			verifiedAt: new Date()
		};
		const scores = db.collection<ChallengeScoreRecord>('challenge_scores');
		const existing = await scores.findOne({ _id: record._id });
		const better = !existing || record.stars > existing.stars || (record.stars === existing.stars && (record.clearTimeMs < existing.clearTimeMs || (record.clearTimeMs === existing.clearTimeMs && record.inkRatio > existing.inkRatio)));
		if (better) await scores.replaceOne({ _id: record._id }, record, { upsert: true });

		return jsonResponse({ accepted: better, status: result.status, score: result.score, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/challenges/replay POST');
	}
};

function parseStageId(value: string | null): number {
	const stageId = Number(value);
	if (!Number.isInteger(stageId) || !isChallengeStage(stageId)) throw error(400, `시드 도전은 ${CHALLENGE_STAGE_MIN}~${CHALLENGE_STAGE_MAX}단계입니다.`);
	return stageId;
}
