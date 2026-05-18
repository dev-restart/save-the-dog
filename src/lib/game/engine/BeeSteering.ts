import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';
import { distance, normalizeVector } from '../geometry.js';
import type { Point } from '../types.js';
import type { BeeDifficultyProfile } from './BeeDifficulty.js';
import { closestPointOnBody } from './BeeObstacleGeometry.js';

export type FindLineBlocker = (start: Point, end: Point, blockers: Matter.Body[], padding?: number) => Matter.Body | null;

const STEERING_CLEARANCE = PHYSICS.beeRadius + 18;

export function chooseBeeSteeringDirection(
	beePosition: Point,
	target: Point,
	blockers: Matter.Body[],
	profile: BeeDifficultyProfile,
	findLineBlocker: FindLineBlocker
): Point {
	const desired = normalizeVector(target.x - beePosition.x, target.y - beePosition.y);
	const avoidance = getAvoidanceVector(beePosition, blockers);
	const targetBlocked = findLineBlocker(beePosition, target, blockers, PHYSICS.beeRadius + 3);
	const wallFollow = targetBlocked ? getWallFollowVector(beePosition, target, targetBlocked) : { x: 0, y: 0 };
	const avoidanceWeight = targetBlocked ? profile.avoidanceWeight + 0.24 : profile.avoidanceWeight;
	const wallFollowWeight = targetBlocked ? profile.wallFollowWeight : 0;

	// desired만 쓰면 벽에 박고, avoidance만 쓰면 도망가므로 세 벡터를 stage 난이도에 맞춰 섞는다.
	const direction = normalizeVector(
		desired.x * (targetBlocked ? 0.75 : 1) + avoidance.x * avoidanceWeight + wallFollow.x * wallFollowWeight,
		desired.y * (targetBlocked ? 0.75 : 1) + avoidance.y * avoidanceWeight + wallFollow.y * wallFollowWeight
	);

	return direction.x === 0 && direction.y === 0 ? desired : direction;
}

export function getAvoidanceVector(point: Point, blockers: Matter.Body[]): Point {
	let x = 0;
	let y = 0;

	for (const blocker of blockers) {
		const closest = closestPointOnBody(point, blocker);
		const obstacleDistance = distance(point, closest);
		if (obstacleDistance > STEERING_CLEARANCE) continue;

		const fallback = normalizeVector(point.x - blocker.position.x, point.y - blocker.position.y);
		const away = normalizeVector(point.x - closest.x, point.y - closest.y);
		const direction = away.x === 0 && away.y === 0 ? fallback : away;
		const strength = (STEERING_CLEARANCE - obstacleDistance) / STEERING_CLEARANCE;
		x += direction.x * strength;
		y += direction.y * strength;
	}

	return normalizeVector(x, y);
}

export function getWallFollowVector(point: Point, target: Point, blocker: Matter.Body): Point {
	const vertices = blocker.vertices;
	if (vertices.length < 2) return normalizeVector(target.x - point.x, target.y - point.y);

	let bestPoint = vertices[0] ?? blocker.position;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const vertex of vertices) {
		const score = distance(point, vertex) * 0.7 + distance(vertex, target);
		if (score < bestScore) {
			bestPoint = vertex;
			bestScore = score;
		}
	}

	const closest = closestPointOnBody(point, blocker);
	const edgeDirection = normalizeVector(bestPoint.x - closest.x, bestPoint.y - closest.y);
	if (edgeDirection.x !== 0 || edgeDirection.y !== 0) return edgeDirection;

	return normalizeVector(bestPoint.x - point.x, bestPoint.y - point.y);
}
