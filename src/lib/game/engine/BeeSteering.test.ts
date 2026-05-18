import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { createBeeDifficultyProfile } from './BeeDifficulty.js';
import { chooseBeeSteeringDirection, getAvoidanceVector, getWallFollowVector } from './BeeSteering.js';
import type { Point } from '../types.js';

function rectangle(x: number, y: number, width: number, height: number, label = 'drawing'): Matter.Body {
	return Matter.Bodies.rectangle(x, y, width, height, { label });
}

describe('BeeSteering', () => {
	it('장애물에 너무 가까우면 반대 방향 회피 벡터를 만든다', () => {
		const obstacle = rectangle(100, 100, 40, 40);
		const vector = getAvoidanceVector({ x: 72, y: 100 }, [obstacle]);

		expect(vector.x).toBeLessThan(0);
	});

	it('목표 직선이 막혔을 때 방어선 꼭짓점을 따라가는 방향을 섞는다', () => {
		const obstacle = rectangle(150, 100, 30, 120);
		const blockerFinder = (_start: Point, _end: Point, _blockers: Matter.Body[]) => obstacle;
		const direction = chooseBeeSteeringDirection({ x: 60, y: 100 }, { x: 240, y: 100 }, [obstacle], createBeeDifficultyProfile(16), blockerFinder);

		expect(Math.abs(direction.y)).toBeGreaterThan(0.05);
		expect(direction.x).toBeGreaterThan(0);
	});

	it('wall-follow 벡터는 목표에 유리한 방어선 끝점을 향한다', () => {
		const obstacle = rectangle(150, 100, 30, 120);
		const vector = getWallFollowVector({ x: 110, y: 100 }, { x: 240, y: 40 }, obstacle);

		expect(vector.x).toBeGreaterThanOrEqual(0);
		expect(vector.y).toBeLessThan(0);
	});
});
