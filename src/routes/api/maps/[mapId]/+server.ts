import { error, type RequestHandler } from '@sveltejs/kit';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { requireUuid, jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { enforceRateLimit } from '$lib/server/request.js';
import { mapCollection, toOnlineMapSummary } from '$lib/server/online-maps.js';

export const GET: RequestHandler = async (event) => {
	try {
		const mapId = requireUuid(event.params.mapId ?? null, '지도 ID');
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		await enforceRateLimit(db, event, 'get-map', undefined, 60, 60 * 1000);
		const maps = mapCollection(db);
		const record = await maps.findOne({ _id: mapId });
		if (!record) throw error(404, '온라인 지도를 찾을 수 없습니다.');
		await maps.updateOne({ _id: mapId }, { $inc: { downloadCount: 1 } });
		return jsonResponse(
			{ ...toOnlineMapSummary(record), document: record.document },
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps/[mapId] GET');
	}
};
