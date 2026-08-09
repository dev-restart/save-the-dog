import Matter from 'matter-js';
import { PHYSICS } from '../constants.js';
import { closestPointOnSegment, pointInPolygon } from './BeeObstacleGeometry.js';
import type { Point } from '../types.js';

const BARRIER_REBOUND = 0.18;
const BARRIER_PADDING = 6;
const CLOSED_PATH_MIN_POINTS = 3;

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
	const closedDrawings = drawings.filter(isClosedDrawing);

	for (const bee of bees) {
		const previous = previousPositions.get(bee.id) ?? { x: bee.position.x, y: bee.position.y };
		const current = { x: bee.position.x, y: bee.position.y };
		const containingDrawing = closedDrawings.find((drawing) => isPointInsideClosedDrawing(current, drawing));
		if (containingDrawing) {
			// 벌이 선을 통째로 건너뛰었거나 생성 시점부터 선 안에 있으면
			// 선 조각과 직접 겹치지 않아도 닫힌 방어선 밖으로 꺼낸다.
			Matter.Body.setPosition(bee, movePointOutsideClosedDrawing(current, containingDrawing));
			Matter.Body.setVelocity(bee, {
				x: -bee.velocity.x * BARRIER_REBOUND,
				y: -bee.velocity.y * BARRIER_REBOUND
			});
			continue;
		}
		const sweptHit = didSweepThroughBarrier(previous, current, drawingParts, beeRadius);
		const overlapping = Matter.Query.collides(bee, drawingParts).length > 0;
		const crossedClosedPath = closedDrawings.some((drawing) => {
			const previousInside = isPointInsideClosedDrawing(previous, drawing);
			const currentInside = isPointInsideClosedDrawing(current, drawing);
			return previousInside !== currentInside;
		});

		if (!sweptHit && !overlapping && !crossedClosedPath) continue;

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

export function isBeeSeparatedFromDogByDrawing(
	bee: Matter.Body,
	dogBody: Matter.Body,
	drawings: Matter.Body[],
	beeRadius = PHYSICS.beeRadius,
	previousPosition?: Point
): boolean {
	if (drawings.length === 0) return false;

	const drawingParts = drawings.flatMap((drawing) => drawingPartsForCollision(drawing));
	if (drawingParts.length === 0) return false;

	const rayWidth = beeRadius * 2 + BARRIER_PADDING;
	const origins = previousPosition ? [bee.position, previousPosition] : [bee.position];

	if (
		drawings.some((drawing) => {
			if (!isClosedDrawing(drawing)) return false;
			const dogInside = isPointInsideClosedDrawing(dogBody.position, drawing);
			return origins.some((origin) => isPointInsideClosedDrawing(origin, drawing) !== dogInside);
		})
	) {
		return true;
	}

	return origins.some((origin) => Matter.Query.ray(drawingParts, origin, dogBody.position, rayWidth).length > 0);
}

export function isPointInsideClosedDrawing(point: Point, drawing: Matter.Body): boolean {
	const path = getWorldDrawingPath(drawing);
	return path.length >= CLOSED_PATH_MIN_POINTS && isClosedPath(path) && pointInPolygon(point, path);
}

export function movePointOutsideClosedDrawing(
	point: Point,
	drawing: Matter.Body,
	clearance = PHYSICS.beeRadius + PHYSICS.drawingThickness / 2 + BARRIER_PADDING
): Point {
	if (!isPointInsideClosedDrawing(point, drawing)) return point;

	const path = getWorldDrawingPath(drawing);
	let closest = path[0] ?? point;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (let index = 1; index < path.length; index += 1) {
		const candidate = closestPointOnSegment(point, path[index - 1], path[index]);
		const candidateDistance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
		if (candidateDistance < closestDistance) {
			closest = candidate;
			closestDistance = candidateDistance;
		}
	}

	const dx = point.x - closest.x;
	const dy = point.y - closest.y;
	const length = Math.hypot(dx, dy) || 1;
	return {
		x: closest.x - (dx / length) * clearance,
		y: closest.y - (dy / length) * clearance
	};
}

export function enforceDogDrawingContainment(
	dog: Matter.Body,
	drawings: Matter.Body[],
	previousPosition: Point,
	clearance = PHYSICS.dogRadius + PHYSICS.drawingThickness / 2 + BARRIER_PADDING,
	containedDrawingIds?: Set<number>
): boolean {
	const current = { x: dog.position.x, y: dog.position.y };
	for (const drawing of drawings) {
		if (!isClosedDrawing(drawing)) continue;
		const wasInside = isPointInsideClosedDrawing(previousPosition, drawing);
		const remainsContained = containedDrawingIds?.has(drawing.id) ?? false;
		if ((!wasInside && !remainsContained) || isPointInsideClosedDrawing(current, drawing)) continue;

		Matter.Body.setPosition(dog, movePointInsideClosedDrawing(current, drawing, clearance));
		Matter.Body.setVelocity(dog, {
			x: dog.velocity.x * 0.08,
			y: dog.velocity.y * 0.08
		});
		return true;
	}
	return false;
}

export function movePointInsideClosedDrawing(point: Point, drawing: Matter.Body, clearance: number): Point {
	if (isPointInsideClosedDrawing(point, drawing)) return point;

	const path = getWorldDrawingPath(drawing);
	const center = averagePoint(path);
	if (!center) return point;

	let outsideRatio = 0;
	let insideRatio = 1;
	for (let attempt = 0; attempt < 14; attempt += 1) {
		const ratio = (outsideRatio + insideRatio) / 2;
		const candidate = interpolate(point, center, ratio);
		if (isPointInsideClosedDrawing(candidate, drawing)) insideRatio = ratio;
		else outsideRatio = ratio;
	}

	const boundary = interpolate(point, center, insideRatio);
	const centerDistance = Math.hypot(center.x - boundary.x, center.y - boundary.y);
	const inwardRatio = centerDistance <= 0.001 ? 1 : Math.min(0.45, clearance / centerDistance);
	return interpolate(boundary, center, inwardRatio);
}

function drawingPartsForCollision(body: Matter.Body): Matter.Body[] {
	if (body.label !== 'drawing') return [];
	return body.parts.length > 1 ? body.parts.slice(1) : [body];
}

function isClosedDrawing(body: Matter.Body): boolean {
	const path = getWorldDrawingPath(body);
	return path.length >= CLOSED_PATH_MIN_POINTS && isClosedPath(path);
}

function isClosedPath(path: Point[]): boolean {
	const first = path[0];
	const last = path.at(-1);
	return Boolean(first && last && Math.hypot(first.x - last.x, first.y - last.y) <= 0.5);
}

function getWorldDrawingPath(body: Matter.Body): Point[] {
	const plugin = body.plugin as { drawingPath?: Point[] } | undefined;
	const localPath = plugin?.drawingPath;
	if (!localPath || localPath.length === 0) return [];

	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	return localPath.map((point) => ({
		x: body.position.x + point.x * cos - point.y * sin,
		y: body.position.y + point.x * sin + point.y * cos
	}));
}

function averagePoint(points: Point[]): Point | null {
	if (points.length === 0) return null;
	const total = points.reduce((result, point) => ({ x: result.x + point.x, y: result.y + point.y }), { x: 0, y: 0 });
	return { x: total.x / points.length, y: total.y / points.length };
}

function interpolate(start: Point, end: Point, ratio: number): Point {
	return {
		x: start.x + (end.x - start.x) * ratio,
		y: start.y + (end.y - start.y) * ratio
	};
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
