import { error, type RequestEvent } from '@sveltejs/kit';
import type { Db } from 'mongodb';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getIdentitySecret } from './identity.js';

const MAX_REQUEST_BYTES = 64 * 1024;

export function ensureSameOrigin(event: RequestEvent): void {
	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin) throw error(403, '허용되지 않은 요청입니다.');
}

export function ensureContentLength(event: RequestEvent): void {
	const contentLength = Number(event.request.headers.get('content-length') ?? 0);
	if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
		throw error(413, '요청 데이터가 너무 큽니다.');
	}
}

export async function readJson<T>(event: RequestEvent): Promise<T> {
	ensureContentLength(event);
	let value: unknown;
	try {
		value = await event.request.json();
	} catch {
		throw error(400, 'JSON 요청 형식이 올바르지 않습니다.');
	}
	if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_REQUEST_BYTES) throw error(413, '요청 데이터가 너무 큽니다.');
	return value as T;
}

export async function enforceRateLimit(
	db: Db,
	event: RequestEvent,
	action: string,
	userId: string | undefined,
	limit: number,
	windowMs: number
): Promise<void> {
	const windowStart = Math.floor(Date.now() / windowMs);
	const address = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? safeClientAddress(event);
	const addressHash = createHash('sha256').update(`${getIdentitySecret()}:${address}`).digest('hex').slice(0, 32);
	const actor = userId ? `user:${userId}` : `ip:${addressHash}`;
	const id = `${action}:${actor}:${windowStart}`;
	const expiresAt = new Date((windowStart + 2) * windowMs);

	await db.collection<{ _id: string; count: number; expiresAt: Date }>('rate_limits').updateOne(
		{ _id: id },
		{ $inc: { count: 1 }, $setOnInsert: { expiresAt } },
		{ upsert: true }
	);
	const row = await db.collection<{ _id: string; count: number; expiresAt: Date }>('rate_limits').findOne({ _id: id });
	if ((row?.count ?? limit + 1) > limit) throw error(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
}

function safeClientAddress(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown-client';
	}
}
