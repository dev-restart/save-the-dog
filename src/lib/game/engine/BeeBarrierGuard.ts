import Matter from 'matter-js';
import { PHYSICS } from '../constants.js';
import type { Point } from '../types.js';

const BARRIER_REBOUND = 0.18;
const BARRIER_PADDING = 1.5;

export function rememberBeePositions(bees: Matter.Body[], positions: Map<number, Point>): void {
	for (const bee of bees) {
		positions.set(bee.id, { x: bee.position.x, y: bee.position.y });
	}
}

export function enforceBeeDrawingBarriers(
	bees: Matter.Body[],
	drawings: Matter.Body[],
	previousPositions: Map<number, Point>,
	beeRadius = PHYSICS.beeRadius
): void {
	if (bees.length === 0 || drawings.length === 0) return;

	const drawingParts = drawings.flatMap((drawing) => drawingPartsForCollision(drawing));
	if (drawingParts.length === 0) return;

	for (const bee of bees) {
		const previous = previousPositions.get(bee.id) ?? { x: bee.position.x, y: bee.position.y };
		const current = { x: bee.position.x, y: bee.position.y };
		const sweptHit = didSweepThroughBarrier(previous, current, drawingParts, beeRadius);
		const overlapping = Matter.Query.collides(bee, drawingParts).length > 0;

		if (!sweptHit && !overlapping) continue;

		// 빠른 벌이 한 프레임 사이에 얇은 선 반대편으로 넘어가는 tunnelling을 막기 위해
		// 물리 업데이트 직전 위치로 되돌리고, 방어선 방향 속도를 크게 줄인다.
		const rollback = getRollbackPoint(previous, current, beeRadius);
		Matter.Body.setPosition(bee, rollback);
		Matter.Body.setVelocity(bee, {
			x: -bee.velocity.x * BARRIER_REBOUND,
			y: -bee.velocity.y * BARRIER_REBOUND
		});

		if (Matter.Query.collides(bee, drawingParts).length > 0) {
			pushBeeOutOfBarrier(bee, drawingParts, beeRadius);
		}
	}
}

function drawingPartsForCollision(body: Matter.Body): Matter.Body[] {
	if (body.label !== 'drawing') return [];
	return body.parts.length > 1 ? body.parts.slice(1) : [body];
}

function didSweepThroughBarrier(start: Point, end: Point, barriers: Matter.Body[], beeRadius: number): boolean {
	const travel = Math.hypot(end.x - start.x, end.y - start.y);
	if (travel < 0.5) return false;

	return Matter.Query.ray(barriers, start, end, beeRadius * 2 + BARRIER_PADDING).length > 0;
}

function getRollbackPoint(start: Point, end: Point, beeRadius: number): Point {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const travel = Math.hypot(dx, dy);
	if (travel <= 0.001) return start;

	return {
		x: start.x - (dx / travel) * Math.max(beeRadius, 1),
		y: start.y - (dy / travel) * Math.max(beeRadius, 1)
	};
}

function pushBeeOutOfBarrier(bee: Matter.Body, barriers: Matter.Body[], beeRadius: number): void {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const collisions = Matter.Query.collides(bee, barriers);
		if (collisions.length === 0) return;

		const nearest = nearestBarrier(bee, barriers);
		const dx = bee.position.x - nearest.position.x;
		const dy = bee.position.y - nearest.position.y;
		const length = Math.hypot(dx, dy) || 1;
		Matter.Body.translate(bee, {
			x: (dx / length) * (beeRadius * 0.6 + attempt),
			y: (dy / length) * (beeRadius * 0.6 + attempt)
		});
	}
}

function nearestBarrier(bee: Matter.Body, barriers: Matter.Body[]): Matter.Body {
	let nearest = barriers[0];
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const barrier of barriers) {
		const d = Math.hypot(bee.position.x - barrier.position.x, bee.position.y - barrier.position.y);
		if (d < nearestDistance) {
			nearestDistance = d;
			nearest = barrier;
		}
	}
	return nearest;
}
