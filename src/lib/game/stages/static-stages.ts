import { PHYSICS } from '../constants.js';
import type { HiveData, ObstacleData, Point, StageData, StageDesignType, StageEnvironment } from '../types.js';
import stageOverrides from './stage-overrides.json';

const ground = { type: 'ground' as const, x: 195, y: 660, width: 390, height: 20 };

interface StageOverride {
	dog?: Point;
	hives?: HiveData[];
	obstacles?: ObstacleData[];
	extraObstacles?: ObstacleData[];
	inkLimit?: number;
	survivalMs?: number;
	environment?: StageEnvironment;
	difficultyLabel?: string;
	designType?: StageDesignType;
	objectiveLabel?: string;
	objectiveHint?: string;
	dangerLabel?: string;
	designerNote?: string;
}

const STAGE_OVERRIDES = stageOverrides as Record<string, StageOverride>;

export const STATIC_STAGE_BLUEPRINTS: StageData[] = [
	{
		id: 1,
		dog: { x: 195, y: 530 },
		hives: [{ x: 195, y: 105, beeCount: 8, spawnIntervalMs: 320, beeForce: 0.0018 }],
		obstacles: [ground],
		inkLimit: 620,
		survivalMs: 3000,
		difficultyLabel: 'Tutorial'
	},
	{
		id: 2,
		dog: { x: 105, y: 500 },
		hives: [{ x: 305, y: 120, beeCount: 10, spawnIntervalMs: 300 }],
		obstacles: [ground, { type: 'platform', x: 105, y: 540, width: 125, height: 16 }, { type: 'spike', x: 305, y: 645, width: 82, height: 28 }],
		inkLimit: 600,
		survivalMs: 5000,
		difficultyLabel: 'Easy'
	},
	{
		id: 3,
		dog: { x: 80, y: 430 },
		hives: [{ x: 310, y: 85, beeCount: 12, spawnIntervalMs: 280 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 80, y: 475, width: 105, height: 16 },
			{ type: 'platform', x: 310, y: 380, width: 105, height: 16 },
			{ type: 'spike', x: 195, y: 645, width: 120, height: 28 }
		],
		inkLimit: 575,
		survivalMs: 5000,
		difficultyLabel: 'Easy'
	},
	{
		id: 4,
		dog: { x: 195, y: 400 },
		hives: [{ x: 55, y: 110, beeCount: 12, spawnIntervalMs: 260 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 445, width: 140, height: 16 },
			{ type: 'spike', x: 80, y: 645, width: 65, height: 28 },
			{ type: 'spike', x: 310, y: 645, width: 65, height: 28 }
		],
		inkLimit: 480,
		survivalMs: 5000,
		difficultyLabel: 'Ink Cut'
	},
	{
		id: 5,
		dog: { x: 195, y: 350 },
		hives: [{ x: 195, y: 80, beeCount: 15, spawnIntervalMs: 240 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 100, y: 390, width: 110, height: 16 },
			{ type: 'platform', x: 290, y: 460, width: 110, height: 16 },
			{ type: 'spike', x: 195, y: 645, width: 200, height: 28 },
			{ type: 'wall', x: 30, y: 410, width: 16, height: 180 }
		],
		inkLimit: 520,
		survivalMs: 5000,
		difficultyLabel: 'Hazard'
	},
	{
		id: 6,
		dog: { x: 305, y: 510 },
		hives: [{ x: 70, y: 100, beeCount: 16, spawnIntervalMs: 230 }],
		obstacles: [ground, { type: 'platform', x: 305, y: 550, width: 115, height: 16 }, { type: 'platform', x: 165, y: 445, width: 95, height: 16 }],
		inkLimit: 500,
		survivalMs: 5200,
		difficultyLabel: 'Cross'
	},
	{
		id: 7,
		dog: { x: 200, y: 495 },
		hives: [{ x: 55, y: 100, beeCount: 9, spawnIntervalMs: 220 }, { x: 335, y: 125, beeCount: 8, spawnIntervalMs: 250 }],
		obstacles: [ground, { type: 'platform', x: 195, y: 535, width: 120, height: 16 }, { type: 'spike', x: 195, y: 645, width: 120, height: 28 }],
		inkLimit: 520,
		survivalMs: 5200,
		difficultyLabel: 'Two Hives'
	},
	{
		id: 8,
		dog: { x: 90, y: 360 },
		hives: [{ x: 315, y: 90, beeCount: 18, spawnIntervalMs: 220 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 90, y: 405, width: 105, height: 16 },
			{ type: 'platform', x: 230, y: 500, width: 100, height: 16 },
			{ type: 'wall', x: 360, y: 445, width: 18, height: 175 }
		],
		inkLimit: 485,
		survivalMs: 5300,
		difficultyLabel: 'Wall'
	},
	{
		id: 9,
		dog: { x: 292, y: 382 },
		hives: [{ x: 80, y: 95, beeCount: 18, spawnIntervalMs: 215 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 292, y: 430, width: 120, height: 16 },
			{ type: 'platform', x: 145, y: 520, width: 90, height: 16 },
			{ type: 'spike', x: 240, y: 645, width: 135, height: 28 }
		],
		inkLimit: 470,
		survivalMs: 5400,
		difficultyLabel: 'Angle'
	},
	{
		id: 10,
		dog: { x: 195, y: 300 },
		hives: [{ x: 195, y: 88, beeCount: 20, spawnIntervalMs: 210, beeForce: 0.0021 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 350, width: 120, height: 16 },
			{ type: 'platform', x: 80, y: 475, width: 100, height: 16 },
			{ type: 'platform', x: 310, y: 475, width: 100, height: 16 },
			{ type: 'spike', x: 195, y: 645, width: 240, height: 28 }
		],
		inkLimit: 455,
		survivalMs: 5500,
		difficultyLabel: 'Checkpoint'
	},
	{
		id: 11,
		dog: { x: 70, y: 520 },
		hives: [{ x: 340, y: 105, beeCount: 19, spawnIntervalMs: 205 }],
		obstacles: [ground, { type: 'platform', x: 70, y: 560, width: 120, height: 16 }, { type: 'wall', x: 200, y: 475, width: 18, height: 170 }],
		inkLimit: 455,
		survivalMs: 5500,
		difficultyLabel: 'Tight'
	},
	{
		id: 12,
		dog: { x: 320, y: 520 },
		hives: [{ x: 70, y: 110, beeCount: 20, spawnIntervalMs: 200 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 320, y: 560, width: 120, height: 16 },
			{ type: 'spike', x: 90, y: 645, width: 90, height: 28 },
			{ type: 'spike', x: 240, y: 645, width: 90, height: 28 }
		],
		inkLimit: 440,
		survivalMs: 5600,
		difficultyLabel: 'Split'
	},
	{
		id: 13,
		dog: { x: 195, y: 450 },
		hives: [{ x: 55, y: 90, beeCount: 11, spawnIntervalMs: 195 }, { x: 335, y: 90, beeCount: 11, spawnIntervalMs: 225 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 495, width: 130, height: 16 },
			{ type: 'wall', x: 195, y: 310, width: 160, height: 16, angle: -0.25 },
			{ type: 'spike', x: 195, y: 645, width: 160, height: 28 }
		],
		inkLimit: 430,
		survivalMs: 5600,
		difficultyLabel: 'Pressure'
	},
	{
		id: 14,
		dog: { x: 110, y: 330 },
		hives: [{ x: 300, y: 80, beeCount: 22, spawnIntervalMs: 195, beeForce: 0.0022 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 110, y: 375, width: 115, height: 16 },
			{ type: 'platform', x: 270, y: 500, width: 130, height: 16 },
			{ type: 'spike', x: 315, y: 645, width: 120, height: 28 }
		],
		inkLimit: 420,
		survivalMs: 5700,
		difficultyLabel: 'Fast'
	},
	{
		id: 15,
		dog: { x: 280, y: 330 },
		hives: [{ x: 70, y: 80, beeCount: 22, spawnIntervalMs: 190, beeForce: 0.0022 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 280, y: 375, width: 115, height: 16 },
			{ type: 'platform', x: 125, y: 500, width: 130, height: 16 },
			{ type: 'spike', x: 75, y: 645, width: 120, height: 28 }
		],
		inkLimit: 410,
		survivalMs: 5800,
		difficultyLabel: 'Fast'
	},
	{
		id: 16,
		dog: { x: 195, y: 520 },
		hives: [{ x: 70, y: 100, beeCount: 12, spawnIntervalMs: 190 }, { x: 320, y: 100, beeCount: 12, spawnIntervalMs: 190 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 560, width: 110, height: 16 },
			{ type: 'wall', x: 115, y: 430, width: 16, height: 125 },
			{ type: 'wall', x: 275, y: 430, width: 16, height: 125 },
			{ type: 'spike', x: 195, y: 645, width: 90, height: 28 }
		],
		inkLimit: 405,
		survivalMs: 5900,
		difficultyLabel: 'Cage'
	},
	{
		id: 17,
		dog: { x: 85, y: 305 },
		hives: [{ x: 330, y: 85, beeCount: 24, spawnIntervalMs: 185 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 85, y: 350, width: 100, height: 16 },
			{ type: 'platform', x: 205, y: 455, width: 90, height: 16, angle: 0.2 },
			{ type: 'platform', x: 320, y: 555, width: 100, height: 16 },
			{ type: 'spike', x: 250, y: 645, width: 140, height: 28 }
		],
		inkLimit: 395,
		survivalMs: 6000,
		difficultyLabel: 'Late'
	},
	{
		id: 18,
		dog: { x: 305, y: 305 },
		hives: [{ x: 60, y: 85, beeCount: 24, spawnIntervalMs: 185 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 305, y: 350, width: 100, height: 16 },
			{ type: 'platform', x: 185, y: 455, width: 90, height: 16, angle: -0.2 },
			{ type: 'platform', x: 70, y: 555, width: 100, height: 16 },
			{ type: 'spike', x: 140, y: 645, width: 140, height: 28 }
		],
		inkLimit: 390,
		survivalMs: 6000,
		difficultyLabel: 'Late'
	},
	{
		id: 19,
		dog: { x: 195, y: 430 },
		hives: [{ x: 195, y: 75, beeCount: 25, spawnIntervalMs: 180, beeForce: 0.0023 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 475, width: 100, height: 16 },
			{ type: 'platform', x: 80, y: 380, width: 90, height: 16 },
			{ type: 'platform', x: 310, y: 380, width: 90, height: 16 },
			{ type: 'spike', x: 100, y: 645, width: 75, height: 28 },
			{ type: 'spike', x: 290, y: 645, width: 75, height: 28 }
		],
		inkLimit: 380,
		survivalMs: 6200,
		difficultyLabel: 'Expert'
	},
	{
		id: 20,
		dog: { x: 195, y: 330 },
		hives: [{ x: 65, y: 85, beeCount: 13, spawnIntervalMs: 175 }, { x: 325, y: 85, beeCount: 13, spawnIntervalMs: 175 }],
		obstacles: [
			ground,
			{ type: 'platform', x: 195, y: 375, width: 115, height: 16 },
			{ type: 'platform', x: 195, y: 520, width: 150, height: 16 },
			{ type: 'wall', x: 75, y: 470, width: 18, height: 160 },
			{ type: 'wall', x: 315, y: 470, width: 18, height: 160 },
			{ type: 'spike', x: 195, y: 645, width: 220, height: 28 }
		],
		inkLimit: 370,
		survivalMs: 6500,
		difficultyLabel: 'Stage 20'
	}
];

