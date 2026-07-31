import { describe, expect, it } from 'vitest';
import { createBeeDifficultyProfile, getBeeRole } from './BeeDifficulty.js';
import { getStage } from '../stages/index.js';

describe('createBeeDifficultyProfile', () => {
	it('초반 스테이지는 튜토리얼 난이도를 유지한다', () => {
		const profile = createBeeDifficultyProfile(1);

		expect(profile.intelligence).toBe(0);
		expect(profile.routeCellSize).toBeGreaterThanOrEqual(16);
		expect(profile.maxSpeed).toBeLessThan(8);
		expect(profile.aiRefreshBudget).toBeGreaterThanOrEqual(20);
	});

	it('중후반 스테이지는 경로 탐색과 속도, 공격 후보가 강해진다', () => {
		const early = createBeeDifficultyProfile(1);
		const late = createBeeDifficultyProfile(14);

		expect(late.intelligence).toBeGreaterThan(early.intelligence);
		expect(late.routeCellSize).toBeLessThan(early.routeCellSize);
		expect(late.routeCacheMs).toBeLessThan(early.routeCacheMs);
		expect(late.maxSpeed).toBeGreaterThan(early.maxSpeed);
		expect(late.aiRefreshBudget).toBeGreaterThanOrEqual(3);
		expect(late.routeIterationLimit).toBeGreaterThan(early.routeIterationLimit);
		expect(late.attackCandidateLimit).toBeGreaterThanOrEqual(early.attackCandidateLimit);
	});

	it('저작 데이터의 난이도 프로필과 개별 오버라이드를 적용한다', () => {
		const tutorial = getStage(1);
		const lateCampaign = getStage(30);
		const profile = createBeeDifficultyProfile(lateCampaign.id, lateCampaign.difficulty);

		expect(tutorial.difficulty?.profile).toBe('tutorial');
		expect(lateCampaign.difficulty?.profile).toBe('master');
		expect(profile.forceMultiplier).toBe(1.58);
		expect(profile.attackPathSearchLimit).toBe(3);
	});
});

describe('getBeeRole', () => {
	it('스테이지가 올라가면 벌마다 추격/측면 공격/방어선 압박 역할이 나뉜다', () => {
		expect(getBeeRole(1, 1)).toBe('chaser');
		expect(getBeeRole(3, 1)).toBe('chaser');
		expect(getBeeRole(3, 2)).toBe('flanker-left');
		expect(getBeeRole(3, 3)).toBe('flanker-right');
		expect(getBeeRole(10, 5)).toBe('bruiser');
	});
});
