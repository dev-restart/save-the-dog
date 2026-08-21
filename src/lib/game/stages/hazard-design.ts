import { PHYSICS } from '../constants.js';
import type { ObstacleData, StageData } from '../types.js';

export type HazardIssueCode =
	| 'BOMB_DISTANCE_OUT_OF_RANGE'
	| 'ROLLING_BOULDER_MISSING_SLOPE'
	| 'ROLLING_BOULDER_SLOPE_ANGLE_OUT_OF_RANGE'
	| 'ROLLING_BOULDER_PATH_MISSES_TARGET'
	| 'CRATE_GAP_TOO_SMALL'
	| 'CRATE_NO_GAP_OR_ANCHOR';

export type HazardSeverity = 'none' | 'warning' | 'error';

export interface HazardDesignIssue {
	code: HazardIssueCode;
	severity: Exclude<HazardSeverity, 'none'>;
	obstacleIndex: number;
}

export interface HazardDesignAudit {
	issues: HazardDesignIssue[];
	issueCodes: HazardIssueCode[];
	severity: HazardSeverity;
}

const BOMB_MIN_DOG_DISTANCE = 90;
const BOMB_MAX_DOG_DISTANCE = 170;
const BOULDER_MIN_SLOPE_ANGLE = 0.14;
const BOULDER_MAX_SLOPE_ANGLE = 0.5;
const BOULDER_ROUTE_TURN_ALLOWANCE = 48;
const SHELTER_BAND_HALF_WIDTH = 48;
const MIN_CRATE_GAP = 48;
const SOLID_TYPES = new Set<ObstacleData['type']>([
	'ground', 'platform', 'wall', 'brick', 'terrain-block', 'wood', 'crate', 'ice', 'stone',
	'no-draw-zone', 'no-draw-ground', 'no-draw-tree', 'no-draw-rock'
]);
const SLOPE_TYPES = new Set<ObstacleData['type']>(['platform', 'brick', 'terrain-block', 'wood', 'crate', 'ice', 'stone']);

/**
 * Checks whether authored dynamic hazards have a measurable gameplay role.
 * The checks are intentionally geometric: they are a design guardrail, not a physics simulation.
 */
export function auditHazardDesign(stage: StageData): HazardDesignAudit {
	const issues: HazardDesignIssue[] = [];

	stage.obstacles.forEach((obstacle, obstacleIndex) => {
		if (obstacle.type === 'bomb') auditBomb(stage, obstacle, obstacleIndex, issues);
		if (obstacle.type === 'rolling-boulder') auditRollingBoulder(stage, obstacle, obstacleIndex, issues);
		if (obstacle.type === 'crate') auditCrate(stage, obstacle, obstacleIndex, issues);
	});

	return {
		issues,
		issueCodes: issues.map((issue) => issue.code),
		severity: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'none'
	};
}

function auditBomb(stage: StageData, bomb: ObstacleData, obstacleIndex: number, issues: HazardDesignIssue[]): void {
	const dogDistance = distance(stage.dog.x, stage.dog.y, bomb.x, bomb.y);
	if ((dogDistance >= BOMB_MIN_DOG_DISTANCE && dogDistance <= BOMB_MAX_DOG_DISTANCE) || bombAffectsRequiredAnchor(stage, bomb)) return;

	issues.push({ code: 'BOMB_DISTANCE_OUT_OF_RANGE', severity: 'error', obstacleIndex });
}

function auditRollingBoulder(stage: StageData, boulder: ObstacleData, obstacleIndex: number, issues: HazardDesignIssue[]): void {
	const slope = findApproachSlope(stage, boulder);
	if (!slope) {
		issues.push({ code: 'ROLLING_BOULDER_MISSING_SLOPE', severity: 'error', obstacleIndex });
		return;
	}

	const angle = Math.abs(slope.angle ?? 0);
	if (angle < BOULDER_MIN_SLOPE_ANGLE || angle > BOULDER_MAX_SLOPE_ANGLE) {
		issues.push({ code: 'ROLLING_BOULDER_SLOPE_ANGLE_OUT_OF_RANGE', severity: 'error', obstacleIndex });
		return;
	}

	const projectedX = boulder.x + (stage.dog.y - boulder.y) * Math.tan(slope.angle ?? 0);
	const shelter = findShelterBand(stage);
	const targetMin = shelter?.minX ?? stage.dog.x - SHELTER_BAND_HALF_WIDTH;
	const targetMax = shelter?.maxX ?? stage.dog.x + SHELTER_BAND_HALF_WIDTH;
	const targetsDogBand = projectedX + boulder.width / 2 >= targetMin && projectedX - boulder.width / 2 <= targetMax;
	const canTurnIntoTarget =
		Math.abs(slope.x - stage.dog.x) < 200 &&
		Math.abs(boulder.x - stage.dog.x) < 140 &&
		((projectedX > targetMax && (slope.angle ?? 0) < 0 && projectedX - targetMax <= BOULDER_ROUTE_TURN_ALLOWANCE) ||
			(projectedX < targetMin && (slope.angle ?? 0) > 0 && targetMin - projectedX <= BOULDER_ROUTE_TURN_ALLOWANCE));
	const dropsIntoTarget =
		Math.abs(boulder.x - stage.dog.x) <= SHELTER_BAND_HALF_WIDTH &&
		boulder.y < stage.dog.y &&
		Math.abs(slope.x - stage.dog.x) < 120;
	if (!targetsDogBand && !canTurnIntoTarget && !dropsIntoTarget) {
		issues.push({ code: 'ROLLING_BOULDER_PATH_MISSES_TARGET', severity: 'warning', obstacleIndex });
	}
}