export function applyStageOverride(stage: StageData): StageData {
	const override = STAGE_OVERRIDES[String(stage.id)];
	if (!override) return stage;

	return {
		...stage,
		dog: override.dog ?? stage.dog,
		hives: override.hives ?? stage.hives,
		obstacles: resolveStageObstacles(stage, override),
		inkLimit: override.inkLimit ?? stage.inkLimit,
		survivalMs: Math.max(override.survivalMs ?? stage.survivalMs, PHYSICS.defaultSurvivalMs),
		environment: override.environment ?? stage.environment,
		difficultyLabel: override.difficultyLabel ?? stage.difficultyLabel,
		designType: override.designType ?? stage.designType,
		objectiveLabel: override.objectiveLabel ?? stage.objectiveLabel,
		objectiveHint: override.objectiveHint ?? stage.objectiveHint,
		dangerLabel: override.dangerLabel ?? stage.dangerLabel,
		designerNote: override.designerNote ?? stage.designerNote
	};
}

function resolveStageObstacles(stage: StageData, override: StageOverride): ObstacleData[] {
	if (override.obstacles) return override.obstacles;

	const extraObstacles = override.extraObstacles ?? [];
	if (extraObstacles.length === 0) return stage.obstacles;

	const extraHazards = extraObstacles.filter(isPoolHazard);
	const baseObstacles = stage.obstacles.filter((obstacle) => {
		if (obstacle.type !== 'spike') return true;
		return !extraHazards.some((hazard) => overlapsObstacle(obstacle, hazard, 8));
	});

	return [...baseObstacles, ...extraObstacles];
}

