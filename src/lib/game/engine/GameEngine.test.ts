import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';

import { getStage } from '../stages/index.js';
import { PHYSICS } from '../constants.js';
import { ObjectFactory } from './ObjectFactory.js';
import { advanceBombFuses, createDrawingBlockedZones } from './GameEngine.js';

describe('GameEngine drawing-blocked terrain', () => {
	it('레벨 24의 고정 지형과 웅덩이는 드로잉 금지 영역으로 만들고 굴림돌은 제외한다', () => {
		const stage = getStage(24);
		const zones = createDrawingBlockedZones(stage.obstacles, { width: 390, height: 693 });

		for (const expected of [
			{ x: 108, y: 512 },
			{ x: 222, y: 590 },
			{ x: 150, y: 370, angle: -0.24 },
			{ x: 88, y: 632 },
			{ x: 302, y: 632 }
		]) {
			expect(
				zones.some(
					(zone) =>
						Math.abs(zone.x - expected.x) < 0.001 &&
						Math.abs(zone.y - expected.y) < 0.001 &&
						(expected.angle === undefined || zone.angle === expected.angle)
				)
			).toBe(true);
		}
		expect(zones.some((zone) => Math.abs(zone.x - 186) < 0.001 && Math.abs(zone.y - 304) < 0.001)).toBe(false);
	});

	it('드로잉 금지 영역은 캔버스 크기에 맞춰 좌표와 충돌 여백을 함께 확장한다', () => {
		const zones = createDrawingBlockedZones(
			[{ type: 'terrain-block', x: 100, y: 200, width: 40, height: 40 }],
			{ width: 195, height: 346.5 }
		);

		expect(zones[0]?.x).toBeCloseTo(50);
		expect(zones[0]?.y).toBeCloseTo(100);
		expect(zones[0]?.width).toBeCloseTo(30);
		expect(zones[0]?.height).toBeCloseTo(30);
	});

	it('폭탄 퓨즈는 드로잉 완료 뒤 시뮬레이션이 전달한 시간만 누적해 기폭한다', () => {
		const engine = Matter.Engine.create();
		const bomb = ObjectFactory.createObstacle(
			{ type: 'bomb', x: 195, y: 180, width: 40, height: 40 },
			{ width: 390, height: 693 }
		);
		const fuses = new Map([[bomb.id, 0]]);
		const detonated: number[] = [];
		Matter.Composite.add(engine.world, bomb);

		advanceBombFuses(engine.world, fuses, PHYSICS.bombFuseMs - 1, (body) => {
			detonated.push(body.id);
			fuses.delete(body.id);
		});
		expect(detonated).toEqual([]);

		advanceBombFuses(engine.world, fuses, 1, (body) => {
			detonated.push(body.id);
			fuses.delete(body.id);
		});
		expect(detonated).toEqual([bomb.id]);
	});
});
