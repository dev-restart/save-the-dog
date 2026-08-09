import { error, type RequestHandler } from '@sveltejs/kit';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { findIdentity } from '$lib/server/identity.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';

interface PlayerRecord {
	_id: string;
	userId: string;
	nickname: string;
	highestStage: number;
	totalStars: number;
	totalClears: number;
	updatedAt: Date;
}

interface PlayerRecordBody {
	highestStage?: unknown;
	totalStars?: unknown;
	totalClears?: unknown;
}

export const GET: RequestHandler = async (event) => {
	try {
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		await enforceRateLimit(db, event, 'get-player-leaderboard', undefined, 60, 60 * 1000);
		const rows = await db.collection<PlayerRecord>('player_rankings')
			.find({}, { projection: { _id: 0, userId: 0 } })
			.sort({ highestStage: -1, totalStars: -1, totalClears: -1, updatedAt: 1 })
			.limit(20)
			.toArray();
		return jsonResponse(
			{ entries: rows.map((row) => ({ nickname: row.nickname, highestStage: row.highestStage, totalStars: row.totalStars, totalClears: row.totalClears, updatedAt: row.updatedAt.toISOString() })) },
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/leaderboard GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		const user = await findIdentity(db, event);
		if (!user) throw error(401, '닉네임을 먼저 만들어야 합니다.');
		await enforceRateLimit(db, event, 'submit-player-leaderboard', user.userId, 3, 10 * 60 * 1000);
		const body = await readJson<PlayerRecordBody>(event);
		const highestStage = finiteInteger(body.highestStage);
		const totalStars = finiteNumber(body.totalStars);
		const totalClears = finiteInteger(body.totalClears);
		if (highestStage === null || highestStage < 1 || highestStage > 10000) throw error(400, '최고 단계가 올바르지 않습니다.');
		if (totalStars === null || totalStars < 0 || totalStars > highestStage * 3) throw error(400, '별점 기록이 올바르지 않습니다.');
		if (totalClears === null || totalClears < 0 || totalClears > highestStage) throw error(400, '클리어 기록이 올바르지 않습니다.');

		const rankings = db.collection<PlayerRecord>('player_rankings');
		const existing = await rankings.findOne({ _id: user.userId });
		const better = !existing || highestStage > existing.highestStage || (highestStage === existing.highestStage && (totalStars > existing.totalStars || (totalStars === existing.totalStars && totalClears > existing.totalClears)));
		if (better) {
			await rankings.updateOne(
				{ _id: user.userId },
				{ $set: { userId: user.userId, nickname: user.nickname, highestStage, totalStars, totalClears, updatedAt: new Date() } },
				{ upsert: true }
			);
		}
		return jsonResponse({ accepted: better }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/leaderboard POST');
	}
};

function finiteInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) ? value : null;
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 2) / 2 : null;
}