function isPoolHazard(obstacle: ObstacleData): boolean {
	return obstacle.type === 'water' || obstacle.type === 'lava';
}

function overlapsObstacle(a: ObstacleData, b: ObstacleData, padding = 0): boolean {
	const aBox = obstacleBox(a, padding);
	const bBox = obstacleBox(b, padding);

	return aBox.left < bBox.right && aBox.right > bBox.left && aBox.top < bBox.bottom && aBox.bottom > bBox.top;
}

function obstacleBox(obstacle: ObstacleData, padding: number): { left: number; right: number; top: number; bottom: number } {
	return {
		left: obstacle.x - obstacle.width / 2 - padding,
		right: obstacle.x + obstacle.width / 2 + padding,
		top: obstacle.y - obstacle.height / 2 - padding,
		bottom: obstacle.y + obstacle.height / 2 + padding
	};
}

export const STATIC_STAGES: StageData[] = STATIC_STAGE_BLUEPRINTS.map(applyStageOverride);

export const FIRST_STAGE_ID = 1;
export const MAX_STATIC_STAGE_ID = STATIC_STAGE_BLUEPRINTS.length;
export const MAX_AUTHORED_STAGE_ID = Math.max(
	MAX_STATIC_STAGE_ID,
	...Object.keys(STAGE_OVERRIDES).map((stageId) => Number(stageId)).filter(Number.isFinite)
);
export const FALLBACK_STAGE: StageData = applyStageOverride({
	id: 1,
	dog: { x: 195, y: 530 },
	hives: [{ x: 195, y: 105, beeCount: 8, spawnIntervalMs: 320 }],
	obstacles: [ground],
	inkLimit: PHYSICS.defaultInkLimit,
	survivalMs: PHYSICS.defaultSurvivalMs,
	difficultyLabel: 'Tutorial',
	objectiveLabel: '강아지 보호',
	objectiveHint: '벌과 위험 지형을 동시에 막으세요.',
	dangerLabel: '벌 공격'
});
