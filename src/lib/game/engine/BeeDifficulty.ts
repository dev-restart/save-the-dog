import { clamp } from '../geometry.js';

export interface BeeDifficultyProfile {
	intelligence: number;
	aiRefreshBudget: number;
	routeCellSize: number;
	routeCacheMs: number;
	routeIterationLimit: number;
	routeLookahead: number;
	forceMultiplier: number;
	maxSpeed: number;
	attackCandidateLimit: number;
	attackPathSearchLimit: number;
	attackRings: number[];
	probeMargin: number;
	wallFollowWeight: number;
	avoidanceWeight: number;
	drawingDurability: number;
	drawingDamagePerMs: number;
	drawingDragPerMs: number;
	drawingLiftPerMs: number;
	drawingRotationPerMs: number;
	usesDogAttackCandidates: boolean;
	canPressureDrawing: boolean;
	canDamageDrawing: boolean;
	canDragDrawing: boolean;
	canRotateDrawing: boolean;
}

export function createBeeDifficultyProfile(stageId: number): BeeDifficultyProfile {
	const stageIndex = Math.max(0, stageId - 1);
	const intelligence = clamp(stageIndex / 24, 0, 1);
	const tier = Math.floor(stageIndex / 4);

	return {
		intelligence,
		aiRefreshBudget: stageId < 3 ? 25 : Math.min(6, 3 + Math.floor(tier / 2)),
		routeCellSize: Math.max(14, 18 - intelligence * 4),
		routeCacheMs: Math.max(420, 900 - tier * 45 - intelligence * 120),
		routeIterationLimit: Math.floor(1100 + intelligence * 400 + tier * 32),
		routeLookahead: 38 + intelligence * 30,
		forceMultiplier: 1 + intelligence * 0.55 + tier * 0.035,
		maxSpeed: 7 + intelligence * 2,
		attackCandidateLimit: 4 + Math.min(5, Math.floor(tier / 2)),
		attackPathSearchLimit: Math.min(3, 1 + Math.floor(tier / 4)),
		attackRings: [18, 34, 52, 68 + intelligence * 18],
		probeMargin: 26 + intelligence * 28,
		wallFollowWeight: 1.2 + intelligence * 0.55,
		avoidanceWeight: 0.42 + intelligence * 0.2,
		drawingDurability: Number.POSITIVE_INFINITY,
		drawingDamagePerMs: 0,
		drawingDragPerMs: 0.003 + intelligence * 0.018,
		drawingLiftPerMs: 0.002 + intelligence * 0.012,
		drawingRotationPerMs: 0.00006 + intelligence * 0.00032,
		usesDogAttackCandidates: stageId >= 2,
		canPressureDrawing: stageId >= 4,
		canDamageDrawing: false,
		canDragDrawing: stageId >= 6,
		canRotateDrawing: stageId >= 12
	};
}

export type BeeRole = 'chaser' | 'flanker-left' | 'flanker-right' | 'bruiser';

export function getBeeRole(beeId: number, stageId: number): BeeRole {
	// 1~2단계는 규칙 학습을 위해 안정적인 추격을 유지하고, 이후부터 공격 각도를 빠르게 분산한다.
	if (stageId === 1) return 'chaser';
	if (stageId < 3) return beeId % 3 === 0 ? 'flanker-left' : 'chaser';

	const pattern = Math.abs(beeId + stageId) % (stageId >= 4 ? 5 : 4);
	if (stageId >= 4 && pattern === 0) return 'bruiser';
	if (pattern === 1) return 'flanker-left';
	if (pattern === 2) return 'flanker-right';
	return 'chaser';
}
