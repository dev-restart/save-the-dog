import { error, isHttpError } from '@sveltejs/kit';

export function jsonResponse(value: unknown, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(value), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...headers
		}
	});
}

export function rethrowApiError(cause: unknown, label: string): never {
	if (isHttpError(cause)) throw cause;
	console.error(`[${label}]`, cause instanceof Error ? cause.message : cause);
	throw error(503, '온라인 기능을 일시적으로 사용할 수 없습니다.');
}

export function requireUuid(value: string | null, label: string): string {
	if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
		throw error(400, `${label} 형식이 올바르지 않습니다.`);
	}
	return value;
}
