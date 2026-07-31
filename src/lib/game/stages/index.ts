import { generateStage } from './generate-stage.js';
import {
	applyStageOverride,
	FALLBACK_STAGE,
	MAX_AUTHORED_STAGE_ID,
	MAX_STATIC_STAGE_ID,
	STATIC_STAGE_BLUEPRINTS
} from './static-stages.js';
import { applyStageDifficulty } from './difficulty-config.js';
import type { StageData } from '../types.js';

export function getStage(stageId: number): StageData {
	if (stageId <= MAX_STATIC_STAGE_ID) {
		const stage = STATIC_STAGE_BLUEPRINTS.find((item) => item.id === stageId) ?? FALLBACK_STAGE;
		return applyStageDifficulty(applyStageOverride(tuneStaticStage(stage)));
	}

	if (stageId <= MAX_AUTHORED_STAGE_ID) {
		return applyStageDifficulty(applyStageOverride(generateStage(stageId)));
	}

	return applyStageDifficulty(generateStage(stageId));
}

function tuneStaticStage(stage: StageData): StageData {
	if (stage.id === 1) return stage;
	const difficultyStep = stage.id - 2;

	return {
		...stage,
		inkLimit: Math.min(stage.inkLimit, Math.max(285, 440 - difficultyStep * 9)),
		survivalMs: Math.max(stage.survivalMs, Math.min(6800, 5000 + difficultyStep * 85)),
		hives: stage.hives.map((hive, index) => ({
			...hive,
			beeCount: Math.min(25, hive.beeCount + Math.floor(difficultyStep / 5) + (index === 0 ? 0 : 1)),
			spawnIntervalMs: Math.max(165, hive.spawnIntervalMs - Math.floor(difficultyStep / 3) * 5)
		}))
	};
}
