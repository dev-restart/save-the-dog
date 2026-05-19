import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';
import { clamp, distance, normalizeVector } from '../geometry.js';
import type { CanvasSize, Point } from '../types.js';
import { getBeeRole, type BeeDifficultyProfile } from './BeeDifficulty.js';
import {
	bodyToSegmentDistance,
	pointToBodyDistance,
	projectionRatio,
	segmentOverlapsBounds
} from './BeeObstacleGeometry.js';

interface BeeNavigationState {
	id: number;
	position: Point;
}

interface RouteCacheEntry {
	target: Point;
	expiresAtMs: number;
}

interface RouteNode {
	col: number;
	row: number;
	point: Point;
	g: number;
	f: number;
	parent: RouteNode | null;
}

const ROUTE_PADDING = PHYSICS.beeRadius + 4;
const DOG_ATTACK_RADIUS = PHYSICS.dogRadius + 46;
const NEIGHBOR_OFFSETS = [
	{ col: 1, row: 0 },
	{ col: -1, row: 0 },
	{ col: 0, row: 1 },
	{ col: 0, row: -1 },
	{ col: 1, row: 1 },
	{ col: 1, row: -1 },
	{ col: -1, row: 1 },
	{ col: -1, row: -1 }
];

export class BeeNavigation {
	private routeCache = new Map<number, RouteCacheEntry>();

	constructor(
		private size: CanvasSize,
		private profile: BeeDifficultyProfile,
		private stageId: number
	) {}

	chooseTarget(bee: BeeNavigationState, dogPosition: Point, navigationBodies: Matter.Body[], nowMs: number): Point {
		if (navigationBodies.length === 0) return this.chooseOpenAttackTarget(bee, dogPosition, navigationBodies);

		const blocker = this.findLineBlocker(bee.position, dogPosition, navigationBodies, ROUTE_PADDING);
		if (!blocker) return this.chooseOpenAttackTarget(bee, dogPosition, navigationBodies);

		const cached = this.routeCache.get(bee.id);
		if (cached && cached.expiresAtMs > nowMs && distance(bee.position, cached.target) > 14) {
			return cached.target;
		}

		// 직선 공격이 막히면 여러 벌이 한 점에 몰리지 않도록 bee id/role별로 공격 후보와 우회 probe를 분산한다.
		const target =
			(this.profile.usesDogAttackCandidates
				? this.findBestAttackTarget(bee, dogPosition, navigationBodies)
				: null) ??
			this.findPathTarget(bee.position, dogPosition, navigationBodies, bee.id) ??
			this.chooseGapProbeTarget(bee.position, dogPosition, navigationBodies, blocker, bee.id);
		this.routeCache.set(bee.id, {
			target,
			expiresAtMs: nowMs + this.profile.routeCacheMs
		});
		return target;
	}

	clearCache(beeId?: number): void {
		if (beeId === undefined) {
			this.routeCache.clear();
			return;
		}
		this.routeCache.delete(beeId);
	}

	findLineBlocker(start: Point, end: Point, blockers: Matter.Body[], padding = ROUTE_PADDING): Matter.Body | null {
		let blocker: Matter.Body | null = null;
		let blockerRatio = Number.POSITIVE_INFINITY;

		for (const candidate of blockers) {
			if (!segmentOverlapsBounds(start, end, candidate.bounds, padding)) continue;
			if (bodyToSegmentDistance(candidate, start, end) > padding) continue;

			const ratio = clamp(projectionRatio(candidate.position, start, end), 0, 1);
			if (ratio < blockerRatio) {
				blocker = candidate;
				blockerRatio = ratio;
			}
		}

		return blocker;
	}

	private chooseOpenAttackTarget(bee: BeeNavigationState, dogPosition: Point, navigationBodies: Matter.Body[]): Point {
		const role = getBeeRole(bee.id, this.stageId);

		if (role === 'bruiser') {
			const drawingTarget = findClosestBodyPosition(
				bee.position,
				navigationBodies.filter((body) => body.label === 'drawing')
			);
			if (drawingTarget) return drawingTarget;
		}

		// 측면 벌은 강아지 뒤/옆 좌표를 먼저 노려서 같은 점에 몰리는 느낌을 줄인다.
		const towardDog = normalizeVector(dogPosition.x - bee.position.x, dogPosition.y - bee.position.y);
		if (role === 'chaser' && this.stageId < 3) return dogPosition;

		const routeJitter = ((bee.id % 7) - 3) * (3 + this.profile.intelligence * 3);
		const side = role === 'flanker-left' ? -1 : 1;
		const flankDistance = 38 + this.profile.intelligence * 36 + routeJitter;
		const backoff = 20 + this.profile.intelligence * 18 + Math.abs(routeJitter) * 0.4;
		const candidate = this.clampNavigationPoint({
			x: dogPosition.x + -towardDog.y * side * flankDistance - towardDog.x * backoff,
			y: dogPosition.y + towardDog.x * side * flankDistance - towardDog.y * backoff
		});

		if (
			!this.isPointBlocked(candidate, navigationBodies, PHYSICS.beeRadius + 2) &&
			!this.findLineBlocker(candidate, dogPosition, navigationBodies, PHYSICS.beeRadius + 2)
		) {
			return candidate;
		}

		return dogPosition;
	}

