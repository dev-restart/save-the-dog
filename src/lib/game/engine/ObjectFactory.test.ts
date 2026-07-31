import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';
import { ObjectFactory } from './ObjectFactory.js';

const size = { width: 390, height: 693 };

describe('ObjectFactory drawing bodies', () => {
	it('잉크로 만든 방어선은 형태를 유지하는 dynamic body로 생성된다', () => {
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

	it('렌더러가 처음 그린 경로를 그대로 다시 그릴 수 있도록 원본 경로를 보존한다', () => {
		const points = [
			{ x: 100, y: 100 },
			{ x: 180, y: 100 },
			{ x: 220, y: 150 }
		];
		const [drawing] = ObjectFactory.createDrawingSegments(points);
		const drawingPath = drawing.plugin.drawingPath as { x: number; y: number }[] | undefined;

		expect(drawingPath).toBeDefined();
		expect(drawingPath?.length).toBe(points.length);
		expect(drawing.plugin.drawingThickness).toBe(PHYSICS.drawingThickness);
	});

	it('시뮬레이션이 시작되면 잉크 방어선도 중력에 따라 떨어진다', () => {
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

describe('ObjectFactory obstacle bodies', () => {
	it('스테이지 구조용 wall은 보이는 벽돌 body로 생성한다', () => {
		const body = ObjectFactory.createObstacle({ type: 'wall', x: 195, y: 520, width: 24, height: 120 }, size);

		expect(body.label).toBe('brick');
		expect(body.isStatic).toBe(true);
		expect(body.isSensor).toBe(false);
	});

	it('폭탄은 강아지만 감지하는 센서 함정으로 생성한다', () => {
		const body = ObjectFactory.createObstacle({ type: 'bomb', x: 195, y: 520, width: 40, height: 40 }, size);

		expect(body.label).toBe('bomb');
		expect(body.isStatic).toBe(true);
		expect(body.isSensor).toBe(true);
	});

	it('굴림 바위는 선과 지형에 반응하는 dynamic 위험물로 생성한다', () => {
		const rollingBoulder = ObjectFactory.createObstacle({ type: 'rolling-boulder', x: 195, y: 300, width: 56, height: 56 }, size);
		const ice = ObjectFactory.createObstacle({ type: 'ice', x: 195, y: 520, width: 100, height: 18 }, size);
		const stone = ObjectFactory.createObstacle({ type: 'stone', x: 195, y: 520, width: 40, height: 120 }, size);

		expect(rollingBoulder.label).toBe('rolling-boulder');
		expect(rollingBoulder.isStatic).toBe(false);
		expect(rollingBoulder.isSensor).toBe(false);
		expect(ice.friction).toBeLessThan(stone.friction);
	});

	it('굴림 바위는 시뮬레이션 시작 후 중력을 받아 내려온다', () => {
		const engine = Matter.Engine.create();
		engine.gravity.y = PHYSICS.gravityY;
		const boulder = ObjectFactory.createObstacle({ type: 'rolling-boulder', x: 195, y: 180, width: 56, height: 56 }, size);
		const startY = boulder.position.y;

		Matter.Composite.add(engine.world, boulder);
		for (let index = 0; index < 20; index += 1) {
			Matter.Engine.update(engine, PHYSICS.fixedDeltaMs);
		}

		expect(boulder.position.y).toBeGreaterThan(startY);
	});
});
