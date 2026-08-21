import { describe, expect, it } from 'vitest';
import type { ObstacleData, StageData } from '../types.js';
import { auditPuzzleDesign } from './puzzle-design.js';

const ground: ObstacleData = { type: 'ground', x: 195, y: 660, width: 390, height: 20 };

function stage(overrides: Partial<StageData> = {}): StageData {
	return {
		id: 999,
		dog: { x: 195, y: 500 },
		hives: [{ x: 195, y: 100, beeCount: 8, spawnIntervalMs: 300 }],
		obstacles: [
			ground,
			{ type: 'terrain-block', x: 80, y: 470, width: 50, height: 260 },
			{ type: 'terrain-block', x: 310, y: 470, width: 50, height: 260 },
			{ type: 'terrain-block', x: 195, y: 600, width: 230, height: 40 }
		],
		inkLimit: 320,
		survivalMs: 3000,
		...overrides
	};
}

describe('puzzle design geometric contract', () => {
	it('강아지 주변 구조, 45~220px anchor gap, 충분한 지형 실루엣을 갖춘 퍼즐을 통과시킨다', () => {
		const result = auditPuzzleDesign(stage());

		expect(result.issueCodes).toEqual([]);
		expect(result.severity).toBe('none');
		expect(result.metrics.drawingAnchorGap).toBe(180);
		expect(result.metrics.terrainCoverageRatio).toBeGreaterThan(0.04);
		expect(result.metrics.silhouetteHeightBands).toBeGreaterThanOrEqual(2);
	});

	it('강아지가 지형과 위험물 모두에서 떨어진 장식성 맵을 거부한다', () => {
		const result = auditPuzzleDesign(stage({
			dog: { x: 350, y: 620 },
			hives: [],
			obstacles: [ground, { type: 'terrain-block', x: 30, y: 80, width: 30, height: 50 }]
		}));

		expect(result.issueCodes).toContain('DOG_ISOLATED_FROM_PUZZLE');
		expect(result.issueCodes).toContain('TERRAIN_COVERAGE_TOO_SPARSE');
		expect(result.severity).toBe('error');
	});

	it('가장 가까운 Drawing anchor gap을 좁음, 적정, 넓음으로 분류한다', () => {
		const narrow = auditPuzzleDesign(stage({
			dog: { x: 205, y: 500 },
			obstacles: [
				{ type: 'terrain-block', x: 100, y: 470, width: 200, height: 260 },
				{ type: 'terrain-block', x: 235, y: 470, width: 50, height: 260 }
			]
		}));
		const wide = auditPuzzleDesign(stage({
			obstacles: [
				{ type: 'terrain-block', x: 50, y: 470, width: 50, height: 260 },
				{ type: 'terrain-block', x: 340, y: 470, width: 50, height: 260 }
			]
		}));

		expect(narrow.issues).toContainEqual(expect.objectContaining({ code: 'DRAWING_ANCHOR_GAP_TOO_NARROW', measuredValue: 10 }));
		expect(wide.issues).toContainEqual(expect.objectContaining({ code: 'DRAWING_ANCHOR_GAP_TOO_WIDE', measuredValue: 240 }));
	});

	it('두 번째 anchor가 없어 Drawing을 걸 수 없는 지형을 명시한다', () => {
		const result = auditPuzzleDesign(stage({
			obstacles: [{ type: 'terrain-block', x: 195, y: 540, width: 260, height: 180 }]
		}));

		expect(result.issueCodes).toContain('DRAWING_ANCHOR_GAP_MISSING');
	});

	it('위험물은 벌집에서 강아지로 향하는 접근 corridor 또는 강아지 영향 반경 안에 있어야 한다', () => {
		const onRoute = auditPuzzleDesign(stage({
			obstacles: [...stage().obstacles, { type: 'bomb', x: 195, y: 330, width: 42, height: 42 }]
		}));
		const decoration = auditPuzzleDesign(stage({
			obstacles: [...stage().obstacles, { type: 'bomb', x: 20, y: 650, width: 42, height: 42 }]
		}));

		expect(onRoute.issueCodes).not.toContain('HAZARD_OFF_APPROACH_ROUTE');
		expect(decoration.issues).toContainEqual(expect.objectContaining({
			code: 'HAZARD_OFF_APPROACH_ROUTE',
			obstacleIndex: 4
		}));
	});

	it('큰 사각형 하나로 면적만 채운 맵과 실제로 희박한 맵을 서로 다른 지표로 잡는다', () => {
		const flat = auditPuzzleDesign(stage({
			obstacles: [
				{ type: 'terrain-block', x: 90, y: 520, width: 80, height: 220 },
				{ type: 'terrain-block', x: 300, y: 520, width: 80, height: 220 }
			]
		}));
		const sparse = auditPuzzleDesign(stage({
			obstacles: [
				{ type: 'terrain-block', x: 150, y: 520, width: 20, height: 80 },
				{ type: 'terrain-block', x: 240, y: 520, width: 20, height: 80 }
			]
		}));

		expect(flat.issueCodes).not.toContain('TERRAIN_COVERAGE_TOO_SPARSE');
		expect(flat.issueCodes).toContain('TERRAIN_SILHOUETTE_TOO_SIMPLE');
		expect(sparse.issueCodes).toContain('TERRAIN_COVERAGE_TOO_SPARSE');
	});

	it('compound Prefab의 내부 벽을 실제 anchor로 계산한다', () => {
		const result = auditPuzzleDesign(stage({
			obstacles: [ground, {
				type: 'terrain-block', x: 195, y: 540, width: 240, height: 180, prefabId: 'u-shelter'
			}]
		}));

		expect(result.issueCodes).toEqual([]);
		expect(result.metrics.drawingAnchorGap).toBe(180);
	});
});
