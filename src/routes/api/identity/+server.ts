import { error, type RequestHandler } from '@sveltejs/kit';
import {
	createAccount,
	findIdentity,
	InvalidCredentialsError,
	loginAccount,
	logoutAccount,
	NicknameConflictError,
	normalizeNickname,
	validatePassword
} from '$lib/server/identity.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';

interface IdentityBody {
	nickname?: unknown;
	password?: unknown;
}

export const GET: RequestHandler = async (event) => {
	try {
		const user = await findIdentity(event);
		return jsonResponse(user ? { registered: true, nickname: user.nickname } : { registered: false }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/identity GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		if (await findIdentity(event)) throw error(409, '이미 로그인되어 있습니다.');
		await enforceRateLimit(event, 'register-account', undefined, 5, 60 * 60 * 1000);
		const body = await readCredentials(event);
		const { user } = await createAccount(event, body.nickname, body.password);
		return jsonResponse({ registered: true, nickname: user.nickname }, { 'cache-control': 'no-store' });
	} catch (cause) {
		if (cause instanceof NicknameConflictError) throw error(409, cause.message);
		return rethrowApiError(cause, 'api/identity POST');
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await enforceRateLimit(event, 'login-account', undefined, 10, 10 * 60 * 1000);
		const body = await readCredentials(event);
		const { user } = await loginAccount(event, body.nickname, body.password);
		return jsonResponse({ registered: true, nickname: user.nickname }, { 'cache-control': 'no-store' });
	} catch (cause) {
		if (cause instanceof InvalidCredentialsError) throw error(401, cause.message);
		return rethrowApiError(cause, 'api/identity PUT');
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await logoutAccount(event);
		return jsonResponse({ registered: false }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/identity DELETE');
	}
};

async function readCredentials(event: Parameters<RequestHandler>[0]): Promise<{ nickname: string; password: string }> {
	const body = await readJson<IdentityBody>(event);
	if (typeof body.nickname !== 'string' || typeof body.password !== 'string') throw error(400, '닉네임과 비밀번호를 입력하세요.');
	try {
		return { nickname: normalizeNickname(body.nickname), password: validatePassword(body.password) };
	} catch (cause) {
		throw error(400, cause instanceof Error ? cause.message : '가입 정보를 확인하세요.');
	}
}
