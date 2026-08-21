import { error, type RequestHandler } from '@sveltejs/kit';
import { findIdentity } from '$lib/server/identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { ensureSameOrigin, enforceRateLimit, readJson } from '$lib/server/request.js';

interface StageTelemetryBody {
	stageId?: unknown;
	outcome?: unknown;
	reason?: unknown;
	elapsedMs?: unknown;
	inkRatio?: unknown;
}

const OUTCOMES = new Set(['cleared', 'failed']);
const MAX_STAGE_ID = 500;

export const POST: RequestHandler = async (event) => {
	try {
		ensureSameOrigin(event);
		await ensurePostgresSchema();
		const user = await findIdentity(event);
		if (!user) throw error(401, '닉네임을 먼저 만들어야 합니다.');
		await enforceRateLimit(event, 'submit-stage-telemetry', user.userId, 30, 10 * 60 * 1000);

		const body = await readJson<StageTelemetryBody>(event);
		const stageId = finiteInteger(body.stageId);
		const outcome = typeof body.outcome === 'string' ? body.outcome : '';
		const reason = typeof body.reason === 'string' && /^[a-z-]{1,32}$/u.test(body.reason) ? body.reason : 'unknown';
		const elapsedMs = finiteNumber(body.elapsedMs);
		const inkRatio = finiteNumber(body.inkRatio);
		if (stageId === null || stageId < 1 || stageId > MAX_STAGE_ID) throw error(400, '분석 단계가 올바르지 않습니다.');
		if (!OUTCOMES.has(outcome)) throw error(400, '분석 결과가 올바르지 않습니다.');
		if (elapsedMs === null || elapsedMs < 0 || elapsedMs > 120000) throw error(400, '분석 시간이 올바르지 않습니다.');
		if (inkRatio === null || inkRatio < 0 || inkRatio > 1) throw error(400, '분석 잉크 비율이 올바르지 않습니다.');

		const day = new Date().toISOString().slice(0, 10);
		await getPostgresPool().query(
			`INSERT INTO ${tableName('stage_telemetry')} AS current
				(day, stage_id, outcome, reason, attempts, total_elapsed_ms, total_ink_ratio, expires_at)
			 VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
			 ON CONFLICT (day, stage_id, outcome, reason) DO UPDATE SET
				attempts = current.attempts + 1,
				total_elapsed_ms = current.total_elapsed_ms + EXCLUDED.total_elapsed_ms,
				total_ink_ratio = current.total_ink_ratio + EXCLUDED.total_ink_ratio,
				expires_at = EXCLUDED.expires_at`,
			[day, stageId, outcome, reason, Math.round(elapsedMs), inkRatio, new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)]
		);
		return jsonResponse({ accepted: true }, { 'cache-control': 'no-store' });
	} catch (cause) {
		return rethrowApiError(cause, 'api/telemetry/stage POST');
	}
};

function finiteInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) ? value : null;
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
