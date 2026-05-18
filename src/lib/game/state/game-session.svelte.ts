import { browser } from '$app/environment';
import { PHYSICS, SKIN_STORAGE_KEY, STORAGE_KEY } from '../constants.js';
import { DEFAULT_SKIN, isSkinId } from '../skins.js';
import type { StageScore } from '../scoring.js';
import type { GamePhase, SkinId, StoredProgress } from '../types.js';

const DEFAULT_PROGRESS: StoredProgress = {
	highestStage: 1,
	lastPlayedStage: 1,
	totalClears: 0,
	stageStars: {},
	version: 1
};

function parseProgress(raw: string | null): StoredProgress {
	if (!raw) return { ...DEFAULT_PROGRESS };

	try {
		const parsed = JSON.parse(raw) as Partial<StoredProgress>;
		if (parsed.version !== 1) return { ...DEFAULT_PROGRESS };

		return {
			highestStage: Math.max(1, Number(parsed.highestStage) || 1),
			lastPlayedStage: Math.max(1, Number(parsed.lastPlayedStage) || 1),
			totalClears: Math.max(0, Number(parsed.totalClears) || 0),
			stageStars: parseStageStars(parsed.stageStars),
			version: 1
		};
	} catch {
		return { ...DEFAULT_PROGRESS };
	}
}

function parseStageStars(value: unknown): Record<string, number> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

	// 저장된 값이 손상돼도 진행 데이터 전체가 깨지지 않도록 stage id와 0.5 단위 별점만 복구한다.
	const stars: Record<string, number> = {};
	for (const [stageId, rawStars] of Object.entries(value)) {
		const numericStageId = Math.max(1, Number(stageId) || 0);
		if (!numericStageId) continue;
		const score = Math.min(3, Math.max(0, Number(rawStars) || 0));
		stars[String(numericStageId)] = Math.round(score * 2) / 2;
	}
	return stars;
}

export class GameSessionState {
	currentStage = $state(1);
	phase = $state<GamePhase>('ready');
	inkRatio = $state(1);
	survivalElapsedMs = $state(0);
	survivalDurationMs = $state<number>(PHYSICS.defaultSurvivalMs);
	highestStage = $state(1);
	lastPlayedStage = $state(1);
	totalClears = $state(0);
	stageStars = $state<Record<string, number>>({});
	currentScore = $state<StageScore | null>(null);
	hasStarted = $state(false);
	skin = $state<SkinId>(DEFAULT_SKIN);

	remainingSeconds = $derived(
		Math.max(0, (this.survivalDurationMs - this.survivalElapsedMs) / 1000)
	);
	inkPercent = $derived(Math.round(this.inkRatio * 100));
	canContinue = $derived(this.lastPlayedStage > 1 || this.highestStage > 1);
	totalStars = $derived(Object.values(this.stageStars).reduce((sum, stars) => sum + stars, 0));
	currentStageBestStars = $derived(this.stageStars[String(this.currentStage)] ?? 0);

	load(): void {
		if (!browser) return;
		const progress = parseProgress(localStorage.getItem(STORAGE_KEY));
		this.highestStage = progress.highestStage;
		this.lastPlayedStage = progress.lastPlayedStage;
		this.totalClears = progress.totalClears;
		this.stageStars = progress.stageStars;
		this.currentStage = progress.lastPlayedStage;

		const savedSkin = localStorage.getItem(SKIN_STORAGE_KEY);
		this.skin = isSkinId(savedSkin) ? savedSkin : DEFAULT_SKIN;
	}

	start(stageId = 1): void {
		this.hasStarted = true;
		this.currentStage = Math.max(1, stageId);
		this.lastPlayedStage = this.currentStage;
		this.resetRuntime();
		this.saveProgress();
	}

	continue(): void {
		this.start(this.lastPlayedStage);
	}

	retry(): void {
		this.resetRuntime();
	}

	nextStage(): void {
		this.phase = 'transitioning';
		this.currentStage += 1;
		this.lastPlayedStage = this.currentStage;
		this.resetRuntime();
		this.saveProgress();
	}

	returnToMenu(): void {
		this.hasStarted = false;
		this.phase = 'ready';
		this.saveProgress();
	}

	setPhase(phase: GamePhase): void {
		this.phase = phase;
	}

	setInkRatio(value: number): void {
		this.inkRatio = Math.min(1, Math.max(0, value));
	}

	setSurvivalElapsed(value: number): void {
		this.survivalElapsedMs = Math.max(0, value);
	}

	setSurvivalDuration(value: number): void {
		this.survivalDurationMs = Math.max(1000, value);
	}

	setSkin(skin: SkinId): void {
		this.skin = skin;
		if (browser) localStorage.setItem(SKIN_STORAGE_KEY, skin);
	}

	markCleared(score: StageScore): void {
		this.phase = 'cleared';
		this.currentScore = score;
		this.totalClears += 1;
		this.highestStage = Math.max(this.highestStage, this.currentStage + 1);
		this.stageStars = {
			...this.stageStars,
			[String(this.currentStage)]: Math.max(this.currentStageBestStars, score.stars)
		};
		this.lastPlayedStage = this.currentStage + 1;
		this.saveProgress();
	}

	markFailed(): void {
		this.phase = 'failed';
	}

	private resetRuntime(): void {
		this.phase = 'ready';
		this.inkRatio = 1;
		this.survivalElapsedMs = 0;
		this.currentScore = null;
	}

	private saveProgress(): void {
		if (!browser) return;

		const progress: StoredProgress = {
			highestStage: Math.max(this.highestStage, this.currentStage),
			lastPlayedStage: Math.max(1, this.lastPlayedStage),
			totalClears: this.totalClears,
			stageStars: this.stageStars,
			version: 1
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
		this.highestStage = progress.highestStage;
		this.lastPlayedStage = progress.lastPlayedStage;
	}
}
