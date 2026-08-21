import { describe, expect, it } from 'vitest';

import { calculateStageScore, formatStarScore } from './scoring.js';

describe('stage star scoring', () => {
	it('잉크를 충분히 아끼면 생존 시간과 무관하게 별 3개 만점이다', () => {
		const score = calculateStageScore({ inkRatio: 0.82, elapsedMs: 5000, survivalMs: 5000 });

		expect(score.stars).toBe(3);
		expect(score.inkStars).toBe(3);
		expect(score.timeStars).toBe(0);
	});

	it('별점은 잉크 효율만으로 0.5개 단위로 계산한다', () => {
		const score = calculateStageScore({ inkRatio: 0.38, elapsedMs: 4250, survivalMs: 5000 });

		expect(score.inkStars).toBe(1.5);
		expect(score.timeStars).toBe(0);
		expect(score.stars).toBe(1.5);
	});

	it('같은 잉크 효율이면 생존 시간 차이로 별점이 갈리지 않는다', () => {
		const fast = calculateStageScore({ inkRatio: 0.6, elapsedMs: 2000, survivalMs: 5000 });
		const slow = calculateStageScore({ inkRatio: 0.6, elapsedMs: 5000, survivalMs: 5000 });

		expect(fast.stars).toBe(2.5);
		expect(slow.stars).toBe(2.5);
		expect(fast.timeRatio).toBe(0.4);
		expect(slow.timeRatio).toBe(1);
	});

	it('클리어했다면 최소 반 개 별은 보장한다', () => {
		const score = calculateStageScore({ inkRatio: 0, elapsedMs: 1000, survivalMs: 5000 });

		expect(score.stars).toBe(0.5);
	});

	it('별 점수는 한 자리 소수 문자열로 표시할 수 있다', () => {
		expect(formatStarScore(3)).toBe('3.0');
		expect(formatStarScore(1.5)).toBe('1.5');
	});
});
