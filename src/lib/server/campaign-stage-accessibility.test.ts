import { describe, expect, it } from 'vitest';

import { normalizeReplay } from '$lib/game/replay.js';
import { getStage } from '$lib/game/stages/index.js';
import { verifyStageReplay } from './replay-simulator.js';

const irrelevantDrawings = new Map([
	[3, [{ x: 20, y: 80 }, { x: 45, y: 80 }]],
	[8, [{ x: 20, y: 80 }, { x: 45, y: 80 }]],
	[10, [{ x: 20, y: 40 }, { x: 70, y: 40 }]]
]);

const irrelevantFailureReasons = new Map([
	[3, ['bee']],
	[8, ['bee', 'rolling-boulder']],
	[10, ['bee', 'rolling-boulder']]
]);

describe('campaign 벌 접근성', () => {
	for (const stageId of [3, 8, 10]) {
		it(`${stageId}단계는 공략과 무관한 선만 그리면 자동 성공하지 않는다`, () => {
			const stage = getStage(stageId);
			const points = irrelevantDrawings.get(stageId)!;
			const replay = normalizeReplay({
				version: 1,
				stageId,
				seed: stage.seed,
				commands: [
					{ type: 'start', point: points[0] },
					{ type: 'move', point: points[1] },
					{ type: 'end' }
				]
			});

			const result = verifyStageReplay(stage, replay);

			expect(result.status, `${stageId}단계 결과: ${JSON.stringify(result)}`).toBe('failed');
			expect(irrelevantFailureReasons.get(stageId)).toContain(result.reason);
			expect(result.clearTimeMs).toBeLessThan(stage.survivalMs);
		});
	}

	it('8단계 굴림돌은 벌이 없어도 무관한 선에서 강아지에게 도달한다', () => {
		const stage = getStage(8);
		const replay = normalizeReplay({
			version: 1,
			stageId: 8,
			seed: stage.seed,
			commands: [
				{ type: 'start', point: { x: 20, y: 40 } },
				{ type: 'move', point: { x: 70, y: 40 } },
				{ type: 'end' }
			]
		});

		expect(verifyStageReplay({ ...stage, hives: [] }, replay)).toMatchObject({
			status: 'failed',
			reason: 'rolling-boulder'
		});
	});

	it('8단계는 중앙 안전실의 두 턱을 잇는 방어선으로 굴림돌과 벌을 막는다', () => {
		const stage = getStage(8);
		const start = { x: 130, y: 470 };
		const end = { x: 260, y: 470 };
		const replay = normalizeReplay({
			version: 1,
			stageId: 8,
			seed: stage.seed,
			commands: [
				{ type: 'start', point: start },
				...Array.from({ length: 12 }, (_, index) => ({
					type: 'move' as const,
					point: {
						x: start.x + ((end.x - start.x) * (index + 1)) / 12,
						y: start.y + ((end.y - start.y) * (index + 1)) / 12
					}
				})),
				{ type: 'end' }
			]
		});

		expect(verifyStageReplay(stage, replay).status).toBe('cleared');
	});

	it('10단계는 중앙 돌방 위 얕은 지붕으로 클리어된다', () => {
		const stage = getStage(10);
		const points = [
			{ x: 100, y: 370 },
			{ x: 195, y: 350 },
			{ x: 275, y: 370 }
		];
		const sampled = points.flatMap((point, pointIndex) => {
			if (pointIndex === 0) return [point];
			const previous = points[pointIndex - 1];
			return Array.from({ length: 8 }, (_, index) => ({
				x: previous.x + ((point.x - previous.x) * (index + 1)) / 8,
				y: previous.y + ((point.y - previous.y) * (index + 1)) / 8
			}));
		});
		const replay = normalizeReplay({
			version: 1,
			stageId: 10,
			seed: stage.seed,
			commands: [
				{ type: 'start', point: sampled[0] },
				...sampled.slice(1).map((point) => ({ type: 'move' as const, point })),
				{ type: 'end' }
			]
		});

		const result = verifyStageReplay(stage, replay);

		expect(result.status).toBe('cleared');
		expect(result.inkRatio).toBeGreaterThan(0.4);
	});
});
