import { describe, expect, it } from 'vitest';
import { createStageReplay, normalizeReplay } from './replay.js';
import type { StageData } from './types.js';

const stage: StageData = {
	id: 10,
	dog: { x: 195, y: 552 },
	hives: [],
	obstacles: [],
	inkLimit: 315,
	survivalMs: 7000
};

describe('stage replay contract', () => {
	it('start-move-end 명령을 정규화한다', () => {
		const replay = normalizeReplay({
			version: 1,
			stageId: 101,
			seed: 'challenge-v1-101',
			commands: [
				{ type: 'start', point: { x: 40, y: 400 } },
				{ type: 'move', point: { x: 350, y: 400 } },
				{ type: 'end' }
			]
		});

		expect(replay.commands).toHaveLength(3);
	});

	it('명령 순서와 명령 수를 검증한다', () => {
		expect(() => normalizeReplay({ version: 1, stageId: 101, commands: [{ type: 'end' }] })).toThrow();
		expect(() => normalizeReplay({ version: 1, stageId: 101, commands: [{ type: 'start', point: { x: 40, y: 400 } }, { type: 'end' }] })).toThrow();
	});

	it('모바일 Canvas 좌표를 BASE_WORLD 좌표로 저장한다', () => {
		const replay = createStageReplay(stage, [
			{ type: 'start', point: { x: 195, y: 800 } },
			{ type: 'move', point: { x: 390, y: 844 } },
			{ type: 'end' }
		], { width: 390, height: 844 });

		expect(replay.commands[0]).toEqual({ type: 'start', point: { x: 195, y: 800 / 844 * 693 } });
		expect(replay.commands[1]).toEqual({ type: 'move', point: { x: 390, y: 693 } });
		expect(() => normalizeReplay(replay)).not.toThrow();
	});
});
