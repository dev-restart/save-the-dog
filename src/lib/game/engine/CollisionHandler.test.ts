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

	it('떨어지는 bomb이 고정 지형에 닿아도 즉시 기폭하지 않는다', () => {
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

		expect(detonations).toEqual([]);
	});

	it('drawing이 crate에 충돌하면 즉시 파괴용 damage event를 보낸다', () => {
		const engine = Matter.Engine.create();
		const crate = ObjectFactory.createObstacle(
			{ type: 'crate', x: 195, y: 300, width: 52, height: 52 },
			{ width: 390, height: 693 }
		);
		const [drawing] = ObjectFactory.createDrawingSegments([
			{ x: 160, y: 300 },
			{ x: 230, y: 300 }
		]);
		const damageEvents: string[] = [];
		const cleanup = setupCollisionEvents(engine, () => undefined, undefined, ({ reason, crateBody, sourceBody }) => {
			damageEvents.push(`${reason}:${crateBody.label}:${sourceBody.label}`);
		});

		Matter.Composite.add(engine.world, [crate, drawing]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(damageEvents).toEqual(['drawing-impact:crate:drawing']);
	});

	it('일반 bee는 crate damage event를 만들지 않고 breaker bee만 만든다', () => {
		const engine = Matter.Engine.create();
		engine.gravity.y = 0;
		const crate = ObjectFactory.createObstacle(
			{ type: 'crate', x: 195, y: 300, width: 52, height: 52 },
			{ width: 390, height: 693 }
		);
		const normalBee = ObjectFactory.createBee({ x: 180, y: 300 }, { width: 390, height: 693 }, 'direct');
		const breakerBee = ObjectFactory.createBee({ x: 210, y: 300 }, { width: 390, height: 693 }, 'breaker');
		const damageEvents: number[] = [];
		const cleanup = setupCollisionEvents(engine, () => undefined, undefined, ({ sourceBody }) => {
			damageEvents.push(sourceBody.id);
		});

		Matter.Composite.add(engine.world, [crate, normalBee, breakerBee]);
		Matter.Engine.update(engine, 1000 / 60);
		cleanup();

		expect(damageEvents).toEqual([breakerBee.id]);
	});
});
