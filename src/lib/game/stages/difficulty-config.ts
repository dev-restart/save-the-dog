import type { DifficultyProfileId, StageData, StageDifficulty } from '../types.js';
import stageDifficultyOverrides from './difficulty-overrides.json';

const PROFILE_IDS = new Set<DifficultyProfileId>([
	'tutorial',
	'shelter',
	'hazard',
	'swarm',
	'physics',
	'expert',
	'master'
]);

const STAGE_DIFFICULTIES = Object.fromEntries(
	Object.entries(stageDifficultyOverrides).flatMap(([stageId, rawDifficulty]) => {
		const difficulty = normalizeDifficulty(rawDifficulty);
		return difficulty ? [[stageId, difficulty]] : [];
	})
) as Record<string, StageDifficulty>;

export function applyStageDifficulty(stage: StageData): StageData {
	return {
		...stage,
		difficulty: stage.difficulty ?? getStageDifficulty(stage.id)
	};
}

export function getStageDifficulty(stageId: number): StageDifficulty {
	return STAGE_DIFFICULTIES[String(stageId)] ?? generatedDifficulty(stageId);
}

function generatedDifficulty(stageId: number): StageDifficulty {
	if (stageId <= 4) return { profile: 'tutorial' };
	if (stageId <= 10) return { profile: 'hazard' };
	if (stageId <= 20) return { profile: 'physics' };
	if (stageId <= 36) return { profile: 'expert' };
	return { profile: 'master' };
}

function normalizeDifficulty(value: unknown): StageDifficulty | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const raw = value as { profile?: unknown; overrides?: StageDifficulty['overrides'] };
	if (typeof raw.profile !== 'string' || !PROFILE_IDS.has(raw.profile as DifficultyProfileId)) return null;

	return {
		profile: raw.profile as DifficultyProfileId,
		overrides: raw.overrides
	};
}
