import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { COLLISION_CATEGORY, PHYSICS } from '../constants.js';
import { enforceBeeDrawingBarriers, rememberBeePositions } from './BeeBarrierGuard.js';

function createBee(x: number, y: number): Matter.Body {
	return Matter.Bodies.circle(x, y, PHYSICS.beeRadius, {
		label: 'bee',
		collisionFilter: {
			category: COLLISION_CATEGORY.bee,
			mask: COLLISION_CATEGORY.drawing
		}
	});
}

function createDrawingWall(): Matter.Body {
	return Matter.Bodies.rectangle(100, 100, 16, 120, {
		label: 'drawing',
		collisionFilter: {
			category: COLLISION_CATEGORY.drawing,
			mask: COLLISION_CATEGORY.bee
		}
	});
}

describe('BeeBarrierGuard', () => {
	it('빠른 벌이 한 프레임 사이에 그린 방어선을 통과하지 못하게 되돌린다', () => {
		const bee = createBee(70, 100);
		const drawing = createDrawingWall();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		Matter.Body.setPosition(bee, { x: 130, y: 100 });
		Matter.Body.setVelocity(bee, { x: 20, y: 0 });
		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x).toBeLessThan(100 - PHYSICS.beeRadius);
		expect(bee.velocity.x).toBeLessThanOrEqual(0);
	});

	it('방어선과 만나지 않는 벌은 위치를 바꾸지 않는다', () => {
		const bee = createBee(70, 40);
		const drawing = createDrawingWall();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		Matter.Body.setPosition(bee, { x: 85, y: 40 });
		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x).toBeCloseTo(85);
		expect(bee.position.y).toBeCloseTo(40);
	});
});
