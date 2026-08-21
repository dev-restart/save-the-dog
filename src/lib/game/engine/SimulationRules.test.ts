import Matter from 'matter-js';
import { describe, expect, it, vi } from 'vitest';

import { PHYSICS } from '../constants.js';
import {
	advanceBombFuses,
	consumeBombFuse,
	createBombFuseState,
	selectBombBlastTargets,
	selectBombCollision
} from './SimulationRules.js';

describe('shared simulation bomb rules', () => {
	it('방어선과 굴림돌은 즉시 기폭시키고 고정 지형은 퓨즈를 유지한다', () => {
		const bomb = Matter.Bodies.circle(100, 100, 20, { label: 'bomb' });
		const drawing = Matter.Bodies.rectangle(100, 100, 40, 10, { label: 'drawing' });
		const boulder = Matter.Bodies.circle(100, 100, 24, { label: 'rolling-boulder' });
		const ground = Matter.Bodies.rectangle(100, 100, 80, 20, { label: 'ground' });

		expect(selectBombCollision(bomb, drawing)).toEqual({ bombBody: bomb, triggerBody: drawing });
		expect(selectBombCollision(boulder, bomb)).toEqual({ bombBody: bomb, triggerBody: boulder });
		expect(selectBombCollision(bomb, ground)).toBeNull();
	});

	it('퓨즈 임계 시점에 한 번만 기폭하고 월드에서 사라진 폭탄 상태를 정리한다', () => {
		const engine = Matter.Engine.create();
		const firstBomb = Matter.Bodies.circle(100, 100, 20, { label: 'bomb' });
		const removedBomb = Matter.Bodies.circle(200, 100, 20, { label: 'bomb' });
		const fuses = createBombFuseState([firstBomb, removedBomb]);
		const onDetonated = vi.fn((bomb: Matter.Body) => consumeBombFuse(fuses, bomb));
		Matter.Composite.add(engine.world, firstBomb);

		advanceBombFuses(engine.world, fuses, PHYSICS.bombFuseMs - 1, onDetonated);
		expect(onDetonated).not.toHaveBeenCalled();
		expect(fuses.has(removedBomb.id)).toBe(false);

		advanceBombFuses(engine.world, fuses, 1, onDetonated);
		advanceBombFuses(engine.world, fuses, PHYSICS.bombFuseMs, onDetonated);
		expect(onDetonated).toHaveBeenCalledOnce();
		expect(fuses.size).toBe(0);
	});

	it('폭발 반경은 client와 replay 모두 원형 body의 실제 반지름을 사용한다', () => {
		const bomb = Matter.Bodies.circle(0, 0, 20, { label: 'bomb' });
		const dogInside = Matter.Bodies.circle(PHYSICS.bombBlastRadius, 0, 20, { label: 'dog' });
		const circleAtEdge = Matter.Bodies.circle(PHYSICS.bombBlastRadius + 20, 0, 20, { label: 'drawing' });
		const circleOutside = Matter.Bodies.circle(PHYSICS.bombBlastRadius + 21, 0, 20, { label: 'drawing' });
		const unrelated = Matter.Bodies.circle(0, 0, 20, { label: 'bee' });

		const blast = selectBombBlastTargets([circleAtEdge, circleOutside, unrelated], bomb, dogInside);

		expect(blast.hitsDog).toBe(true);
		expect(blast.destroyedBodies).toEqual([circleAtEdge]);
	});
});
