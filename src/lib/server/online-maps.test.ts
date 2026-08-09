import { describe, expect, it } from 'vitest';
import { createEmptyStageMapDocument, type StageMapDocument } from '$lib/game/stages/stage-map-schema.js';
import { normalizeOnlineMapDocument } from './online-maps.js';

describe('normalizeOnlineMapDocument', () => {
	it('온라인 저장 전에 허용된 필드만 남긴다', () => {
		const document = createEmptyStageMapDocument() as StageMapDocument & { injected?: string };
		document.injected = 'must not be stored';
		document.objects[0] = { ...document.objects[0], injected: 'must not be stored' } as typeof document.objects[0];

		const normalized = normalizeOnlineMapDocument(document);
		expect(normalized).not.toHaveProperty('injected');
		expect(normalized.objects[0]).not.toHaveProperty('injected');
	});

	it('온라인 저장에서 설명 길이 제한을 다시 검사한다', () => {
		const document = createEmptyStageMapDocument();
		document.designerNote = 'x'.repeat(1001);

		expect(() => normalizeOnlineMapDocument(document)).toThrow('허용된 길이');
	});

	it('객체 형식이 깨진 요청을 서버 오류가 아닌 입력 오류로 분류한다', () => {
		const document = createEmptyStageMapDocument();
		document.objects = [null as never];

		expect(() => normalizeOnlineMapDocument(document)).toThrow('지도 데이터 형식');
	});
});
