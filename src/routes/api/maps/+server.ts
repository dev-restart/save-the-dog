import { randomUUID } from 'node:crypto';
import { error, type RequestHandler } from '@sveltejs/kit';
import { findIdentity } from '$lib/server/identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { jsonResponse, rethrowApiError, requireUuid } from '$lib/server/api.js';
import {
	ONLINE_MAP_LIMIT,
	decodeCursor,
	encodeCursor,
	hashMapDocument,
	normalizeOnlineMapDocument,
	toOnlineMapSummary,
	type OnlineMapRecord
} from '$lib/server/online-maps.js';
import type { StageMapDocument } from '$lib/game/stages/stage-map-schema.js';

interface PublishMapBody {
	document?: unknown;
	mapId?: unknown;
	ownerMapId?: unknown;
}

interface PublishedMapRow {
	id: string;
	owner_id: string;
	owner_map_id: string | null;
	owner_nickname: string;
	title: string;
	document: StageMapDocument;
	content_hash: string;
	created_at: Date;
	updated_at: Date;
	download_count: number;
}

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'publish-map', user.userId, 20, 10 * 60 * 1000);

		const body = await readJson<PublishMapBody>(event);
		const document = normalizeOnlineMapDocument(body.document);
		const contentHash = hashMapDocument(document);
		const requestedMapId = body.mapId === undefined ? undefined : requireUuid(typeof body.mapId === 'string' ? body.mapId : null, '지도 ID');
		const ownerMapId = body.ownerMapId === undefined ? null : requireUuid(typeof body.ownerMapId === 'string' ? body.ownerMapId : null, '내 지도 ID');
		const pool = getPostgresPool();

		if (ownerMapId) {
			const owned = await pool.query(`SELECT id FROM ${tableName('owned_maps')} WHERE id = $1 AND owner_id = $2`, [ownerMapId, user.userId]);
			if (owned.rowCount !== 1) throw error(404, '내 지도를 찾을 수 없습니다.');
		}

		if (requestedMapId) {
			const existing = await findPublishedMap(requestedMapId);
			if (!existing) throw error(404, '온라인 지도를 찾을 수 없습니다.');
			if (existing.ownerId !== user.userId) throw error(403, '내가 만든 지도만 수정할 수 있습니다.');
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				await client.query(
					`UPDATE ${tableName('published_maps')}
					 SET owner_map_id = $3, owner_nickname = $4, title = $5, document = $6, content_hash = $7, updated_at = now()
					 WHERE id = $1 AND owner_id = $2`,
					[requestedMapId, user.userId, ownerMapId, user.nickname, document.title, document, contentHash]
				);
				if (existing.contentHash !== contentHash) {
					await client.query(`DELETE FROM ${tableName('map_scores')} WHERE map_id = $1`, [requestedMapId]);
				}
				if (ownerMapId) {
					await client.query(
						`UPDATE ${tableName('owned_maps')} SET published_map_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`,
						[ownerMapId, user.userId, requestedMapId]
					);
				}
				await client.query('COMMIT');
			} catch (cause) {
				await client.query('ROLLBACK');
				throw cause;
			} finally {
				client.release();
			}
			const updated = await findPublishedMap(requestedMapId);
			if (!updated) throw error(404, '온라인 지도를 찾을 수 없습니다.');
			return jsonResponse(toOnlineMapSummary(updated), { 'cache-control': 'no-store' });
		}

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`published-maps:${user.userId}`]);
			const duplicateResult = await client.query<PublishedMapRow>(
				`SELECT * FROM ${tableName('published_maps')} WHERE owner_id = $1 AND content_hash = $2 LIMIT 1`,
				[user.userId, contentHash]
			);
			const duplicate = duplicateResult.rows[0];
			if (duplicate) {
				if (ownerMapId) {
					await client.query(
						`UPDATE ${tableName('owned_maps')} SET published_map_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`,
						[ownerMapId, user.userId, duplicate.id]
					);
				}
				await client.query('COMMIT');
				return jsonResponse(toOnlineMapSummary(fromRow(duplicate)), { 'cache-control': 'no-store' });
			}

			const count = await client.query<{ count: number }>(
				`SELECT count(*)::integer AS count FROM ${tableName('published_maps')} WHERE owner_id = $1`,
				[user.userId]
			);
			if ((count.rows[0]?.count ?? 0) >= ONLINE_MAP_LIMIT) throw error(409, `온라인 공유는 1인당 최대 ${ONLINE_MAP_LIMIT}개까지 가능합니다.`);

			const mapId = randomUUID();
			const inserted = await client.query<PublishedMapRow>(
				`INSERT INTO ${tableName('published_maps')}
					(id, owner_id, owner_map_id, owner_nickname, title, document, content_hash)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 RETURNING *`,
				[mapId, user.userId, ownerMapId, user.nickname, document.title, document, contentHash]
			);
			if (ownerMapId) {
				await client.query(
					`UPDATE ${tableName('owned_maps')} SET published_map_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`,
					[ownerMapId, user.userId, mapId]
				);
			}
			await client.query('COMMIT');
			const created = inserted.rows[0];
			if (!created) throw new Error('온라인 지도 저장에 실패했습니다.');
			return jsonResponse(toOnlineMapSummary(fromRow(created)), { 'cache-control': 'no-store' });
		} catch (cause) {
			await client.query('ROLLBACK');
			throw cause;
		} finally {
			client.release();
		}
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps POST');
	}
};

export const GET: RequestHandler = async (event) => {
	try {
		await ensurePostgresSchema();
		await enforceRateLimit(event, 'list-maps', undefined, 60, 60 * 1000);
		const rawLimit = Number(event.url.searchParams.get('limit') ?? 12);
		const limit = Number.isInteger(rawLimit) ? Math.min(20, Math.max(1, rawLimit)) : 12;
		const cursor = decodeCursor(event.url.searchParams.get('cursor'));
		const result = cursor
			? await getPostgresPool().query<PublishedMapRow>(
					`SELECT * FROM ${tableName('published_maps')}
					 WHERE (created_at, id) < ($1, $2)
					 ORDER BY created_at DESC, id DESC LIMIT $3`,
					[new Date(cursor.createdAt), cursor.mapId, limit + 1]
				)
			: await getPostgresPool().query<PublishedMapRow>(
					`SELECT * FROM ${tableName('published_maps')} ORDER BY created_at DESC, id DESC LIMIT $1`,
					[limit + 1]
				);
		const records = result.rows.map(fromRow);
		const hasMore = records.length > limit;
		const visible = hasMore ? records.slice(0, limit) : records;
		const last = visible.at(-1);
		return jsonResponse(
			{
				maps: visible.map(toOnlineMapSummary),
				nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), mapId: last.id }) : null
			},
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps GET');
	}
};

async function findPublishedMap(mapId: string): Promise<OnlineMapRecord | null> {
	const result = await getPostgresPool().query<PublishedMapRow>(`SELECT * FROM ${tableName('published_maps')} WHERE id = $1 LIMIT 1`, [mapId]);
	return result.rows[0] ? fromRow(result.rows[0]) : null;
}

function fromRow(row: PublishedMapRow): OnlineMapRecord {
	return {
		id: row.id,
		ownerId: row.owner_id,
		ownerMapId: row.owner_map_id,
		ownerNickname: row.owner_nickname,
		title: row.title,
		document: row.document,
		contentHash: row.content_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		downloadCount: row.download_count
	};
}
