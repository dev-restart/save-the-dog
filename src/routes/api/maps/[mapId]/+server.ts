import { error, type RequestHandler } from '@sveltejs/kit';
import type { StageMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { requireUuid, jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { enforceRateLimit } from '$lib/server/request.js';

interface PublishedMapRow {
	id: string;
	owner_nickname: string;
	title: string;
	document: StageMapDocument;
	content_hash: string;
	created_at: Date;
	updated_at: Date;
	download_count: number;
}

export const GET: RequestHandler = async (event) => {
	try {
		const mapId = requireUuid(event.params.mapId ?? null, '지도 ID');
		await ensurePostgresSchema();
		await enforceRateLimit(event, 'get-map', undefined, 60, 60 * 1000);
		const result = await getPostgresPool().query<PublishedMapRow>(
			`SELECT id, owner_nickname, title, document, content_hash, created_at, updated_at, download_count
			 FROM ${tableName('published_maps')}
			 WHERE id = $1`,
			[mapId]
		);
		const row = result.rows[0];
		if (!row) throw error(404, '온라인 지도를 찾을 수 없습니다.');
		return jsonResponse(
			{
				mapId: row.id,
				title: row.title,
				authorNickname: row.owner_nickname,
				contentHash: row.content_hash,
				createdAt: row.created_at.toISOString(),
				updatedAt: row.updated_at.toISOString(),
				downloadCount: row.download_count,
				objectCount: row.document.objects.length,
				document: row.document
			},
			{ 'cache-control': 'no-store' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/maps/[mapId] GET');
	}
};
