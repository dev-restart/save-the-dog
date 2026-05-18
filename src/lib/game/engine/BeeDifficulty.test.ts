import { describe, expect, it } from 'vitest';
import { createBeeDifficultyProfile, getBeeRole } from './BeeDifficulty.js';

describe('createBeeDifficultyProfile', () => {
	it('초반 스테이지는 튜토리얼 난이도를 유지하고 방어선 파괴를 비활성화한다', () => {
		const profile = createBeeDifficultyProfile(1);

		expect(profile.intelligence).toBe(0);
		expect(profile.canPressureDrawing).toBe(false);
		expect(profile.canDamageDrawing).toBe(false);
		expect(profile.canDragDrawing).toBe(false);
		expect(profile.routeCellSize).toBeGreaterThanOrEqual(16);
		expect(profile.maxSpeed).toBeLessThan(8);
		expect(profile.aiRefreshBudget).toBeGreaterThanOrEqual(20);
	});

	it('중후반 스테이지는 경로 탐색과 방어선 압박 능력이 강해진다', () => {
		const early = createBeeDifficultyProfile(1);
		const late = createBeeDifficultyProfile(14);

		expect(late.intelligence).toBeGreaterThan(early.intelligence);
		expect(late.routeCellSize).toBeLessThan(early.routeCellSize);
		expect(late.routeCacheMs).toBeLessThan(early.routeCacheMs);
		expect(late.maxSpeed).toBeGreaterThan(early.maxSpeed);
		expect(late.aiRefreshBudget).toBeGreaterThanOrEqual(3);
		expect(late.routeIterationLimit).toBeGreaterThan(early.routeIterationLimit);
		expect(late.canPressureDrawing).toBe(true);
		expect(late.canDamageDrawing).toBe(true);
		expect(late.canDragDrawing).toBe(true);
		expect(late.canRotateDrawing).toBe(true);
		expect(late.drawingDurability).toBeLessThan(early.drawingDurability);
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
