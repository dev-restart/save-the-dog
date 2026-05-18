import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './GameLoopClock.js';

describe('FixedStepClock', () => {
	it('느린 프레임도 여러 개의 고정 물리 스텝으로 나눠 처리한다', () => {
		const clock = new FixedStepClock({ fixedDeltaMs: 1000 / 60, maxFrameDeltaMs: 80, maxStepsPerFrame: 5 });

		const first = clock.tick(0);
		const second = clock.tick(50);

		expect(first.frameDeltaMs).toBeCloseTo(1000 / 60, 4);
		expect(first.steps).toHaveLength(1);
		expect(second.frameDeltaMs).toBe(50);
		expect(second.steps).toHaveLength(3);
		expect(second.simulationDeltaMs).toBeCloseTo(50, 4);
	});

	it('비정상적으로 긴 탭 백그라운드 프레임은 상한으로 잘라 물리 폭주를 막는다', () => {
		const clock = new FixedStepClock({ fixedDeltaMs: 16, maxFrameDeltaMs: 64, maxStepsPerFrame: 4 });

		clock.tick(0);
		const result = clock.tick(1000);

		expect(result.frameDeltaMs).toBe(64);
		expect(result.steps).toHaveLength(4);
		expect(result.simulationDeltaMs).toBe(64);
	});
});
