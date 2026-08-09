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

	it('boulder에 강아지가 닿으면 실패로 처리한다', () => {
		const engine = Matter.Engine.create();
		const dog = ObjectFactory.createDog({ x: 195, y: 520 }, { width: 390, height: 693 });
		const boulder = ObjectFactory.createObstacle(
			{ type: 'boulder', x: 195, y: 520, width: 56, height: 56 },
			{ width: 390, height: 693 }
		);
		const hits: string[] = [];
		const cleanup = setupCollisionEvents(engine, (hit) => hits.push(hit.reason));

		Matter.Composite.add(engine.world, [dog, boulder]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(hits).toEqual(['boulder']);
	});

	it('boulder가 bomb에 닿으면 폭탄 기폭 이벤트를 보낸다', () => {
		const engine = Matter.Engine.create();
		const boulder = ObjectFactory.createObstacle(
			{ type: 'boulder', x: 195, y: 520, width: 56, height: 56 },
			{ width: 390, height: 693 }
		);
		const bomb = ObjectFactory.createObstacle(
			{ type: 'bomb', x: 195, y: 520, width: 40, height: 40 },
			{ width: 390, height: 693 }
		);
		const detonations: string[] = [];
		const cleanup = setupCollisionEvents(engine, () => undefined, ({ bombBody, triggerBody }) => {
			detonations.push(`${bombBody.label}:${triggerBody.label}`);
		});

		Matter.Composite.add(engine.world, [boulder, bomb]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(detonations).toEqual(['bomb:boulder']);
	});

	it('떨어지는 bomb이 고정 지형에 닿아도 폭탄 기폭 이벤트를 한 번 보낸다', () => {
		const engine = Matter.Engine.create();
		const bomb = ObjectFactory.createObstacle(
			{ type: 'bomb', x: 195, y: 520, width: 40, height: 40 },
			{ width: 390, height: 693 }
		);
		const terrain = ObjectFactory.createObstacle(
			{ type: 'terrain-block', x: 195, y: 520, width: 70, height: 70 },
			{ width: 390, height: 693 }
		);
		const detonations: string[] = [];
		const cleanup = setupCollisionEvents(engine, () => undefined, ({ bombBody, triggerBody }) => {
			detonations.push(`${bombBody.label}:${triggerBody.label}`);
		});

		Matter.Composite.add(engine.world, [bomb, terrain]);
		Matter.Engine.update(engine, 1000 / 60);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(detonations).toEqual(['bomb:terrain-block']);
	});
});
