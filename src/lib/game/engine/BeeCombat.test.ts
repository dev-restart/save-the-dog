import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';

import { createBeeDifficultyProfile } from './BeeDifficulty.js';
import { BeeCombat } from './BeeCombat.js';
import { ObjectFactory } from './ObjectFactory.js';

describe('BeeCombat', () => {
	it('벌이 충돌해도 완성된 방어선의 위치와 회전을 바꾸지 않는다', () => {
		const engine = Matter.Engine.create();
		const [drawing] = ObjectFactory.createDrawingSegments([
			{ x: 80, y: 100 },
			{ x: 180, y: 100 }
		]);
		const bee = Matter.Bodies.circle(120, 100, 8, { label: 'bee' });
		const dog = Matter.Bodies.circle(160, 150, 20, { label: 'dog' });
		const combat = new BeeCombat(engine.world, createBeeDifficultyProfile(20));
		const start = { x: drawing.position.x, y: drawing.position.y, angle: drawing.angle };

		Matter.Composite.add(engine.world, [drawing, bee, dog]);
		const attacked = combat.attackDrawings(bee, dog, [drawing], 1000);

		expect(attacked).toBe(true);
		expect(drawing.position.x).toBeCloseTo(start.x);
		expect(drawing.position.y).toBeCloseTo(start.y);
		expect(drawing.angle).toBeCloseTo(start.angle);
		expect(Matter.Composite.allBodies(engine.world)).toContain(drawing);
	});
});
