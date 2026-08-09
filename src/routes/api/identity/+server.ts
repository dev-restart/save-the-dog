import { error, type RequestHandler } from '@sveltejs/kit';
import { ensureMongoIndexes, getMongoDatabase } from '$lib/server/mongodb.js';
import { createIdentity, findIdentity, NicknameConflictError, normalizeNickname } from '$lib/server/identity.js';
import { ensureSameOrigin, readJson } from '$lib/server/request.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';

interface IdentityBody {
	nickname?: unknown;
}

export const GET: RequestHandler = async (event) => {
	try {
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		const user = await findIdentity(db, event);
		return jsonResponse(user ? { registered: true, nickname: user.nickname } : { registered: false }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/identity GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const db = await getMongoDatabase();
		await ensureMongoIndexes(db);
		if (await findIdentity(db, event)) throw error(409, '닉네임은 처음 생성한 뒤 변경할 수 없습니다.');

		const body = await readJson<IdentityBody>(event);
		if (body.nickname !== undefined && typeof body.nickname !== 'string') {
			throw error(400, '닉네임 형식이 올바르지 않습니다.');
		}
		if (body.nickname !== undefined) {
			try {
				normalizeNickname(body.nickname);
			} catch (cause) {
				throw error(400, cause instanceof Error ? cause.message : '닉네임을 확인하세요.');
			}
		}

		const { user } = await createIdentity(db, event, body.nickname as string | undefined);
		return jsonResponse({ registered: true, nickname: user.nickname }, { 'cache-control': 'no-store' });
	} catch (cause) {
		if (cause instanceof NicknameConflictError) throw error(409, cause.message);
		return rethrowApiError(cause, 'api/identity POST');
	}
};
