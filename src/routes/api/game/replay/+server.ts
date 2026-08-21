import { error, type RequestHandler } from '@sveltejs/kit';
import { normalizeReplay } from '$lib/game/replay.js';
import { findIdentity } from '$lib/server/identity.js';
import { verifyAndStoreStageReplay } from '$lib/server/player-progress.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';

interface ReplayBody {
	replay?: unknown;
}

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		const user = await findIdentity(event);
		if (!user) throw error(401, '로그인이 필요합니다.');
		await enforceRateLimit(event, 'submit-stage-replay', user.userId, 20, 10 * 60 * 1000);
		const body = await readJson<ReplayBody>(event);
		let replay;
		try {
			replay = normalizeReplay(body.replay);
		} catch (cause) {
			throw error(400, cause instanceof Error ? cause.message : 'replay 형식이 올바르지 않습니다.');
		}
		return jsonResponse(await verifyAndStoreStageReplay(user, replay), { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/game/replay POST');
	}
};
