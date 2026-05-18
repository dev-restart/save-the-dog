import { PHYSICS } from '../constants.js';
import { clamp, distance } from '../geometry.js';
import type { Point } from '../types.js';

const MIN_POINT_DISTANCE = 5;
const MAX_POINTS = 200;

export class DrawingSystem {
	private points: Point[] = [];
	private inkUsed = 0;

	constructor(private inkLimit: number = PHYSICS.defaultInkLimit) {}

	start(point: Point): void {
		this.points = [point];
		this.inkUsed = 0;
	}

	move(point: Point): { accepted: boolean; exhausted: boolean } {
		const last = this.points.at(-1);
		if (!last) {
			this.start(point);
			return { accepted: true, exhausted: false };
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
			this.points.push({
				x: last.x + (point.x - last.x) * ratio,
				y: last.y + (point.y - last.y) * ratio
			});
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
