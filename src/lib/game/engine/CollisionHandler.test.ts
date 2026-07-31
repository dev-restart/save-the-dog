import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';

import { setupCollisionEvents } from './CollisionHandler.js';
import { ObjectFactory } from './ObjectFactory.js';

describe('CollisionHandler', () => {
	it('폭탄 센서에 강아지가 닿으면 bomb 실패로 처리한다', () => {
		const engine = Matter.Engine.create();
		const dog = ObjectFactory.createDog({ x: 195, y: 520 }, { width: 390, height: 693 });
		const bomb = ObjectFactory.createObstacle({ type: 'bomb', x: 195, y: 520, width: 40, height: 40 }, { width: 390, height: 693 });
		const hits: string[] = [];
		const cleanup = setupCollisionEvents(engine, (hit) => hits.push(hit.reason));

		Matter.Composite.add(engine.world, [dog, bomb]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(hits).toEqual(['bomb']);
	});

	it.each(['acid', 'rolling-boulder'] as const)('%s에 강아지가 닿으면 실패로 처리한다', (hazardType) => {
		const engine = Matter.Engine.create();
		const dog = ObjectFactory.createDog({ x: 195, y: 520 }, { width: 390, height: 693 });
		const hazard = ObjectFactory.createObstacle(
			{ type: hazardType, x: 195, y: 520, width: 56, height: 56 },
			{ width: 390, height: 693 }
		);
		const hits: string[] = [];
		const cleanup = setupCollisionEvents(engine, (hit) => hits.push(hit.reason));

		Matter.Composite.add(engine.world, [dog, hazard]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(hits).toEqual([hazardType]);
	});
});
