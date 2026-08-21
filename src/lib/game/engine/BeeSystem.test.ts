import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';

import { BeeSystem, navigationBodyParts } from './BeeSystem.js';
import type { BeeBodyPlugin } from './ObjectFactory.js';
import { ObjectFactory } from './ObjectFactory.js';

describe('BeeSystem bee metadata', () => {
	it('spawn한 벌 body에 벌집의 attackStyle을 기록한다', () => {
		const engine = Matter.Engine.create();
		const beeSystem = new BeeSystem(
			[
				{ x: 80, y: 80, beeCount: 1, spawnIntervalMs: 1, attackStyle: 'direct' },
				{ x: 300, y: 80, beeCount: 1, spawnIntervalMs: 1, attackStyle: 'breaker' }
			],
			engine.world,
			{ width: 390, height: 693 }
		);
		const dog = ObjectFactory.createDog({ x: 195, y: 520 }, { width: 390, height: 693 });

		beeSystem.start();
		beeSystem.update(1, dog);

		expect(beeSystem.getBees().map((bee) => (bee.plugin as BeeBodyPlugin).attackStyle)).toEqual(['direct', 'breaker']);
		beeSystem.destroy();
	});

	it('compound terrain은 navigation에서 실제 part를 사용한다', () => {
		const left = Matter.Bodies.rectangle(80, 100, 20, 80, { label: 'terrain-block' });
		const right = Matter.Bodies.rectangle(140, 100, 20, 80, { label: 'terrain-block' });
		const cap = Matter.Bodies.rectangle(110, 60, 80, 20, { label: 'terrain-block' });
		const compound = Matter.Body.create({
			label: 'terrain-block',
			parts: [left, right, cap]
		});

		const parts = navigationBodyParts(compound);

		expect(parts).toHaveLength(3);
		expect(parts).not.toContain(compound);
		expect(parts.map((part) => part.label)).toEqual(['terrain-block', 'terrain-block', 'terrain-block']);
	});
});
