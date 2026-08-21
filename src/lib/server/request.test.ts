import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { ensureContentLength, readJson } from './request.js';

function requestEvent(body: string, headers: Record<string, string> = {}): RequestEvent {
	return {
		request: new Request('http://localhost/api/test', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body
		})
	} as RequestEvent;
}

describe('request guards', () => {
	it('reads a valid JSON body', async () => {
		await expect(readJson<{ value: number }>(requestEvent('{"value":7}'))).resolves.toEqual({ value: 7 });
	});

	it('rejects an oversized streamed body without relying on Content-Length', async () => {
		const body = JSON.stringify({ value: 'x'.repeat(64 * 1024) });
		await expect(readJson(requestEvent(body))).rejects.toMatchObject({ status: 413 });
	});

	it('rejects invalid Content-Length values', () => {
		try {
			ensureContentLength(requestEvent('{}', { 'content-length': 'invalid' }));
			expect.unreachable('invalid Content-Length should be rejected');
		} catch (reason) {
			expect(reason).toMatchObject({
				status: 400,
				body: { message: 'Content-Length가 올바르지 않습니다.' }
			});
		}
	});
});
