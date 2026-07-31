import { browser } from '$app/environment';
import type { GamePhase, SkinId } from './types.js';

export const AUDIO_STORAGE_KEY = 'save_the_dog_audio';

export interface AudioPreferences {
	musicEnabled: boolean;
	sfxEnabled: boolean;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
	musicEnabled: true,
	sfxEnabled: true
};

const BGM_VOLUME = 0.32;
const SFX_VOLUME = 0.46;
const BEE_BUZZ_VOLUME = SFX_VOLUME * 0.42;
const BARRIER_TAP_COOLDOWN_MS = 160;

export class GameAudioManager {
	private bgm: HTMLAudioElement | null = null;
	private beeBuzz: HTMLAudioElement | null = null;
	private currentSkin: SkinId | null = null;
	private musicEnabled = true;
	private sfxEnabled = true;
	private unlocked = false;
	private beeBuzzing = false;
	private lastBarrierTapAt = 0;

	constructor(preferences: AudioPreferences = DEFAULT_AUDIO_PREFERENCES) {
		this.setPreferences(preferences);
	}

	setPreferences(preferences: AudioPreferences): void {
		this.musicEnabled = preferences.musicEnabled;
		this.sfxEnabled = preferences.sfxEnabled;
		if (!this.musicEnabled) {
			this.bgm?.pause();
		} else if (this.unlocked) {
			void this.bgm?.play().catch(() => undefined);
		}

		this.syncBeeBuzzPlayback();
	}

	setSkin(skin: SkinId): void {
		if (!browser || this.currentSkin === skin) return;
		this.currentSkin = skin;
		const nextBgm = new Audio(`/skins/${skin}/background.mp3`);
		nextBgm.loop = true;
		nextBgm.volume = BGM_VOLUME;
		nextBgm.preload = 'auto';

		const previous = this.bgm;
		this.bgm = nextBgm;
		previous?.pause();
		if (this.musicEnabled && this.unlocked) void nextBgm.play().catch(() => undefined);
	}

	attemptAutoplay(): void {
		if (!browser || !this.musicEnabled || !this.bgm) return;
		void this.bgm
			.play()
			.then(() => {
				this.unlocked = true;
				this.syncBeeBuzzPlayback();
			})
			.catch(() => undefined);
	}

	unlock(): void {
		this.unlocked = true;
		if (this.musicEnabled) void this.bgm?.play().catch(() => undefined);
		this.syncBeeBuzzPlayback();
	}

	syncPhase(phase: GamePhase): void {
		if (!this.bgm) return;
		this.bgm.volume = phase === 'simulating' ? BGM_VOLUME * 0.78 : BGM_VOLUME;
	}

	setBeeBuzzing(active: boolean): void {
		this.beeBuzzing = active;
		this.syncBeeBuzzPlayback();
	}

	playBarrierTap(): void {
		this.playSfx('/audio/barrier-tap.wav', SFX_VOLUME, BARRIER_TAP_COOLDOWN_MS);
	}

	destroy(): void {
		this.bgm?.pause();
		this.beeBuzz?.pause();
		this.bgm = null;
		this.beeBuzz = null;
	}

	private syncBeeBuzzPlayback(): void {
		if (!browser) return;

		if (!this.beeBuzz) {
			this.beeBuzz = new Audio('/audio/bee-buzz.wav');
			this.beeBuzz.loop = true;
			this.beeBuzz.volume = BEE_BUZZ_VOLUME;
			this.beeBuzz.preload = 'auto';
		}

		if (this.sfxEnabled && this.unlocked && this.beeBuzzing) {
			void this.beeBuzz.play().catch(() => undefined);
			return;
		}

		this.beeBuzz.pause();
		this.beeBuzz.currentTime = 0;
	}

	private playSfx(src: string, volume: number, cooldownMs: number): void {
		if (!browser || !this.sfxEnabled || !this.unlocked) return;
		const now = performance.now();
		if (now - this.lastBarrierTapAt < cooldownMs) return;
		this.lastBarrierTapAt = now;

		const audio = new Audio(src);
		audio.volume = volume;
		void audio.play().catch(() => undefined);
	}
}
