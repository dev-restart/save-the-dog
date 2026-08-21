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
		expect(document.hint.objectiveLabel).toBe('높이가 다른 턱 잇기');
		expect(objectKinds).toContain('dog');
		expect(objectKinds).toContain('hive');
		expect(objectKinds).toContain('terrain-block');
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

	it('지형 타일과 회전 각도는 맵 공유 왕복에서 보존된다', () => {
		const document = createEmptyStageMapDocument();
		document.objects.push({ id: 'tree-1', kind: 'no-draw-tree', x: 120, y: 420, width: 60, height: 100, angle: 0.35 });
		document.objects.push({ id: 'terrain-1', kind: 'terrain-block', x: 180, y: 540, width: 60, height: 60 });
		const restored = decodeStageMapShare(encodeStageMapShare(document));
		const tree = restored.objects.find((object) => object.id === 'tree-1');
		const terrainBlock = restored.objects.find((object) => object.id === 'terrain-1');

		expect(tree?.kind).toBe('no-draw-tree');
		expect(tree?.angle).toBe(0.35);
		expect(terrainBlock).toMatchObject({ kind: 'terrain-block', width: 60, height: 60 });
	});

	it('알 수 없는 오브젝트 종류와 잘못된 각도를 저장 전에 거부한다', () => {
		const document = createEmptyStageMapDocument();
		const invalid = document.objects[0];
		if (!invalid) throw new Error('기본 강아지 오브젝트가 없습니다.');
		(invalid as unknown as { kind: string }).kind = 'unknown-object';
		document.objects.push({ id: 'bad-angle', kind: 'wood', x: 100, y: 100, width: 80, height: 16, angle: Number.NaN });

		const errors = validateStageMapDocument(document);
		expect(errors).toContain('지원하지 않는 오브젝트 종류입니다.');
		expect(errors).toContain('wood 각도를 확인하세요.');
	});

	it('지원하지 않는 terrain prefab 식별자는 저장 전에 거부한다', () => {
		const document = createEmptyStageMapDocument();
		document.objects.push({
			id: 'prefab-1',
			kind: 'terrain-block',
			x: 180,
			y: 420,
			width: 180,
			height: 110,
			prefabId: 'unknown-prefab' as never
		});

		expect(validateStageMapDocument(document)).toContain('지원하지 않는 지형 prefab입니다.');
	});
});