	private findPathTarget(start: Point, goal: Point, blockers: Matter.Body[], beeId = 0): Point | null {
		const routeGoal = this.getCohortGoal(goal, beeId);
		const path = this.findPath(start, routeGoal, blockers, (point, key, goalKey) => {
			if (key === goalKey) return true;
			return (
				distance(point, routeGoal) <= DOG_ATTACK_RADIUS &&
				!this.findLineBlocker(point, routeGoal, blockers, PHYSICS.beeRadius + 2)
			);
		});

		return path ? pickRouteLookahead(start, [...path, routeGoal], this.profile.routeLookahead) : null;
	}

	private findBestAttackTarget(bee: BeeNavigationState, goal: Point, blockers: Matter.Body[]): Point | null {
		const role = getBeeRole(bee.id, this.stageId);
		const candidates = this.createDogAttackCandidates(goal, blockers)
			.map((point) => ({
				point,
				score:
					distance(bee.position, point) +
					distance(point, goal) * 0.65 +
					this.proximityPenalty(point, blockers) +
					this.roleCohortPenalty(point, goal, role, bee.id)
			}))
			.sort((a, b) => a.score - b.score)
			.slice(0, this.profile.attackCandidateLimit);

		let bestPath: Point[] | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		let pathSearches = 0;

		for (const candidate of candidates) {
			if (!this.findLineBlocker(bee.position, candidate.point, blockers, PHYSICS.beeRadius + 2)) {
				const score = distance(bee.position, candidate.point) + distance(candidate.point, goal);
				if (score < bestScore) {
					// 후보 자체를 1차 목표로 삼아 벌 무리가 강아지 한 점이 아니라 주변 빈 공간을 나눠 찌르게 한다.
					bestPath = [bee.position, candidate.point];
					bestScore = score;
				}
				continue;
			}

			if (pathSearches >= this.profile.attackPathSearchLimit) continue;
			pathSearches += 1;

			const path = this.findPath(bee.position, candidate.point, blockers);
			if (!path) continue;

			const score = pathDistance(path) + distance(candidate.point, goal);
			if (score < bestScore) {
				bestPath = [...path, candidate.point];
				bestScore = score;
			}
		}

		return bestPath ? pickRouteLookahead(bee.position, bestPath, this.profile.routeLookahead) : null;
	}

	private getCohortGoal(goal: Point, beeId: number): Point {
		if (this.stageId < 3) return goal;
		const cohort = Math.abs(beeId + this.stageId) % 5;
		const angle = -Math.PI * 0.85 + cohort * (Math.PI * 1.7) / 4;
		const radius = 20 + this.profile.intelligence * 34;
		return this.clampNavigationPoint({
			x: goal.x + Math.cos(angle) * radius,
			y: goal.y + Math.sin(angle) * radius
		});
	}

	private roleCohortPenalty(point: Point, goal: Point, role: ReturnType<typeof getBeeRole>, beeId: number): number {
		const angle = Math.atan2(point.y - goal.y, point.x - goal.x);
		const cohort = Math.abs(beeId + this.stageId) % 5;
		const desiredAngle =
			role === 'flanker-left'
				? -Math.PI * 0.65
				: role === 'flanker-right'
					? Math.PI * 0.65
					: -Math.PI + cohort * (Math.PI * 2) / 5;
		return Math.abs(shortestAngleDelta(angle, desiredAngle)) * (80 + this.profile.intelligence * 90);
	}

