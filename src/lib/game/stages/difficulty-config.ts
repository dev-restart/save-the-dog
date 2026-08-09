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
	if (stageId <= 30) return { profile: 'expert' };
	if (stageId <= 40) return { profile: 'expert', overrides: { forceMultiplier: 1.24, maxSpeed: 8.1 } };
	if (stageId <= 50) return { profile: 'expert', overrides: { intelligence: 0.2, attackCandidateLimit: 7 } };
	if (stageId <= 60) return { profile: 'master', overrides: { forceMultiplier: 1.38, maxSpeed: 8.5 } };
	if (stageId <= 70) return { profile: 'master', overrides: { intelligence: 0.28, attackPathSearchLimit: 3 } };
	if (stageId <= 80) return { profile: 'master', overrides: { maxSpeed: 8.7, attackCandidateLimit: 9 } };
	if (stageId <= 90) return { profile: 'master', overrides: { forceMultiplier: 1.48, aiRefreshBudget: 7 } };
	return { profile: 'master', overrides: { forceMultiplier: 1.55, maxSpeed: 9, attackPathSearchLimit: 4 } };
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
