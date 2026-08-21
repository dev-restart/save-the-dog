import { PHYSICS } from '../constants.js';
import type { AudioPreferences } from '../audio.js';
import { DEFAULT_SKIN } from '../skins.js';
import type { StageScore } from '../scoring.js';
import type { GamePhase, SkinId, StoredProgress } from '../types.js';
import {
	GamePersistence,
	type CustomMapRecord,
	type GameSettings
} from './game-persistence.js';
import type { StageMapDocument } from '../stages/stage-map-schema.js';
import { CAMPAIGN_STAGE_COUNT } from '../stages/campaign.js';
import type { PlayerProgress } from '../online/types.js';

function clampCampaignStage(stageId: number): number {
	return Math.min(CAMPAIGN_STAGE_COUNT, Math.max(1, Math.floor(Number(stageId) || 1)));
}

function campaignStageStars(stageStars: Record<string, number>): Record<string, number> {
	return Object.fromEntries(
		Object.entries(stageStars).flatMap(([stageId, rawStars]) => {
			const numericStageId = Number(stageId);
			if (!Number.isInteger(numericStageId) || numericStageId < 1 || numericStageId > CAMPAIGN_STAGE_COUNT) return [];
			const stars = Number(rawStars);
			return [[String(numericStageId), Number.isFinite(stars) ? Math.min(3, Math.max(0, stars)) : 0]];
		})
	);
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
	isCustomStage = $state(false);
	skin = $state<SkinId>(DEFAULT_SKIN);
	hapticsEnabled = $state(true);
	musicEnabled = $state(true);
	sfxEnabled = $state(true);
	isLoaded = $state(false);
	private persistence = new GamePersistence();

	remainingSeconds = $derived(
		Math.max(0, (this.survivalDurationMs - this.survivalElapsedMs) / 1000)
	);
	inkPercent = $derived(Math.round(this.inkRatio * 100));
	canContinue = $derived(this.lastPlayedStage > 1 || this.highestStage > 1);
	totalStars = $derived(Object.values(this.stageStars).reduce((sum, stars) => sum + stars, 0));
	currentStageBestStars = $derived(this.stageStars[String(this.currentStage)] ?? 0);

	async load(): Promise<void> {
		const snapshot = await this.persistence.load();
		const progress = snapshot.progress;
		this.highestStage = clampCampaignStage(progress.highestStage);
		this.lastPlayedStage = Math.min(this.highestStage, clampCampaignStage(progress.lastPlayedStage));
		this.totalClears = Math.min(CAMPAIGN_STAGE_COUNT, progress.totalClears);
		this.stageStars = campaignStageStars(progress.stageStars);
		this.currentStage = this.lastPlayedStage;

		this.applySettings(snapshot.settings);
		this.isLoaded = true;
	}

	start(stageId = 1): void {
		this.hasStarted = true;
		this.isCustomStage = false;
		this.currentStage = clampCampaignStage(stageId);
		this.lastPlayedStage = this.currentStage;
		this.resetRuntime();
		this.saveProgress();
	}

	startCustom(stageId: number): void {
		this.hasStarted = true;
		this.isCustomStage = true;
		this.currentStage = Math.max(1, stageId);
		this.resetRuntime();
	}

	continue(): void {
		this.start(this.lastPlayedStage);
	}

	retry(): void {
		this.resetRuntime();
	}

	nextStage(): void {
		this.phase = 'transitioning';
		this.currentStage = Math.min(CAMPAIGN_STAGE_COUNT, this.currentStage + 1);
		this.lastPlayedStage = this.currentStage;
		this.resetRuntime();
		this.saveProgress();
	}

	returnToMenu(): void {
		this.hasStarted = false;
		this.phase = 'ready';
		if (!this.isCustomStage) this.saveProgress();
		this.isCustomStage = false;
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
		this.saveSettings();
	}

	setHapticsEnabled(enabled: boolean): void {
		this.hapticsEnabled = enabled;
		this.saveSettings();
	}

	setMusicEnabled(enabled: boolean): void {
		this.musicEnabled = enabled;
		this.saveSettings();
	}

	setSfxEnabled(enabled: boolean): void {
		this.sfxEnabled = enabled;
		this.saveSettings();
	}

	getAudioPreferences(): AudioPreferences {
		return {
			musicEnabled: this.musicEnabled,
			sfxEnabled: this.sfxEnabled
		};
	}

	markCleared(score: StageScore, hintViews = 0): void {
		this.phase = 'cleared';
		this.currentScore = score;
		if (!this.isCustomStage) {
			if (this.currentStageBestStars === 0) this.totalClears += 1;
			this.highestStage = Math.min(CAMPAIGN_STAGE_COUNT, Math.max(this.highestStage, this.currentStage + 1));
			this.stageStars = {
				...this.stageStars,
				[String(this.currentStage)]: Math.max(this.currentStageBestStars, score.stars)
			};
			this.lastPlayedStage = Math.min(CAMPAIGN_STAGE_COUNT, this.currentStage + 1);
			this.saveProgress();
		}
		void this.persistence.recordStageResult({
			stageId: this.currentStage,
			status: 'cleared',
			hintViews,
			score,
			clearTimeMs: this.survivalElapsedMs
		}).catch(() => undefined);
	}

	markFailed(hintViews = 0): void {
		this.phase = 'failed';
		void this.persistence.recordStageResult({
			stageId: this.currentStage,
			status: 'failed',
			hintViews
		}).catch(() => undefined);
	}

	saveCustomMap(document: StageMapDocument, id?: string, onlineMapId?: string, sourceOnlineMapId?: string | null): Promise<CustomMapRecord> {
		return this.persistence.saveCustomMap(document, id, onlineMapId, sourceOnlineMapId);
	}

	listCustomMaps(): Promise<CustomMapRecord[]> {
		return this.persistence.listCustomMaps();
	}

	deleteCustomMap(id: string): Promise<void> {
		return this.persistence.deleteCustomMap(id);
	}

	applyServerProgress(progress: PlayerProgress): void {
		this.highestStage = clampCampaignStage(progress.highestStage);
		this.lastPlayedStage = Math.min(this.highestStage, clampCampaignStage(progress.lastPlayedStage));
		if (!this.hasStarted) this.currentStage = this.lastPlayedStage;
		this.totalClears = Math.min(CAMPAIGN_STAGE_COUNT, Math.max(0, progress.totalClears));
		this.stageStars = campaignStageStars(progress.stageStars);
		this.saveProgress();
	}

	getProgressSnapshot(): PlayerProgress {
		return {
			highestStage: this.highestStage,
			lastPlayedStage: this.lastPlayedStage,
			totalClears: this.totalClears,
			totalStars: this.totalStars,
			stageStars: { ...this.stageStars },
			version: 1
		};
	}

	replaceCustomMapCache(records: CustomMapRecord[]): Promise<void> {
		return this.persistence.replaceCustomMaps(records);
	}

	cacheCustomMap(record: CustomMapRecord): Promise<void> {
		return this.persistence.cacheCustomMap(record);
	}

	private resetRuntime(): void {
		this.phase = 'ready';
		this.inkRatio = 1;
		this.survivalElapsedMs = 0;
		this.currentScore = null;
	}

	private applySettings(settings: GameSettings): void {
		this.skin = settings.skin ?? DEFAULT_SKIN;
		this.hapticsEnabled = settings.hapticsEnabled;
		this.musicEnabled = settings.musicEnabled;
		this.sfxEnabled = settings.sfxEnabled;
	}

	private saveSettings(): void {
		const settings: GameSettings = {
			skin: this.skin,
			hapticsEnabled: this.hapticsEnabled,
			musicEnabled: this.musicEnabled,
			sfxEnabled: this.sfxEnabled
		};
		void this.persistence.saveSettings(settings).catch(() => undefined);
	}

	private saveProgress(): void {
		const progress: StoredProgress = {
			highestStage: clampCampaignStage(Math.max(this.highestStage, this.currentStage)),
			lastPlayedStage: clampCampaignStage(this.lastPlayedStage),
			totalClears: Math.min(CAMPAIGN_STAGE_COUNT, this.totalClears),
			stageStars: campaignStageStars(this.stageStars),
			version: 1
		};

		this.highestStage = progress.highestStage;
		this.lastPlayedStage = progress.lastPlayedStage;
		void this.persistence.saveProgress(progress).catch(() => undefined);
	}
}