	private createDogAttackCandidates(goal: Point, blockers: Matter.Body[]): Point[] {
		const candidates: Point[] = [];
		const radii = this.profile.attackRings.map((radius) => PHYSICS.dogRadius + radius);
		const angleStep = Math.PI / (8 + Math.round(this.profile.intelligence * 4));

		for (const radius of radii) {
			for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
				const candidate = this.clampNavigationPoint({
					x: goal.x + Math.cos(angle) * radius,
					y: goal.y + Math.sin(angle) * radius
				});
				if (this.isPointBlocked(candidate, blockers, PHYSICS.beeRadius + 2)) continue;
				if (this.findLineBlocker(candidate, goal, blockers, PHYSICS.beeRadius + 2)) continue;
				candidates.push(candidate);
			}
		}

		return dedupeNearbyPoints(candidates);
	}

	private findPath(
		start: Point,
		goal: Point,
		blockers: Matter.Body[],
		isComplete?: (point: Point, key: string, goalKey: string) => boolean
	): Point[] | null {
		const cellSize = this.profile.routeCellSize;
		const cols = Math.ceil(this.size.width / cellSize);
		const rows = Math.ceil(this.size.height / cellSize);
		const startCell = this.pointToCell(start, cellSize, cols, rows);
		const goalCell = this.pointToCell(goal, cellSize, cols, rows);
		const startKey = cellKey(startCell.col, startCell.row);
		const goalKey = cellKey(goalCell.col, goalCell.row);
		const blockedCache = new Map<string, boolean>();

		const isBlocked = (col: number, row: number) => {
			const key = cellKey(col, row);
			if (key === startKey || key === goalKey) return false;
			const cached = blockedCache.get(key);
			if (cached !== undefined) return cached;

			const blocked = this.isPointBlocked(this.cellCenter(col, row, cellSize), blockers, ROUTE_PADDING);
			blockedCache.set(key, blocked);
			return blocked;
		};

		const startNode: RouteNode = {
			...startCell,
			point: start,
			g: 0,
			f: distance(start, goal),
			parent: null
		};
		const open: RouteNode[] = [startNode];
		const nodes = new Map<string, RouteNode>([[startKey, startNode]]);
		const closed = new Set<string>();
		let iterations = 0;

		while (open.length > 0 && iterations < this.profile.routeIterationLimit) {
			iterations += 1;
			const current = takeLowestCostNode(open);
			const currentKey = cellKey(current.col, current.row);
			if (closed.has(currentKey)) continue;

			if (isComplete ? isComplete(current.point, currentKey, goalKey) : currentKey === goalKey) {
				const path = reconstructPath(current);
				path.push(goal);
				return path;
			}

			closed.add(currentKey);

			for (const offset of NEIGHBOR_OFFSETS) {
				const col = current.col + offset.col;
				const row = current.row + offset.row;
				if (col < 0 || row < 0 || col >= cols || row >= rows) continue;

				const key = cellKey(col, row);
				if (closed.has(key) || isBlocked(col, row)) continue;
				if (
					Math.abs(offset.col) + Math.abs(offset.row) === 2 &&
					(isBlocked(current.col + offset.col, current.row) || isBlocked(current.col, current.row + offset.row))
				) {
					continue;
				}

				const point = this.cellCenter(col, row, cellSize);
				const nextG = current.g + distance(current.point, point);
				const existing = nodes.get(key);
				if (existing && nextG >= existing.g) continue;

				const node: RouteNode = {
					col,
					row,
					point,
					g: nextG,
					f: nextG + distance(point, goal),
					parent: current
				};
				nodes.set(key, node);
				open.push(node);
			}
		}

		return null;
	}

	private pointToCell(point: Point, cellSize: number, cols: number, rows: number) {
		return {
			col: clamp(Math.floor(point.x / cellSize), 0, cols - 1),
			row: clamp(Math.floor(point.y / cellSize), 0, rows - 1)
		};
	}

	private cellCenter(col: number, row: number, cellSize: number): Point {
		return {
			x: clamp(col * cellSize + cellSize / 2, 0, this.size.width),
			y: clamp(row * cellSize + cellSize / 2, 0, this.size.height)
		};
	}

	private chooseGapProbeTarget(start: Point, goal: Point, blockers: Matter.Body[], blocker: Matter.Body, beeId = 0): Point {
		const candidates = this.createProbeCandidates(blocker, goal);
		let bestTarget = goal;
		let bestScore = Number.POSITIVE_INFINITY;
		const cohortGoal = this.getCohortGoal(goal, beeId);

		for (const candidate of candidates) {
			if (this.isPointBlocked(candidate, blockers, ROUTE_PADDING)) continue;

			const firstBlocked = this.findLineBlocker(start, candidate, blockers, PHYSICS.beeRadius + 4);
			const secondBlocked = this.findLineBlocker(candidate, goal, blockers, ROUTE_PADDING);
			const score =
				distance(start, candidate) +
				distance(candidate, goal) +
				distance(candidate, cohortGoal) * 0.28 +
				(firstBlocked ? 600 : 0) +
				(secondBlocked ? 180 : 0) +
				this.proximityPenalty(candidate, blockers);

			if (score < bestScore) {
				bestScore = score;
				bestTarget = candidate;
			}
		}

		return bestTarget;
	}

	private createProbeCandidates(blocker: Matter.Body, goal: Point): Point[] {
		const margin = this.profile.probeMargin;
		const candidates: Point[] = [];
		for (const vertex of blocker.vertices) {
			const away = normalizeVector(vertex.x - blocker.position.x, vertex.y - blocker.position.y);
			candidates.push(this.clampNavigationPoint({ x: vertex.x + away.x * margin, y: vertex.y + away.y * margin }));
		}

		const { min, max } = blocker.bounds;
		const boundsCandidates = [
			{ x: min.x - margin, y: min.y - margin },
			{ x: max.x + margin, y: min.y - margin },
			{ x: min.x - margin, y: max.y + margin },
			{ x: max.x + margin, y: max.y + margin },
			{ x: (min.x + max.x) / 2, y: min.y - margin },
			{ x: (min.x + max.x) / 2, y: max.y + margin },
			{ x: min.x - margin, y: (min.y + max.y) / 2 },
			{ x: max.x + margin, y: (min.y + max.y) / 2 }
		];

		for (const candidate of boundsCandidates) {
			candidates.push(this.clampNavigationPoint(candidate));
		}

		for (const offset of [
			{ x: -60, y: 0 },
			{ x: 60, y: 0 },
			{ x: 0, y: -60 },
			{ x: 0, y: 60 }
		]) {
			candidates.push(this.clampNavigationPoint({ x: goal.x + offset.x, y: goal.y + offset.y }));
		}

		return candidates;
	}

	private clampNavigationPoint(point: Point): Point {
		const padding = ROUTE_PADDING + 2;
		return {
			x: clamp(point.x, padding, this.size.width - padding),
			y: clamp(point.y, padding, this.size.height - padding)
		};
	}

	private isPointBlocked(point: Point, blockers: Matter.Body[], padding: number): boolean {
		if (
			point.x < padding ||
			point.x > this.size.width - padding ||
			point.y < padding ||
			point.y > this.size.height - padding
		) {
			return true;
		}

		return blockers.some((body) => pointToBodyDistance(point, body) <= padding);
	}

	private proximityPenalty(point: Point, blockers: Matter.Body[]): number {
		let penalty = 0;
		for (const blocker of blockers) {
			const obstacleDistance = pointToBodyDistance(point, blocker);
			if (obstacleDistance >= PHYSICS.beeRadius + 18) continue;
			penalty += (PHYSICS.beeRadius + 18 - obstacleDistance) * 8;
		}
		return penalty;
	}
}

