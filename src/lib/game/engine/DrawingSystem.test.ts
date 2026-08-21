import { describe, expect, it } from 'vitest';

import { DrawingSystem } from './DrawingSystem.js';

describe('DrawingSystem', () => {
	it('금지 지형 내부에서는 드로잉을 시작할 수 없다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{ x: 100, y: 100, width: 60, height: 60 }]);

		expect(drawing.start({ x: 100, y: 100 })).toBe(false);
		expect(drawing.getPoints()).toEqual([]);
	});

	it('빠른 드래그로 금지 영역을 건너뛰어도 선을 만들지 않는다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{ x: 100, y: 100, width: 40, height: 40 }]);
		drawing.start({ x: 40, y: 100 });

		expect(drawing.move({ x: 160, y: 100 })).toEqual({ accepted: false, exhausted: false });
		expect(drawing.end()).toEqual([{ x: 40, y: 100 }]);
	});

	it('회전된 금지 지형도 화면에 보이는 각도와 같은 영역을 차단한다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{ x: 100, y: 100, width: 20, height: 80, angle: Math.PI / 2 }]);
		drawing.start({ x: 100, y: 40 });

		expect(drawing.move({ x: 100, y: 160 }).accepted).toBe(false);
	});

	it('45도 지형의 보이는 면은 차단하고 회전 사각형 바깥 모서리는 허용한다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{ x: 100, y: 100, width: 80, height: 20, angle: Math.PI / 4 }]);

		expect(drawing.start({ x: 121, y: 121 })).toBe(false);
		expect(drawing.start({ x: 125, y: 100 })).toBe(true);
	});

	it('polygon 지형의 실제 면은 막고 bounding box 안의 빈 공간은 허용한다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{
			x: 100, y: 100, width: 100, height: 100,
			vertices: [{ x: 50, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 50 }]
		}]);

		expect(drawing.start({ x: 130, y: 100 })).toBe(false);
		expect(drawing.start({ x: 60, y: 60 })).toBe(true);
	});

	it('collinear 이지만 떨어진 polygon edge는 교차로 오인하지 않는다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{
			x: 100,
			y: 100,
			width: 80,
			height: 80,
			vertices: [
				{ x: 90, y: 90 },
				{ x: 110, y: 90 },
				{ x: 110, y: 110 },
				{ x: 90, y: 110 }
			]
		}]);

		expect(drawing.start({ x: 30, y: 90 })).toBe(true);
		expect(drawing.move({ x: 70, y: 90 })).toEqual({ accepted: true, exhausted: false });
	});

	it('polygon edge와 끝점이 닿거나 겹치면 계속 차단한다', () => {
		const drawing = new DrawingSystem(600);
		drawing.setNoDrawZones([{
			x: 100,
			y: 100,
			width: 80,
			height: 80,
			vertices: [
				{ x: 90, y: 90 },
				{ x: 110, y: 90 },
				{ x: 110, y: 110 },
				{ x: 90, y: 110 }
			]
		}]);

		expect(drawing.start({ x: 30, y: 90 })).toBe(true);
		expect(drawing.move({ x: 90, y: 90 })).toEqual({ accepted: false, exhausted: false });
		drawing.reset();
		expect(drawing.start({ x: 30, y: 100 })).toBe(true);
		expect(drawing.move({ x: 120, y: 100 })).toEqual({ accepted: false, exhausted: false });
	});
});
