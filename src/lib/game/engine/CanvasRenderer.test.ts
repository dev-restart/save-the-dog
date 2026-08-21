import Matter from 'matter-js';
import { describe, expect, it, vi } from 'vitest';

import { CanvasRenderer, isTerrainTopExposed } from './CanvasRenderer.js';

function terrain(x: number, y: number, width: number, height: number, angle = 0): Matter.Body {
	return Matter.Bodies.rectangle(x, y, width, height, { label: 'terrain-block', angle, isStatic: true });
}

describe('connected terrain rendering', () => {
	it('위아래로 붙은 지형은 내부 연결면의 잔디 상단을 숨긴다', () => {
		const upper = terrain(100, 70, 60, 60);
		const lower = terrain(100, 130, 60, 60);

		expect(isTerrainTopExposed(upper, [upper, lower])).toBe(true);
		expect(isTerrainTopExposed(lower, [upper, lower])).toBe(false);
	});

	it('옆으로 붙거나 기울어진 지형의 실제 외곽 상단은 유지한다', () => {
		const left = terrain(70, 100, 60, 60);
		const right = terrain(130, 100, 60, 60);
		const slope = terrain(210, 100, 100, 30, 0.2);

		expect(isTerrainTopExposed(left, [left, right, slope])).toBe(true);
		expect(isTerrainTopExposed(right, [left, right, slope])).toBe(true);
		expect(isTerrainTopExposed(slope, [left, right, slope])).toBe(true);
	});

	it('world clear는 caller가 담당하므로 renderer는 clearRect를 호출하지 않는다', () => {
		const renderer = new CanvasRenderer('classic', 'meadow') as unknown as {
			draw: CanvasRenderer['draw'];
			drawBackground: () => void;
			drawBody: () => void;
			drawDrawingPreview: () => void;
			drawExplosions: () => void;
		};
		renderer.drawBackground = () => undefined;
		renderer.drawBody = () => undefined;
		renderer.drawDrawingPreview = () => undefined;
		renderer.drawExplosions = () => undefined;

		const clearRect = vi.fn();
		const ctx = {
			canvas: { clientWidth: 390, clientHeight: 693, width: 390, height: 693 },
			clearRect
		} as unknown as CanvasRenderingContext2D;
		const engine = Matter.Engine.create();

		renderer.draw(ctx, engine.world, 'ready', [], 1, 0, { width: 390, height: 693 });

		expect(clearRect).not.toHaveBeenCalled();
	});
});
