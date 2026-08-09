import { describe, expect, it } from 'vitest';
import { normalizeReplay } from './replay.js';

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
});
