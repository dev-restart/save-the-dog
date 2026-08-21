import { describe, expect, it } from 'vitest';

import { normalizeReplay, type StageReplay } from '$lib/game/replay.js';
import { getStage } from '$lib/game/stages/index.js';
import type { Point } from '$lib/game/types.js';
import { verifyStageReplay } from './replay-simulator.js';

const CANONICAL_PATH: Point[] = [{ x: 130, y: 470 }, { x: 260, y: 470 }];
const IRRELEVANT_PATH: Point[] = [{ x: 20, y: 60 }, { x: 70, y: 60 }];
const MOBILE_SAMPLE_STEPS = [10, 12, 14, 16] as const;

describe('stage 8 mobile playability', () => {
	it('10~16px 손가락 sampling으로 두 턱을 이으면 벌과 굴림돌을 막는다', () => {
		const stage = getStage(8);

		for (const sampleStep of MOBILE_SAMPLE_STEPS) {
			for (const phaseOffset of [-2, 0, 2]) {
				for (let run = 0; run < 5; run += 1) {
					const result = verifyStageReplay(stage, replayFor(stage.id, sampledPath(CANONICAL_PATH, sampleStep + phaseOffset)));

					expect(result.status, `${sampleStep}px/${phaseOffset}px phase, run ${run + 1}`).toBe('cleared');
					expect(result.clearTimeMs).toBe(stage.survivalMs);
				}
			}
		}
	}, 30_000);

	it('하늘에 의미 없는 선을 그으면 실제 위험이 강아지에 닿는다', () => {
		const stage = getStage(8);

		for (const sampleStep of MOBILE_SAMPLE_STEPS) {
			for (const phaseOffset of [-2, 0, 2]) {
				for (let run = 0; run < 5; run += 1) {
					const result = verifyStageReplay(stage, replayFor(stage.id, sampledPath(IRRELEVANT_PATH, sampleStep + phaseOffset)));

					expect(result.status, `${sampleStep}px/${phaseOffset}px phase, run ${run + 1}`).toBe('failed');
					expect(['bee', 'rolling-boulder']).toContain(result.reason);
					expect(result.clearTimeMs).toBeLessThan(stage.survivalMs);
				}
			}
		}
	}, 30_000);

	it('굴림돌은 벌이 없어도 강아지 경로를 실제로 공략한다', () => {
		const stage = getStage(8);
		const boulderOnlyStage = { ...stage, hives: [] };
		const result = verifyStageReplay(
			boulderOnlyStage,
			replayFor(stage.id, sampledPath(IRRELEVANT_PATH, 10))
		);

		expect(result).toMatchObject({ status: 'failed', reason: 'rolling-boulder' });
		expect(result.clearTimeMs).toBeLessThan(stage.survivalMs);
	});
});

function sampledPath(controlPoints: Point[], sampleStep: number): Point[] {
	const sampled: Point[] = [{ ...controlPoints[0] }];
	for (let index = 1; index < controlPoints.length; index += 1) {
		const start = controlPoints[index - 1];
		const end = controlPoints[index];
		const distance = Math.hypot(end.x - start.x, end.y - start.y);
		const segmentCount = Math.max(1, Math.ceil(distance / sampleStep));
		for (let segment = 1; segment <= segmentCount; segment += 1) {
			const ratio = segment / segmentCount;
			sampled.push({
				x: start.x + (end.x - start.x) * ratio,
				y: start.y + (end.y - start.y) * ratio
			});
		}
	}
	return sampled;
}

function replayFor(stageId: number, points: Point[]): StageReplay {
	return normalizeReplay({
		version: 1,
		stageId,
		commands: [
			{ type: 'start', point: points[0] },
			...points.slice(1).map((point) => ({ type: 'move' as const, point })),
			{ type: 'end' }
		]
	});
}
