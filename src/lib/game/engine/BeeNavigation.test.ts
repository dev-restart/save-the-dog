import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { createBeeDifficultyProfile } from './BeeDifficulty.js';
import { BeeNavigation, resolveBeeRole } from './BeeNavigation.js';
import type { CanvasSize } from '../types.js';

const size: CanvasSize = { width: 320, height: 240 };

function rectangle(x: number, y: number, width: number, height: number, label = 'drawing'): Matter.Body {
	return Matter.Bodies.rectangle(x, y, width, height, { label });
}

describe('BeeNavigation', () => {
	it('A* 경로가 막힌 직선 대신 방어선 바깥 우회 지점을 반환한다', () => {
		const navigation = new BeeNavigation(size, createBeeDifficultyProfile(12), 12);
		const blocker = rectangle(160, 120, 36, 150);
		const target = navigation.chooseTarget({ id: 2, position: { x: 40, y: 120 } }, { x: 280, y: 120 }, [blocker], 0);

		expect(target.x).toBeGreaterThan(40);
		expect(Math.abs(target.y - 120)).toBeGreaterThan(12);
		expect(navigation.findLineBlocker({ x: 40, y: 120 }, target, [blocker])).toBeNull();
	});

	it('열린 경로에서는 역할별 측면 공격 후보를 선택한다', () => {
		const navigation = new BeeNavigation(size, createBeeDifficultyProfile(12), 12);
		const target = navigation.chooseTarget({ id: 2, position: { x: 40, y: 120 } }, { x: 220, y: 120 }, [], 0);

		expect(target.x).toBeLessThan(220);
		expect(target.y).not.toBe(120);
	});

	it('막힌 경로에서는 벌 id별로 서로 다른 공격 루트 후보를 고른다', () => {
		const navigation = new BeeNavigation(size, createBeeDifficultyProfile(14), 14);
		const blocker = rectangle(160, 120, 36, 150);
		const dog = { x: 280, y: 120 };
		const targets = [2, 3, 4, 5, 6].map((id) =>
			navigation.chooseTarget({ id, position: { x: 40, y: 120 } }, dog, [blocker], id * 100)
		);
		const uniqueTargetKeys = new Set(targets.map((target) => `${Math.round(target.x / 8)}:${Math.round(target.y / 8)}`));

		expect(uniqueTargetKeys.size).toBeGreaterThanOrEqual(2);
	});

	it('벌집이 지정한 공격 역할은 bee id와 무관하게 유지한다', () => {
		expect(resolveBeeRole(1, 1, 'direct')).toBe('chaser');
		expect(resolveBeeRole(1, 1, 'flank-left')).toBe('flanker-left');
		expect(resolveBeeRole(1, 1, 'flank-right')).toBe('flanker-right');
		expect(resolveBeeRole(1, 1, 'breaker')).toBe('bruiser');
	});
});
