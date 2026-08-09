import { error, type RequestHandler } from '@sveltejs/kit';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { findIdentity } from '$lib/server/identity.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import {
	ONLINE_MAP_LIMIT,
	createOnlineMapRecord,
	decodeCursor,
	encodeCursor,
	hashMapDocument,
	mapCollection,
	normalizeOnlineMapDocument,
	toOnlineMapSummary
} from '$lib/server/online-maps.js';

interface PublishMapBody {
	document?: unknown;
	mapId?: unknown;
}

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		const user = await findIdentity(db, event);
		if (!user) throw error(401, '닉네임을 먼저 만들어야 합니다.');
		await enforceRateLimit(db, event, 'publish-map', user.userId, 10, 10 * 60 * 1000);

		const body = await readJson<PublishMapBody>(event);
		const document = normalizeOnlineMapDocument(body.document);
		const contentHash = hashMapDocument(document);
		const maps = mapCollection(db);
		const requestedMapId = body.mapId === undefined ? undefined : requireUuid(typeof body.mapId === 'string' ? body.mapId : null, '지도 ID');

		if (requestedMapId) {
			const existing = await maps.findOne({ _id: requestedMapId });
			if (!existing) throw error(404, '온라인 지도를 찾을 수 없습니다.');
			if (existing.ownerId !== user.userId) throw error(403, '내가 만든 지도만 수정할 수 있습니다.');
			if (existing.contentHash !== contentHash) {
				await maps.updateOne(
					{ _id: requestedMapId, ownerId: user.userId },
					{ $set: { title: document.title, document, contentHash, ownerNickname: user.nickname, updatedAt: new Date() } }
				);
			}
			const updated = await maps.findOne({ _id: requestedMapId });
			if (!updated) throw error(404, '온라인 지도를 찾을 수 없습니다.');
			return jsonResponse(toOnlineMapSummary(updated), { 'cache-control': 'no-store' });
		}

		const duplicate = await maps.findOne({ ownerId: user.userId, contentHash });
		if (duplicate) return jsonResponse(toOnlineMapSummary(duplicate), { 'cache-control': 'no-store' });

		const publishedCount = await maps.countDocuments({ ownerId: user.userId });
		if (publishedCount >= ONLINE_MAP_LIMIT) {
			throw error(409, `온라인 공유는 1인당 최대 ${ONLINE_MAP_LIMIT}개까지 가능합니다.`);
		}

		const record = createOnlineMapRecord(user.userId, user.nickname, document);
		try {
			await maps.insertOne(record);
		} catch (cause) {
			if (!isDuplicateKeyError(cause)) throw cause;
			const concurrentDuplicate = await maps.findOne({ ownerId: user.userId, contentHash });
			if (concurrentDuplicate) return jsonResponse(toOnlineMapSummary(concurrentDuplicate), { 'cache-control': 'no-store' });
			throw cause;
		}
		return jsonResponse(toOnlineMapSummary(record), { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps POST');
	}
};

function isDuplicateKeyError(cause: unknown): boolean {
	return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}

export const GET: RequestHandler = async (event) => {
	try {
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		await enforceRateLimit(db, event, 'list-maps', undefined, 60, 60 * 1000);
		const rawLimit = Number(event.url.searchParams.get('limit') ?? 12);
		const limit = Number.isInteger(rawLimit) ? Math.min(20, Math.max(1, rawLimit)) : 12;
		const cursor = decodeCursor(event.url.searchParams.get('cursor'));
		const filter = cursor
			? {
				$or: [
					{ createdAt: { $lt: new Date(cursor.createdAt) } },
					{ createdAt: new Date(cursor.createdAt), _id: { $lt: cursor.mapId } }
				]
			}
			: {};
		const records = await mapCollection(db).find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
		const hasMore = records.length > limit;
		const visible = hasMore ? records.slice(0, limit) : records;
		const last = visible.at(-1);
		const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), mapId: last._id }) : null;
		return jsonResponse(
			{ maps: visible.map(toOnlineMapSummary), nextCursor },
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps GET');
	}
};
