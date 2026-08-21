import { describe, expect, it } from 'vitest';

import type { StageScore } from '../scoring.js';
import { GameSessionState } from './game-session.svelte.js';

const CLEAR_SCORE: StageScore = {
	stars: 2.5,
	inkStars: 2.5,
	timeStars: 0,
	inkRatio: 0.62,
	timeRatio: 1
};

describe('GameSessionState campaign progression', () => {
	it('일반 게임 시작과 다음 단계 이동은 100단계를 넘지 않는다', () => {
		const session = new GameSessionState();

		session.start(500);
		expect(session.currentStage).toBe(100);

		session.nextStage();
		expect(session.currentStage).toBe(100);
		expect(session.lastPlayedStage).toBe(100);
	});

	it('서버 진행도에서도 캠페인 1~100단계 기록만 세션에 반영한다', () => {
		const session = new GameSessionState();

		session.applyServerProgress({
			highestStage: 500,
			lastPlayedStage: 240,
			totalClears: 240,
			totalStars: 8,
			stageStars: { '1': 3, '100': 2, '101': 3 },
			version: 1
		});

		expect(session.getProgressSnapshot()).toMatchObject({
			highestStage: 100,
			lastPlayedStage: 100,
			totalClears: 100,
			stageStars: { '1': 3, '100': 2 }
		});
		expect(session.stageStars).not.toHaveProperty('101');
	});

	it('100단계를 클리어해도 101단계를 자동으로 열지 않는다', () => {
		const session = new GameSessionState();
		session.applyServerProgress({
			highestStage: 100,
			lastPlayedStage: 100,
			totalClears: 99,
			totalStars: 297,
			stageStars: Object.fromEntries(
				Array.from({ length: 99 }, (_, index) => [String(index + 1), 3])
			),
			version: 1
		});
		session.start(100);

		session.markCleared(CLEAR_SCORE);

		expect(session.highestStage).toBe(100);
		expect(session.lastPlayedStage).toBe(100);
		expect(session.stageStars['100']).toBe(2.5);
		expect(session.totalClears).toBe(100);
	});
});
