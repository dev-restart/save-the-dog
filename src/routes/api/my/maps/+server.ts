import { randomUUID } from 'node:crypto';
import { error, type RequestHandler } from '@sveltejs/kit';
import type { StageMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { findIdentity } from '$lib/server/identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { hashMapDocument, normalizeOnlineMapDocument } from '$lib/server/online-maps.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';

const OWNED_MAP_LIMIT = 30;

interface SaveOwnedMapBody {
	mapId?: unknown;
	document?: unknown;
	sourceOnlineMapId?: unknown;
}

interface OwnedMapRow {
	id: string;
	title: string;
	document: StageMapDocument;
	source_online_map_id: string | null;
	published_map_id: string | null;
	created_at: Date;
	updated_at: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		const result = await getPostgresPool().query<OwnedMapRow>(
			`SELECT id, title, document, source_online_map_id, published_map_id, created_at, updated_at
			 FROM ${tableName('owned_maps')} WHERE owner_id = $1 ORDER BY updated_at DESC`,
			[user.userId]
		);
		return jsonResponse({ maps: result.rows.map(toOwnedMap) }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/my/maps GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'save-owned-map', user.userId, 60, 10 * 60 * 1000);
		const body = await readJson<SaveOwnedMapBody>(event);
		const document = normalizeOnlineMapDocument(body.document);
		const requestedMapId = body.mapId === undefined ? undefined : requireUuid(typeof body.mapId === 'string' ? body.mapId : null, '내 지도 ID');
		const sourceOnlineMapId = body.sourceOnlineMapId === undefined || body.sourceOnlineMapId === null
			? null
			: requireUuid(typeof body.sourceOnlineMapId === 'string' ? body.sourceOnlineMapId : null, '원본 지도 ID');
		const pool = getPostgresPool();

		if (requestedMapId) {
			const updated = await pool.query<OwnedMapRow>(
				`UPDATE ${tableName('owned_maps')}
				 SET title = $3, document = $4, content_hash = $5, source_online_map_id = coalesce($6, source_online_map_id), updated_at = now()
				 WHERE id = $1 AND owner_id = $2
				 RETURNING id, title, document, source_online_map_id, published_map_id, created_at, updated_at`,
				[requestedMapId, user.userId, document.title, document, hashMapDocument(document), sourceOnlineMapId]
			);
			if (!updated.rows[0]) throw error(404, '내 지도를 찾을 수 없습니다.');
			return jsonResponse(toOwnedMap(updated.rows[0]), { 'cache-control': 'no-store' });
		}

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`owned-maps:${user.userId}`]);
			const count = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM ${tableName('owned_maps')} WHERE owner_id = $1`, [user.userId]);
			if ((count.rows[0]?.count ?? 0) >= OWNED_MAP_LIMIT) throw error(409, `내 지도는 최대 ${OWNED_MAP_LIMIT}개까지 저장할 수 있습니다.`);
			const mapId = randomUUID();
			const inserted = await client.query<OwnedMapRow>(
				`INSERT INTO ${tableName('owned_maps')} (id, owner_id, title, document, content_hash, source_online_map_id)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING id, title, document, source_online_map_id, published_map_id, created_at, updated_at`,
				[mapId, user.userId, document.title, document, hashMapDocument(document), sourceOnlineMapId]
			);
			await client.query('COMMIT');
			return jsonResponse(toOwnedMap(inserted.rows[0]!), { 'cache-control': 'no-store' });
		} catch (cause) {
			await client.query('ROLLBACK');
			throw cause;
		} finally {
			client.release();
		}
	} catch (cause) {
		return rethrowApiError(cause, 'api/my/maps POST');
	}
};

function toOwnedMap(row: OwnedMapRow) {
	return {
		id: row.id,
		title: row.title,
		document: row.document,
		createdAt: row.created_at.getTime(),
		updatedAt: row.updated_at.getTime(),
		onlineMapId: row.published_map_id ?? undefined,
		sourceOnlineMapId: row.source_online_map_id ?? undefined
	};
}
