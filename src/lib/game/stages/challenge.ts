import { PHYSICS } from '../constants.js';
import type { BeeAttackStyle, Point, StageData } from '../types.js';
import { createSeededRandom } from '../seeded-random.js';
import { generateStage } from './generate-stage.js';

export const CHALLENGE_STAGE_MIN = 101;
export const CHALLENGE_STAGE_MAX = 500;
export const CHALLENGE_SEED_VERSION = 'challenge-v1';

export function getChallengeSeed(stageId: number): string {
	return `${CHALLENGE_SEED_VERSION}-${stageId}`;
}

export function isChallengeStage(stageId: number): boolean {
	return stageId >= CHALLENGE_STAGE_MIN && stageId <= CHALLENGE_STAGE_MAX;
}

export function generateChallengeStage(stageId: number, seed = getChallengeSeed(stageId)): StageData {
	if (!isChallengeStage(stageId)) throw new Error('시드 도전 단계 범위가 아닙니다.');

	const random = createSeededRandom(seed);
	const sourceId = 31 + Math.floor(random() * 70);
	const source = generateStage(sourceId);
	const mirrored = random() >= 0.5;
	const sourceStage = mirrored ? mirrorStage(source) : source;
	const pressure = Math.min(1, (stageId - CHALLENGE_STAGE_MIN) / (CHALLENGE_STAGE_MAX - CHALLENGE_STAGE_MIN));
	const challengeSlot = ((stageId - CHALLENGE_STAGE_MIN) % 10) + 1;

	return {
		...sourceStage,
		id: stageId,
		seed,
		hives: sourceStage.hives.map((hive, index) => ({
			...hive,
			beeCount: Math.min(PHYSICS.maxActiveBees, hive.beeCount + Math.floor(pressure * 5) + (random() > 0.7 ? 1 : 0)),
			spawnIntervalMs: Math.max(120, hive.spawnIntervalMs - Math.floor(pressure * 55)),
			beeForce: Math.min(0.0034, (hive.beeForce ?? 0.002) + pressure * 0.00035),
			attackStyle: challengeAttackStyle(hive.attackStyle, index + stageId)
		})),
		inkLimit: Math.max(300, Math.floor(sourceStage.inkLimit - pressure * 80)),
		difficultyLabel: `시드 도전 ${stageId} · ${challengeSlot}/10`,
		designerNote: `${seed}에서 31~100단계 지형 archetype을 선택하고 좌우 방향·벌 압박·생성 간격을 결정한 재현 가능한 도전 맵입니다.`,
		objectiveHint: `${sourceStage.objectiveHint ?? '지형과 위험물을 활용해 강아지를 보호하세요.'} 같은 seed에서는 항상 같은 지형이 생성됩니다.`,
		survivalMs: PHYSICS.defaultSurvivalMs
	};
}

function mirrorStage(stage: StageData): StageData {
	return {
		...stage,
		dog: mirrorPoint(stage.dog),
		hives: stage.hives.map((hive) => ({ ...hive, ...mirrorPoint(hive), attackStyle: mirrorAttackStyle(hive.attackStyle) })),
		obstacles: stage.obstacles.map((obstacle) => ({
			...obstacle,
			x: 390 - obstacle.x,
			angle: obstacle.angle === undefined ? undefined : -obstacle.angle
		}))
	};
}

function mirrorPoint(point: Point): Point {
	return { x: 390 - point.x, y: point.y };
}

function mirrorAttackStyle(style: BeeAttackStyle | undefined): BeeAttackStyle | undefined {
	if (style === 'flank-left') return 'flank-right';
	if (style === 'flank-right') return 'flank-left';
	return style;
}

function challengeAttackStyle(style: BeeAttackStyle | undefined, value: number): BeeAttackStyle | undefined {
	if (style === 'direct' || style === undefined) return value % 4 === 0 ? 'breaker' : style;
	return style;
}
