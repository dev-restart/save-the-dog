import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';
import { ObjectFactory } from './ObjectFactory.js';

const size = { width: 390, height: 693 };

describe('ObjectFactory drawing bodies', () => {
	it('잉크로 만든 블록은 중력과 충돌에 반응하는 동적 body로 생성된다', () => {
		const bodies = ObjectFactory.createDrawingSegments([
			{ x: 100, y: 100 },
			{ x: 180, y: 100 },
			{ x: 220, y: 150 }
		]);

		expect(bodies.length).toBeGreaterThan(0);
		expect(bodies.every((body) => body.label === 'drawing')).toBe(true);
		expect(bodies.every((body) => body.isStatic === false)).toBe(true);
		expect(bodies.every((body) => body.isSensor === false)).toBe(true);
		expect(bodies.every((body) => body.mass < Number.POSITIVE_INFINITY)).toBe(true);
	});

	it('연속된 잉크 조각은 하나의 강체 블록으로 묶여 형태를 유지한다', () => {
		const bodies = ObjectFactory.createDrawingSegments([
			{ x: 100, y: 100 },
			{ x: 180, y: 100 },
			{ x: 220, y: 150 }
		]);

		expect(bodies).toHaveLength(1);
		expect(bodies[0].parts.length).toBeGreaterThan(2);
	});

	it('시뮬레이션이 시작되면 잉크 블록이 중력 방향으로 떨어진다', () => {
		const engine = Matter.Engine.create();
		engine.gravity.y = PHYSICS.gravityY;
		const [drawing] = ObjectFactory.createDrawingSegments([
			{ x: 120, y: 120 },
			{ x: 200, y: 120 }
		]);
		Matter.Composite.add(engine.world, drawing);
		const startY = drawing.position.y;

		for (let index = 0; index < 20; index += 1) {
			Matter.Engine.update(engine, PHYSICS.fixedDeltaMs);
		}

		expect(drawing.position.y).toBeGreaterThan(startY);
	});
});
