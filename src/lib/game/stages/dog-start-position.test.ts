import { describe, expect, it } from 'vitest';
import type { StageData } from '../types.js';
import { getStage } from './index.js';
import { placeDogOnNearbySupport } from './dog-start-position.js';

function stage(overrides: Partial<StageData> = {}): StageData {
	return {
		id: 1,
		dog: { x: 195, y: 570 },
		hives: [],
		obstacles: [{ type: 'ground', x: 195, y: 660, width: 390, height: 20 }],
		inkLimit: 600,
		survivalMs: 3000,
		designType: 'basic-cover',
		...overrides
	};
}

describe('campaign dog start position', () => {
	it('일반 맵은 가까운 발판 위에서 공중 간격 없이 시작한다', () => {
		expect(placeDogOnNearbySupport(stage()).dog.y).toBe(630);
	});

	it('낙하 해결이 목표인 맵은 공중 시작 위치를 유지한다', () => {
		expect(placeDogOnNearbySupport(stage({ designType: 'fall-catch', dog: { x: 195, y: 255 } })).dog.y).toBe(255);
	});

	it('멀리 있는 지형이나 강아지 아래가 아닌 지형에는 이동시키지 않는다', () => {
		const input = stage({
			dog: { x: 40, y: 200 },
			obstacles: [{ type: 'platform', x: 300, y: 240, width: 80, height: 16 }]
		});
		expect(placeDogOnNearbySupport(input).dog).toEqual(input.dog);
	});

	it.each([
		[1, 597.86],
		[5, 590.36],
		[8, 601.43],
		[10, 554.29]
	])('%i단계 Compound Prefab의 실제 바닥 면 위로 맞춘다', (stageId, expectedY) => {
		const input = getStage(stageId);
		const placed = placeDogOnNearbySupport(input);

		expect(placed.dog.y).not.toBe(input.dog.y);
		expect(placed.dog.x).toBe(input.dog.x);
		expect(placed.dog.y).toBeCloseTo(expectedY, 2);
	});
});
