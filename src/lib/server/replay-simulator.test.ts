import { describe, expect, it } from 'vitest';
import { verifyStageReplay } from './replay-simulator.js';
import { normalizeReplay } from '$lib/game/replay.js';
import type { StageData } from '$lib/game/types.js';
import { getStage } from '$lib/game/stages/index.js';

const stage: StageData = {
	id: 900,
	dog: { x: 195, y: 570 },
	hives: [{ x: 195, y: 100, beeCount: 1, spawnIntervalMs: 10000, beeForce: 0.0018 }],
	obstacles: [{ type: 'ground', x: 195, y: 660, width: 390, height: 20 }],
	inkLimit: 600,
	survivalMs: 3000,
	difficulty: { profile: 'tutorial' }
};

describe('server replay simulator', () => {
	it('1단계의 ㄷ자 지형 위를 닫는 지붕 replay를 서버에서 성공으로 검증한다', () => {
		const campaignStage = getStage(1);
		const replay = normalizeReplay({
			version: 1,
			stageId: campaignStage.id,
			commands: [
				{ type: 'start', point: { x: 120, y: 445 } },
				{ type: 'move', point: { x: 195, y: 425 } },
				{ type: 'move', point: { x: 270, y: 445 } },
				{ type: 'end' }
			]
		});

		const result = verifyStageReplay(campaignStage, replay);

		expect(result.status).toBe('cleared');
		expect(result.score?.stars).toBeGreaterThan(0);
	});

	it('같은 드로잉 명령을 서버 물리에서 성공으로 재생한다', () => {
		const replay = normalizeReplay({
			version: 1,
			stageId: stage.id,
			commands: [
				{ type: 'start', point: { x: 40, y: 500 } },
				{ type: 'move', point: { x: 350, y: 500 } },
				{ type: 'end' }
			]
		});

		const result = verifyStageReplay(stage, replay);

		expect(result.status).toBe('cleared');
		expect(result.score?.stars).toBeGreaterThan(0);
	});

	it('금지 지형을 통과한 조작은 서버에서 거부한다', () => {
		const blockedStage = { ...stage, obstacles: [...stage.obstacles, { type: 'water' as const, x: 195, y: 500, width: 80, height: 30 }] };
		const replay = normalizeReplay({
			version: 1,
			stageId: blockedStage.id,
			commands: [
				{ type: 'start', point: { x: 40, y: 500 } },
				{ type: 'move', point: { x: 350, y: 500 } },
				{ type: 'end' }
			]
		});

		expect(() => verifyStageReplay(blockedStage, replay)).toThrow('실제 규칙');
	});
});
