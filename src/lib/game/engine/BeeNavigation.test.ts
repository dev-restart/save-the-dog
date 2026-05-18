import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { createBeeDifficultyProfile } from './BeeDifficulty.js';
import { BeeNavigation } from './BeeNavigation.js';
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

	it('경로 캐시가 살아있는 동안 같은 벌은 같은 경유점을 재사용한다', () => {
		const navigation = new BeeNavigation(size, createBeeDifficultyProfile(12), 12);
		const blocker = rectangle(160, 120, 36, 150);
		const bee = { id: 77, position: { x: 40, y: 120 } };
		const first = navigation.chooseTarget(bee, { x: 280, y: 120 }, [blocker], 100);
		const second = navigation.chooseTarget(bee, { x: 282, y: 122 }, [blocker], 120);

		expect(second).toEqual(first);
	});
});
