import { generateStage } from './generate-stage.js';
import { FALLBACK_STAGE, MAX_STATIC_STAGE_ID, STATIC_STAGES } from './static-stages.js';
import type { StageData } from '../types.js';

export function getStage(stageId: number): StageData {
	if (stageId <= MAX_STATIC_STAGE_ID) {
		return tuneStaticStage(STATIC_STAGES.find((stage) => stage.id === stageId) ?? FALLBACK_STAGE);
	}

	return generateStage(stageId);
}

function tuneStaticStage(stage: StageData): StageData {
	if (stage.id === 1) return stage;

	return {
		...stage,
		inkLimit: Math.min(stage.inkLimit, Math.max(300, 440 - (stage.id - 2) * 8))
	};
}
