import { error, type RequestHandler } from '@sveltejs/kit';
import { findIdentity } from '$lib/server/identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit } from '$lib/server/request.js';

export const DELETE: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'delete-owned-map', user.userId, 60, 10 * 60 * 1000);
		const mapId = requireUuid(event.params.mapId ?? null, '내 지도 ID');
		const result = await getPostgresPool().query(
			`DELETE FROM ${tableName('owned_maps')} WHERE id = $1 AND owner_id = $2 RETURNING id`,
			[mapId, user.userId]
		);
		if (result.rowCount !== 1) throw error(404, '내 지도를 찾을 수 없습니다.');
		return jsonResponse({ deleted: true }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/my/maps/[mapId] DELETE');
	}
};