function cellKey(col: number, row: number): string {
	return `${col}:${row}`;
}

function takeLowestCostNode(open: RouteNode[]): RouteNode {
	let bestIndex = 0;
	for (let index = 1; index < open.length; index += 1) {
		if (open[index].f < open[bestIndex].f) bestIndex = index;
	}

	const [node] = open.splice(bestIndex, 1);
	return node;
}

function reconstructPath(node: RouteNode): Point[] {
	const points: Point[] = [];
	let current: RouteNode | null = node;
	while (current) {
		points.push(current.point);
		current = current.parent;
	}
	return points.reverse();
}

function pathDistance(points: Point[]): number {
	let total = 0;
	for (let index = 1; index < points.length; index += 1) {
		total += distance(points[index - 1], points[index]);
	}
	return total;
}

function dedupeNearbyPoints(points: Point[]): Point[] {
	const result: Point[] = [];
	for (const point of points) {
		if (result.some((existing) => distance(existing, point) < 10)) continue;
		result.push(point);
	}
	return result;
}

function findClosestBodyPosition(point: Point, bodies: Matter.Body[]): Point | null {
	let closest: Matter.Body | null = null;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (const body of bodies) {
		const bodyDistance = distance(point, body.position);
		if (bodyDistance < closestDistance) {
			closest = body;
			closestDistance = bodyDistance;
		}
	}
	return closest?.position ?? null;
}

function shortestAngleDelta(a: number, b: number): number {
	return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function pickRouteLookahead(start: Point, path: Point[], lookahead: number): Point {
	for (const point of path.slice(1)) {
		if (distance(start, point) >= lookahead) return point;
	}

	return path.at(1) ?? path[0] ?? start;
}
