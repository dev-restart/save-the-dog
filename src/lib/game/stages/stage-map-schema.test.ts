import { describe, expect, it } from 'vitest';
import { getStage } from './index.js';
import {
	createEmptyStageMapDocument,
	createStageDataFromMapDocument,
	createStageMapDocument,
	decodeSharedStageMap,
	decodeStageMapShare,
	encodeStageMapQrShare,
	encodeStageMapShare,
	validateStageMapDocument
} from './stage-map-schema.js';

describe('stage map share schema', () => {
	it('스테이지를 디자이너가 공유할 수 있는 맵 문서로 변환한다', () => {
		const document = createStageMapDocument(getStage(2));
		const objectKinds = document.objects.map((object) => object.kind);

		expect(document.version).toBe(1);
		expect(document.designType).toBe('bridge-gap');
		expect(document.environment).toBe('meadow');
		expect(document.difficulty.profile).toBe('shelter');
		expect(document.hint.objectiveLabel).toBe('틈 위에 가로막기');
		expect(objectKinds).toContain('dog');
		expect(objectKinds).toContain('hive');
		expect(objectKinds).toContain('wood');
		expect(objectKinds).toContain('brick');
		expect(objectKinds).toContain('water');
		expect(document.objects.find((object) => object.kind === 'hive')?.attackStyle).toBe('direct');
	});

	it('맵 공유 코드는 같은 문서로 왕복 복원된다', () => {
		const document = createStageMapDocument(getStage(8));
		const shareCode = encodeStageMapShare(document);

		expect(decodeStageMapShare(shareCode)).toEqual(document);
		expect(document.environment).toBe('volcanic');
	});

	it('QR용 압축 공유 코드는 같은 맵을 복원하고 플레이 데이터로 변환한다', () => {
		const document = createStageMapDocument(getStage(12));
		const shareCode = encodeStageMapQrShare(document);
		const restored = decodeSharedStageMap(shareCode);
		const stage = createStageDataFromMapDocument(restored);

		expect(restored).toEqual(document);
		expect(stage.dog).toEqual({ x: 314, y: 470 });
		expect(stage.hives).toHaveLength(document.objects.filter((object) => object.kind === 'hive').length);
		expect(stage.difficulty?.profile).toBe(document.difficulty.profile);
	});

	it('에디터 기본 맵은 저장 가능한 최소 퍼즐 구조를 제공한다', () => {
		const document = createEmptyStageMapDocument();

		expect(validateStageMapDocument(document)).toEqual([]);
		expect(document.objects.some((object) => object.kind === 'dog')).toBe(true);
		expect(document.objects.some((object) => object.kind === 'hive')).toBe(true);
	});

	it('캠페인 챌린지 맵은 환경과 신규 장애물 타입까지 공유 문서에 보존한다', () => {
		const document = createStageMapDocument(getStage(22));
		const objectKinds = document.objects.map((object) => object.kind);

		expect(document.environment).toBe('forest');
		expect(objectKinds).toContain('acid');
		expect(objectKinds).toContain('ice');
		expect(objectKinds).toContain('stone');
	});
});
