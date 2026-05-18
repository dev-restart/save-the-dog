import { BASE_WORLD, type CanvasSize, type Point } from './types.js';

export function scalePoint(point: Point, size: CanvasSize): Point {
	return {
		x: (point.x / BASE_WORLD.width) * size.width,
		y: (point.y / BASE_WORLD.height) * size.height
	};
}

export function scaleLengthX(value: number, size: CanvasSize): number {
	return (value / BASE_WORLD.width) * size.width;
}

export function scaleLengthY(value: number, size: CanvasSize): number {
	return (value / BASE_WORLD.height) * size.height;
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, ratio: number): number {
	return start + (end - start) * ratio;
}

export function normalizeVector(x: number, y: number): Point {
	const length = Math.hypot(x, y);
	if (length === 0) return { x: 0, y: 0 };
	return { x: x / length, y: y / length };
}
