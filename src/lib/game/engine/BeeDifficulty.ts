import { clamp } from '../geometry.js';

export interface BeeDifficultyProfile {
	intelligence: number;
	routeCellSize: number;
	routeCacheMs: number;
	routeLookahead: number;
	forceMultiplier: number;
	maxSpeed: number;
	attackCandidateLimit: number;
	attackRings: number[];
	probeMargin: number;
	wallFollowWeight: number;
	avoidanceWeight: number;
	drawingDurability: number;
	drawingDamagePerMs: number;
	drawingDragPerMs: number;
	drawingRotationPerMs: number;
	usesDogAttackCandidates: boolean;
	canDamageDrawing: boolean;
	canDragDrawing: boolean;
	canRotateDrawing: boolean;
}

export function createBeeDifficultyProfile(stageId: number): BeeDifficultyProfile {
	const intelligence = clamp((stageId - 1) / 18, 0, 1);
	const tier = Math.floor(Math.max(0, stageId - 1) / 5);

	return {
		intelligence,
		routeCellSize: Math.max(10, 18 - intelligence * 6),
		routeCacheMs: Math.max(260, 760 - tier * 90 - intelligence * 120),
		routeLookahead: 38 + intelligence * 30,
		forceMultiplier: 1 + intelligence * 0.62 + tier * 0.04,
		maxSpeed: 7.2 + intelligence * 2.2,
		attackCandidateLimit: 6 + Math.min(6, tier * 2),
		attackRings: [18, 34, 52, 70 + intelligence * 18],
		probeMargin: 24 + intelligence * 30,
		wallFollowWeight: 1.18 + intelligence * 0.55,
		avoidanceWeight: 0.38 + intelligence * 0.22,
		drawingDurability: Math.max(260, 1250 - stageId * 46),
		drawingDamagePerMs: 0.08 + intelligence * 0.44 + Math.max(0, tier - 1) * 0.018,
		drawingDragPerMs: 0.004 + intelligence * 0.024,
		drawingRotationPerMs: intelligence * 0.00042,
		usesDogAttackCandidates: stageId >= 2,
		canDamageDrawing: stageId >= 8,
		canDragDrawing: stageId >= 14,
		canRotateDrawing: stageId >= 20
	};
}

export type BeeRole = 'chaser' | 'flanker-left' | 'flanker-right' | 'bruiser';

export function getBeeRole(beeId: number, stageId: number): BeeRole {
	// 초반에는 규칙 학습을 위해 대부분 직선 추격, 이후에는 벌마다 역할을 나눠 감싸기 방어를 흔든다.
	if (stageId < 3) return beeId % 3 === 0 ? 'flanker-left' : 'chaser';
	if (stageId >= 8 && beeId % 5 === 0) return 'bruiser';
	return beeId % 2 === 0 ? 'flanker-left' : 'flanker-right';
}