function auditCrate(stage: StageData, crate: ObstacleData, obstacleIndex: number, issues: HazardDesignIssue[]): void {
	const gap = gapCreatedByRemovingCrate(stage, crate);
	if (gap >= MIN_CRATE_GAP || crateIsAnchor(stage, crate)) return;

	issues.push({
		code: gap > 0 ? 'CRATE_GAP_TOO_SMALL' : 'CRATE_NO_GAP_OR_ANCHOR',
		severity: 'warning',
		obstacleIndex
	});
}

function bombAffectsRequiredAnchor(stage: StageData, bomb: ObstacleData): boolean {
	return requiredAnchors(stage).some((anchor) => distance(anchor.x, anchor.y, bomb.x, bomb.y) <= PHYSICS.bombBlastRadius + Math.min(anchor.width, anchor.height) / 2);
}

function requiredAnchors(stage: StageData): ObstacleData[] {
	const candidates = stage.obstacles.filter((obstacle) => {
		if (!SOLID_TYPES.has(obstacle.type)) return false;
		const top = obstacle.y - obstacle.height / 2;
		const bottom = obstacle.y + obstacle.height / 2;
		const left = obstacle.x - obstacle.width / 2;
		const right = obstacle.x + obstacle.width / 2;
		return top <= stage.dog.y + 150 && bottom >= stage.dog.y - 32 && right >= stage.dog.x - 96 && left <= stage.dog.x + 96;
	});
	const nearestDistance = Math.min(...candidates.map((obstacle) => distance(stage.dog.x, stage.dog.y, obstacle.x, obstacle.y)));
	return candidates.filter((obstacle) => distance(stage.dog.x, stage.dog.y, obstacle.x, obstacle.y) <= nearestDistance + 24);
}

function findApproachSlope(stage: StageData, boulder: ObstacleData): ObstacleData | undefined {
	return stage.obstacles
		.filter((obstacle) => {
			if (!SLOPE_TYPES.has(obstacle.type) || !obstacle.angle) return false;
			const left = obstacle.x - obstacle.width / 2 - boulder.width / 2;
			const right = obstacle.x + obstacle.width / 2 + boulder.width / 2;
			const top = obstacle.y - obstacle.height / 2 - boulder.height / 2;
			return boulder.x >= left && boulder.x <= right && boulder.y <= obstacle.y && boulder.y >= top - 120;
		})
		.sort((a, b) => a.y - b.y)[0];
}

function findShelterBand(stage: StageData): { minX: number; maxX: number } | undefined {
	const walls = stage.obstacles.filter((obstacle) => {
		if (!SOLID_TYPES.has(obstacle.type)) return false;
		const top = obstacle.y - obstacle.height / 2;
		const bottom = obstacle.y + obstacle.height / 2;
		return top <= stage.dog.y && bottom >= stage.dog.y;
	});
	const leftBoundary = walls
		.filter((obstacle) => obstacle.x + obstacle.width / 2 <= stage.dog.x)
		.sort((a, b) => b.x + b.width / 2 - (a.x + a.width / 2))[0];
	const rightBoundary = walls
		.filter((obstacle) => obstacle.x - obstacle.width / 2 >= stage.dog.x)
		.sort((a, b) => a.x - a.width / 2 - (b.x - b.width / 2))[0];
	if (!leftBoundary || !rightBoundary) return undefined;

	return { minX: leftBoundary.x + leftBoundary.width / 2, maxX: rightBoundary.x - rightBoundary.width / 2 };
}

function gapCreatedByRemovingCrate(stage: StageData, crate: ObstacleData): number {
	const alignedSupports = stage.obstacles.filter((obstacle) =>
		obstacle !== crate && SOLID_TYPES.has(obstacle.type) && Math.abs(obstacle.y - crate.y) <= Math.max(crate.height, obstacle.height) / 2 + 12
	);
	const left = alignedSupports
		.filter((obstacle) => obstacle.x + obstacle.width / 2 <= crate.x)
		.sort((a, b) => b.x + b.width / 2 - (a.x + a.width / 2))[0];
	const right = alignedSupports
		.filter((obstacle) => obstacle.x - obstacle.width / 2 >= crate.x)
		.sort((a, b) => a.x - a.width / 2 - (b.x - b.width / 2))[0];
	if (!left || !right) return 0;
	return Math.max(0, right.x - right.width / 2 - (left.x + left.width / 2));
}

function crateIsAnchor(stage: StageData, crate: ObstacleData): boolean {
	return distance(stage.dog.x, stage.dog.y, crate.x, crate.y) <= 96 && requiredAnchors(stage).includes(crate);
}

function distance(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by);
}
