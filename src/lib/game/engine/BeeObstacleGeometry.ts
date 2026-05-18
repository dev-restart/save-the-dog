import Matter from 'matter-js';

import { clamp, distance } from '../geometry.js';
import type { Point } from '../types.js';

export function projectionRatio(point: Point, start: Point, end: Point): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return 0;

	return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
}

export function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
	const ratio = clamp(projectionRatio(point, start, end), 0, 1);
	return distance(point, {
		x: start.x + (end.x - start.x) * ratio,
		y: start.y + (end.y - start.y) * ratio
	});
}

export function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
	const ratio = clamp(projectionRatio(point, start, end), 0, 1);
	return {
		x: start.x + (end.x - start.x) * ratio,
		y: start.y + (end.y - start.y) * ratio
	};
}

export function closestPointOnBody(point: Point, body: Matter.Body): Point {
	if (body.vertices.length === 0) return body.position;
	if (pointInPolygon(point, body.vertices)) return body.position;

	let closest = body.vertices[0] ?? body.position;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < body.vertices.length; index += 1) {
		const start = body.vertices[index];
		const end = body.vertices[(index + 1) % body.vertices.length];
		const candidate = closestPointOnSegment(point, start, end);
		const candidateDistance = distance(point, candidate);
		if (candidateDistance < closestDistance) {
			closest = candidate;
			closestDistance = candidateDistance;
		}
	}

	return closest;
}

export function pointToBodyDistance(point: Point, body: Matter.Body): number {
	if (body.vertices.length === 0) return distance(point, body.position);
	if (pointInPolygon(point, body.vertices)) return 0;

	let shortest = Number.POSITIVE_INFINITY;
	for (let index = 0; index < body.vertices.length; index += 1) {
		const start = body.vertices[index];
		const end = body.vertices[(index + 1) % body.vertices.length];
		shortest = Math.min(shortest, pointToSegmentDistance(point, start, end));
	}
	return shortest;
}

export function bodyToSegmentDistance(body: Matter.Body, start: Point, end: Point): number {
	if (body.vertices.length === 0) return pointToSegmentDistance(body.position, start, end);
	if (pointInPolygon(start, body.vertices) || pointInPolygon(end, body.vertices)) return 0;

	let shortest = Number.POSITIVE_INFINITY;
	for (let index = 0; index < body.vertices.length; index += 1) {
		const a = body.vertices[index];
		const b = body.vertices[(index + 1) % body.vertices.length];
		if (segmentsIntersect(start, end, a, b)) return 0;
		shortest = Math.min(
			shortest,
			pointToSegmentDistance(a, start, end),
			pointToSegmentDistance(start, a, b),
			pointToSegmentDistance(end, a, b)
		);
	}

	return shortest;
}

export function pointInPolygon(point: Point, vertices: Matter.Vector[]): boolean {
	let inside = false;
	for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
		const current = vertices[index];
		const last = vertices[previous];
		const intersects =
			current.y > point.y !== last.y > point.y &&
			point.x < ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) + current.x;
		if (intersects) inside = !inside;
	}
	return inside;
}

export function segmentOverlapsBounds(start: Point, end: Point, bounds: Matter.Bounds, padding: number): boolean {
	const minX = Math.min(start.x, end.x);
	const maxX = Math.max(start.x, end.x);
	const minY = Math.min(start.y, end.y);
	const maxY = Math.max(start.y, end.y);

	return (
		maxX >= bounds.min.x - padding &&
		minX <= bounds.max.x + padding &&
		maxY >= bounds.min.y - padding &&
		minY <= bounds.max.y + padding
	);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
	const abC = orientation(a, b, c);
	const abD = orientation(a, b, d);
	const cdA = orientation(c, d, a);
	const cdB = orientation(c, d, b);

	if (abC === 0 && onSegment(a, c, b)) return true;
	if (abD === 0 && onSegment(a, d, b)) return true;
	if (cdA === 0 && onSegment(c, a, d)) return true;
	if (cdB === 0 && onSegment(c, b, d)) return true;
	return abC !== abD && cdA !== cdB;
}

function orientation(a: Point, b: Point, c: Point): number {
	const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
	if (Math.abs(value) < 0.0001) return 0;
	return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
	return (
		b.x <= Math.max(a.x, c.x) &&
		b.x >= Math.min(a.x, c.x) &&
		b.y <= Math.max(a.y, c.y) &&
		b.y >= Math.min(a.y, c.y)
	);
}
