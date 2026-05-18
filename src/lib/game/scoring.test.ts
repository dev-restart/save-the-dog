import { describe, expect, it } from 'vitest';

import { calculateStageScore, formatStarScore } from './scoring.js';

describe('stage star scoring', () => {
	it('잉크를 적게 쓰고 제한 시간을 모두 버티면 별 3개 만점이다', () => {
		const score = calculateStageScore({ inkRatio: 0.82, elapsedMs: 5000, survivalMs: 5000 });

		expect(score.stars).toBe(3);
		expect(score.inkStars).toBe(1.5);
		expect(score.timeStars).toBe(1.5);
	});

	it('사용 잉크와 시간 점수를 합산한 뒤 0.5개 단위로 내림 처리한다', () => {
		const score = calculateStageScore({ inkRatio: 0.38, elapsedMs: 4250, survivalMs: 5000 });

		expect(score.inkStars).toBe(0.5);
		expect(score.timeStars).toBe(1);
		expect(score.stars).toBe(1.5);
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
