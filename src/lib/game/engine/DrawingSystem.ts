import { PHYSICS } from '../constants.js';
import { clamp, distance } from '../geometry.js';
import type { Point } from '../types.js';

export interface NoDrawZone {
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
}

const MIN_POINT_DISTANCE = 5;
const MAX_POINTS = 200;

export class DrawingSystem {
	private points: Point[] = [];
	private inkUsed = 0;
	private noDrawZones: NoDrawZone[] = [];

	constructor(private inkLimit: number = PHYSICS.defaultInkLimit) {}

	setNoDrawZones(zones: NoDrawZone[]): void {
		this.noDrawZones = zones;
	}

	start(point: Point): boolean {
		if (this.isSegmentInNoDrawZone(point, point)) {
			this.reset();
			return false;
		}
		this.points = [point];
		this.inkUsed = 0;
		return true;
	}

	move(point: Point): { accepted: boolean; exhausted: boolean } {
		const last = this.points.at(-1);
		if (!last) {
			return { accepted: this.start(point), exhausted: false };
		}

		// 금지 지형을 선분이 가로지르는 경우도 막아야 빠르게 드래그해 통과할 수 없다.
		if (this.isSegmentInNoDrawZone(last, point)) {
			return { accepted: false, exhausted: false };
		}

		const segmentLength = distance(last, point);
		if (segmentLength < MIN_POINT_DISTANCE) {
			return { accepted: false, exhausted: false };
		}

		const remaining = this.inkLimit - this.inkUsed;
		if (remaining <= 0) {
			return { accepted: false, exhausted: true };
		}

		if (segmentLength > remaining) {
			const ratio = remaining / segmentLength;
			const clampedPoint = {
				x: last.x + (point.x - last.x) * ratio,
				y: last.y + (point.y - last.y) * ratio
			};
				if (this.isSegmentInNoDrawZone(last, clampedPoint)) {
				return { accepted: false, exhausted: true };
			}
			this.points.push(clampedPoint);
			this.inkUsed = this.inkLimit;
			return { accepted: true, exhausted: true };
		}

		this.points.push(point);
		this.inkUsed += segmentLength;

		return {
			accepted: true,
			exhausted: this.points.length >= MAX_POINTS || this.inkUsed >= this.inkLimit
		};
	}

	private isSegmentInNoDrawZone(start: Point, end: Point): boolean {
		return this.noDrawZones.some((zone) => {
			const angle = zone.angle ?? 0;
			const startLocal = rotateAround(start, { x: zone.x, y: zone.y }, -angle);
			const endLocal = rotateAround(end, { x: zone.x, y: zone.y }, -angle);
			const halfWidth = zone.width / 2;
			const halfHeight = zone.height / 2;

			return segmentIntersectsAabb(startLocal, endLocal, {
				left: zone.x - halfWidth,
				right: zone.x + halfWidth,
				top: zone.y - halfHeight,
				bottom: zone.y + halfHeight
			});
		});
	}

	end(): Point[] {
		return [...this.points];
	}

	clearPreview(): void {
		this.points = [];
	}

	reset(): void {
		this.points = [];
		this.inkUsed = 0;
	}

	getPoints(): Point[] {
		return this.points;
	}

	getInkRatio(): number {
		return clamp((this.inkLimit - this.inkUsed) / this.inkLimit, 0, 1);
	}
}

function rotateAround(point: Point, center: Point, angle: number): Point {
	const dx = point.x - center.x;
	const dy = point.y - center.y;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos
	};
}

function segmentIntersectsAabb(
	start: Point,
	end: Point,
	box: { left: number; right: number; top: number; bottom: number }
): boolean {
	if (isInsideAabb(start, box) || isInsideAabb(end, box)) return true;

	const dx = end.x - start.x;
	const dy = end.y - start.y;
	let tMin = 0;
	let tMax = 1;

	for (const [origin, direction, minimum, maximum] of [
		[start.x, dx, box.left, box.right],
		[start.y, dy, box.top, box.bottom]
	] as const) {
		if (Math.abs(direction) < 0.0001) {
			if (origin < minimum || origin > maximum) return false;
			continue;
		}

		const t1 = (minimum - origin) / direction;
		const t2 = (maximum - origin) / direction;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
		if (tMin > tMax) return false;
	}

	return true;
}

function isInsideAabb(point: Point, box: { left: number; right: number; top: number; bottom: number }): boolean {
	return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}
