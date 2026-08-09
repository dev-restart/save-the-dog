import { error, type RequestHandler } from '@sveltejs/kit';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { findIdentity } from '$lib/server/identity.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { mapCollection } from '$lib/server/online-maps.js';
import { createStageDataFromMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { normalizeReplay } from '$lib/game/replay.js';
import { verifyStageReplay } from '$lib/server/replay-simulator.js';

interface MapScoreBody {
	replay?: unknown;
}

interface MapScoreRecord {
	_id: string;
	mapId: string;
	userId: string;
	nickname: string;
	stars: number;
	clearTimeMs: number | null;
	inkRatio: number | null;
	hintViews: number;
	verifiedAt: Date;
	updatedAt: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		const mapId = requireUuid(event.params.mapId ?? null, '지도 ID');
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		await enforceRateLimit(db, event, 'get-map-leaderboard', undefined, 60, 60 * 1000);
		const limitParam = Number(event.url.searchParams.get('limit') ?? 20);
		const limit = Number.isInteger(limitParam) ? Math.min(20, Math.max(1, limitParam)) : 20;
		const rows = await db.collection<MapScoreRecord>('map_scores')
			.find({ mapId, verifiedAt: { $exists: true } }, { projection: { _id: 0, userId: 0, mapId: 0 } })
			.sort({ stars: -1, clearTimeMs: 1, updatedAt: 1 })
			.limit(limit)
			.toArray();
		return jsonResponse(
			{ entries: rows.map((row) => ({ nickname: row.nickname, stars: row.stars, clearTimeMs: row.clearTimeMs, inkRatio: row.inkRatio, hintViews: row.hintViews, updatedAt: row.updatedAt.toISOString() })) },
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
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		const user = await findIdentity(db, event);
		if (!user) throw error(401, '닉네임을 먼저 만들어야 합니다.');
		await enforceRateLimit(db, event, 'submit-map-score', user.userId, 5, 60 * 1000);
		const map = await mapCollection(db).findOne({ _id: mapId });
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

		const scores = db.collection<MapScoreRecord>('map_scores');
		const id = `${mapId}:${user.userId}`;
		const existing = await scores.findOne({ _id: id });
		const better = !existing || result.score.stars > existing.stars || (result.score.stars === existing.stars && (result.clearTimeMs < (existing.clearTimeMs ?? Number.POSITIVE_INFINITY) || (result.clearTimeMs === existing.clearTimeMs && result.inkRatio > (existing.inkRatio ?? 0))));
		if (better) {
			await scores.updateOne(
				{ _id: id },
				{ $set: { mapId, userId: user.userId, nickname: user.nickname, stars: result.score.stars, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio, hintViews: 0, verifiedAt: new Date(), updatedAt: new Date() } as never },
				{ upsert: true }
			);
		}
		return jsonResponse({ accepted: better, status: result.status, score: result.score, clearTimeMs: result.clearTimeMs, inkRatio: result.inkRatio }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps/[mapId]/leaderboard POST');
	}
};
