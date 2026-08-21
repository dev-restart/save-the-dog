import { describe, expect, it } from 'vitest';

import { normalizeReplay } from '$lib/game/replay.js';
import { getStage } from '$lib/game/stages/index.js';
import { compileTerrainPrefab } from '$lib/game/terrain/terrain-compiler.js';
import type { Point, StageData } from '$lib/game/types.js';
import { verifyStageReplay } from './replay-simulator.js';

const CANONICAL_ROOF: Point[] = [
	{ x: 100, y: 370 },
	{ x: 195, y: 350 },
	{ x: 275, y: 370 }
];
const IRRELEVANT_SKY_LINE: Point[] = [
	{ x: 20, y: 40 },
	{ x: 70, y: 40 }
];
const MOBILE_SAMPLE_SPACING = [10, 12, 14, 16] as const;

describe('10단계 실제 공략 계약', () => {
	it('U자 돌방은 Drawing이 필요한 30px 이상의 열린 진입로를 남긴다', () => {
		const stage = getStage(10);
		const shelter = stage.obstacles.find((obstacle) => obstacle.prefabId === 'u-shelter');
		expect(shelter).toBeDefined();
		if (!shelter?.prefabId) return;

		const source = compileTerrainPrefab(shelter.prefabId);
		const compiled = compileTerrainPrefab(shelter.prefabId, {
			position: { x: shelter.x, y: shelter.y },
			rotation: shelter.angle ?? 0,
			scale: {
				x: shelter.width / source.bounds.width,
				y: shelter.height / source.bounds.height
			}
		});
		const leftWall = compiled.parts.find((part) => part.id === 'left-wall');
		const rightWall = compiled.parts.find((part) => part.id === 'right-wall');
		expect(leftWall).toBeDefined();
		expect(rightWall).toBeDefined();
		if (!leftWall || !rightWall) return;

		const openingWidth = rightWall.bounds.min.x - leftWall.bounds.max.x;
		expect(openingWidth).toBeGreaterThanOrEqual(30);
		expect(stage.obstacles.some((obstacle) => obstacle.type === 'bomb')).toBe(false);
		expect(stage.dangerLabel).toBe('양측 협동 벌 + 중앙 굴림돌');
	});

	it.each(MOBILE_SAMPLE_SPACING)('%ipx 모바일 sampling의 얕은 ∧선은 5회 모두 클리어된다', (spacing) => {
		const stage = getStage(10);
		const replay = createReplay(stage, samplePolyline(CANONICAL_ROOF, spacing));

		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect(verifyStageReplay(stage, replay), `${spacing}px sampling ${attempt + 1}회`).toMatchObject({
				status: 'cleared',
				clearTimeMs: stage.survivalMs
			});
		}
	}, 15_000);

	it('공략과 무관한 하늘 선은 같은 프로세스에서 5회 모두 실패한다', () => {
		const stage = getStage(10);
		const replay = createReplay(stage, samplePolyline(IRRELEVANT_SKY_LINE, 12));

		for (let attempt = 0; attempt < 5; attempt += 1) {
			const result = verifyStageReplay(stage, replay);
			expect(result.status, `${attempt + 1}회 결과: ${JSON.stringify(result)}`).toBe('failed');
			expect(['bee', 'rolling-boulder']).toContain(result.reason);
			expect(result.clearTimeMs).toBeLessThan(stage.survivalMs);
		}
	});

	it('굴림돌은 벌이 없어도 열린 돌방의 강아지에게 실제로 도달한다', () => {
		const stage = getStage(10);
		const noHiveStage = { ...stage, hives: [] };
		const replay = createReplay(noHiveStage, samplePolyline(IRRELEVANT_SKY_LINE, 12));

		expect(verifyStageReplay(noHiveStage, replay)).toMatchObject({
			status: 'failed',
			reason: 'rolling-boulder'
		});

		const withoutBoulder = {
			...noHiveStage,
			obstacles: noHiveStage.obstacles.filter((obstacle) => obstacle.type !== 'rolling-boulder')
		};
		expect(verifyStageReplay(withoutBoulder, replay).status).toBe('cleared');
	});
});

function createReplay(stage: StageData, points: Point[]) {
	return normalizeReplay({
		version: 1,
		stageId: stage.id,
		seed: stage.seed,
		commands: [
			{ type: 'start', point: points[0] },
			...points.slice(1).map((point) => ({ type: 'move' as const, point })),
			{ type: 'end' }
		]
	});
}

function samplePolyline(vertices: Point[], spacing: number): Point[] {
	const sampled = [{ ...vertices[0] }];
	for (let index = 1; index < vertices.length; index += 1) {
		const from = vertices[index - 1];
		const to = vertices[index];
		const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / spacing);
		for (let step = 1; step <= steps; step += 1) {
			sampled.push({
				x: from.x + ((to.x - from.x) * step) / steps,
				y: from.y + ((to.y - from.y) * step) / steps
			});
		}
	}
	return sampled;
}
