import { error, type RequestHandler } from '@sveltejs/kit';
import { findIdentity } from '$lib/server/identity.js';
import { getPlayerProgress, mergePlayerProgress, normalizePlayerProgress } from '$lib/server/player-progress.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { enforceRateLimit, ensureSameOrigin, readJson } from '$lib/server/request.js';

export const GET: RequestHandler = async (event) => {
	try {
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		return jsonResponse({ progress: await getPlayerProgress(user.userId) }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/progress GET');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'update-last-played-stage', user.userId, 20, 10 * 60 * 1000);
		const body = await readJson<{ progress?: unknown }>(event);
		const progress = normalizePlayerProgress(body.progress);
		return jsonResponse({ progress: await mergePlayerProgress(user.userId, progress) }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/progress POST');
	}
};
