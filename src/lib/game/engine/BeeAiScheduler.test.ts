import { describe, expect, it } from 'vitest';

import { BeeAiScheduler } from './BeeAiScheduler.js';

describe('BeeAiScheduler', () => {
	it('첫 프레임은 즉시 AI 계산을 허용한다', () => {
		const scheduler = new BeeAiScheduler(50);

		expect(scheduler.tick(16)).toBe(true);
	});

	it('고정 물리 step마다 경로 탐색을 반복하지 않고 지정 간격까지 대기한다', () => {
		const scheduler = new BeeAiScheduler(50);

		scheduler.tick(16);
		expect(scheduler.tick(16)).toBe(false);
		expect(scheduler.tick(16)).toBe(false);
		expect(scheduler.tick(18)).toBe(true);
	});

	it('새 벌처럼 방향 정보가 없는 엔티티가 있으면 간격 전에도 계산을 허용한다', () => {
		const scheduler = new BeeAiScheduler(50);

		scheduler.tick(16);
		expect(scheduler.tick(16, true)).toBe(true);
	});
});
