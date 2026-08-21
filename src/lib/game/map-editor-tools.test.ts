import { describe, expect, it } from 'vitest';
import { isMapTerrainTopExposed, isPointInsideMapObject, terrainPrefabIdFromTool, toolAfterPlacement } from './map-editor-tools.js';

describe('map editor placement tools', () => {
	it.each(['brick', 'terrain-block', 'water', 'lava', 'acid', 'wood'] as const)(
		'%s 도구는 한 번 배치한 뒤 선택 모드로 전환한다',
		(tool) => {
			expect(toolAfterPlacement(tool)).toBe('select');
		}
	);

	it('강아지와 벌집도 한 번만 배치한다', () => {
		expect(toolAfterPlacement('dog')).toBe('select');
		expect(toolAfterPlacement('hive')).toBe('select');
	});

	it('Prefab 도구도 한 번 배치 후 선택 모드가 되고 id를 보존한다', () => {
		expect(terrainPrefabIdFromTool('prefab:u-shelter')).toBe('u-shelter');
		expect(toolAfterPlacement('prefab:u-shelter')).toBe('select');
	});
});

describe('map editor geometry', () => {
	it('회전된 오브젝트는 보이는 사각형 기준으로 선택한다', () => {
		const object = { id: 'slope', kind: 'terrain-block' as const, x: 100, y: 100, width: 80, height: 20, angle: Math.PI / 4 };
		expect(isPointInsideMapObject({ x: 121, y: 121 }, object, 80, 20)).toBe(true);
		expect(isPointInsideMapObject({ x: 125, y: 100 }, object, 80, 20)).toBe(false);
	});

	it('세로로 연결된 지형은 중간 잔디 상단을 숨긴다', () => {
		const upper = { id: 'upper', kind: 'terrain-block' as const, x: 100, y: 70, width: 60, height: 60 };
		const lower = { id: 'lower', kind: 'terrain-block' as const, x: 100, y: 130, width: 60, height: 60 };
		expect(isMapTerrainTopExposed(upper, [upper, lower])).toBe(true);
		expect(isMapTerrainTopExposed(lower, [upper, lower])).toBe(false);
	});

	it('ㄷ자 prefab의 빈 내부는 선택 영역이 아니고 실제 벽만 선택한다', () => {
		const shelter = { id: 'shelter', kind: 'terrain-block' as const, prefabId: 'u-shelter' as const, x: 195, y: 400, width: 200, height: 180 };
		expect(isPointInsideMapObject({ x: 195, y: 400 }, shelter, 200, 180)).toBe(false);
		expect(isPointInsideMapObject({ x: 105, y: 400 }, shelter, 200, 180)).toBe(true);
	});
});
