import { error, type RequestEvent } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getIdentitySecret } from './identity.js';
import { ensurePostgresSchema, getPostgresPool, tableName } from './postgres.js';

const MAX_REQUEST_BYTES = 64 * 1024;

export function ensureSameOrigin(event: RequestEvent): void {
	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin) throw error(403, '허용되지 않은 요청입니다.');
}

export function ensureContentLength(event: RequestEvent): void {
	const header = event.request.headers.get('content-length');
	if (header === null) return;
	const contentLength = Number(header);
	if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
		throw error(400, 'Content-Length가 올바르지 않습니다.');
	}
	if (contentLength > MAX_REQUEST_BYTES) {
		throw error(413, '요청 데이터가 너무 큽니다.');
	}
}

export async function readJson<T>(event: RequestEvent): Promise<T> {
	ensureContentLength(event);
	const bytes = await readLimitedBody(event.request);
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw error(400, 'JSON 요청 형식이 올바르지 않습니다.');
	}
	return value as T;
}

async function readLimitedBody(request: Request): Promise<Buffer> {
	const reader = request.body?.getReader();
	if (!reader) throw error(400, 'JSON 요청 형식이 올바르지 않습니다.');
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > MAX_REQUEST_BYTES) {
				await reader.cancel();
				throw error(413, '요청 데이터가 너무 큽니다.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

export async function enforceRateLimit(
	event: RequestEvent,
	action: string,
	userId: string | undefined,
	limit: number,
	windowMs: number
): Promise<void> {
	const windowStart = Math.floor(Date.now() / windowMs);
	const address = safeClientAddress(event);
	const addressHash = createHash('sha256').update(`${getIdentitySecret()}:${address}`).digest('hex').slice(0, 32);
	const actor = userId ? `user:${userId}` : `ip:${addressHash}`;
	const id = `${action}:${actor}:${windowStart}`;
	const expiresAt = new Date((windowStart + 2) * windowMs);
	await ensurePostgresSchema();
	const result = await getPostgresPool().query<{ count: number }>(
		`INSERT INTO ${tableName('rate_limits')} AS target (id, count, expires_at)
		 VALUES ($1, 1, $2)
		 ON CONFLICT (id) DO UPDATE SET count = target.count + 1
		 RETURNING count`,
		[id, expiresAt]
	);
	if ((result.rows[0]?.count ?? limit + 1) > limit) throw error(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
}

function safeClientAddress(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown-client';
	}
}
