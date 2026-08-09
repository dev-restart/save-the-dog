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
});
