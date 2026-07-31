import { clamp } from '../geometry.js';
import type { DifficultyProfileId, StageDifficulty } from '../types.js';

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
	usesDogAttackCandidates: boolean;
}

export const BEE_DIFFICULTY_PROFILES: Record<DifficultyProfileId, BeeDifficultyProfile> = {
	tutorial: createProfile(0, 25, 1, 7, 4, 1, false),
	shelter: createProfile(0.12, 4, 1.08, 7.3, 4, 1, true),
	hazard: createProfile(0.26, 4, 1.16, 7.6, 5, 1, true),
	swarm: createProfile(0.42, 5, 1.24, 7.9, 6, 2, true),
	physics: createProfile(0.56, 5, 1.32, 8.2, 7, 2, true),
	expert: createProfile(0.72, 6, 1.4, 8.55, 8, 3, true),
	master: createProfile(0.9, 7, 1.5, 8.9, 9, 3, true)
};

export function createBeeDifficultyProfile(stageId: number, difficulty?: StageDifficulty): BeeDifficultyProfile {
	if (difficulty) {
		const profile = BEE_DIFFICULTY_PROFILES[difficulty.profile];
		return { ...profile, ...difficulty.overrides };
	}

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
		usesDogAttackCandidates: stageId >= 2
	};
}

function createProfile(
	intelligence: number,
	aiRefreshBudget: number,
	forceMultiplier: number,
	maxSpeed: number,
	attackCandidateLimit: number,
	attackPathSearchLimit: number,
	usesDogAttackCandidates: boolean
): BeeDifficultyProfile {
	const tier = Math.round(intelligence * 8);
	return {
		intelligence,
		aiRefreshBudget,
		routeCellSize: Math.max(14, 18 - intelligence * 4),
		routeCacheMs: Math.max(420, 900 - tier * 45 - intelligence * 120),
		routeIterationLimit: Math.floor(1100 + intelligence * 400 + tier * 32),
		routeLookahead: 38 + intelligence * 30,
		forceMultiplier,
		maxSpeed,
		attackCandidateLimit,
		attackPathSearchLimit,
		attackRings: [18, 34, 52, 68 + intelligence * 18],
		probeMargin: 26 + intelligence * 28,
		wallFollowWeight: 1.2 + intelligence * 0.55,
		avoidanceWeight: 0.42 + intelligence * 0.2,
		usesDogAttackCandidates
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
