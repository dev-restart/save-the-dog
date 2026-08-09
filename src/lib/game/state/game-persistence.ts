import { browser } from '$app/environment';
import {
	HAPTIC_STORAGE_KEY,
	SKIN_STORAGE_KEY,
	STORAGE_KEY
} from '../constants.js';
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_PREFERENCES, type AudioPreferences } from '../audio.js';
import { DEFAULT_SKIN, isSkinId } from '../skins.js';
import type { StageScore } from '../scoring.js';
import type { StageMapDocument } from '../stages/stage-map-schema.js';
import type { SkinId, StoredProgress } from '../types.js';

const DATABASE_NAME = 'save-the-dog';
const DATABASE_VERSION = 1;
const PROFILE_STORE = 'profile';
const SETTINGS_STORE = 'settings';
const STAGE_RESULTS_STORE = 'stage-results';
const CUSTOM_MAPS_STORE = 'custom-maps';
const META_STORE = 'meta';
const PROFILE_ID = 'main';
const SETTINGS_ID = 'main';
const LEGACY_MIGRATION_ID = 'legacy-local-storage-v1';

const DEFAULT_PROGRESS: StoredProgress = {
	highestStage: 1,
	lastPlayedStage: 1,
	totalClears: 0,
	stageStars: {},
	version: 1
};

export interface GameSettings extends AudioPreferences {
	skin: SkinId;
	hapticsEnabled: boolean;
}

export interface StageResultRecord {
	stageId: number;
	attempts: number;
	clears: number;
	failures: number;
	bestStars: number;
	bestInkRatio: number;
	bestClearTimeMs: number | null;
	lastStatus: 'cleared' | 'failed';
	lastHintViews: number;
	updatedAt: number;
}

export interface CustomMapRecord {
	id: string;
	title: string;
	document: StageMapDocument;
	createdAt: number;
	updatedAt: number;
	onlineMapId?: string;
	sourceOnlineMapId?: string;
}

export interface GamePersistenceSnapshot {
	progress: StoredProgress;
	settings: GameSettings;
}

export interface StageResultInput {
	stageId: number;
	status: 'cleared' | 'failed';
	hintViews: number;
	score?: StageScore;
	clearTimeMs?: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
	skin: DEFAULT_SKIN,
	hapticsEnabled: true,
	...DEFAULT_AUDIO_PREFERENCES
};

export function parseProgress(raw: string | null | undefined): StoredProgress {
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

	const stars: Record<string, number> = {};
	for (const [stageId, rawStars] of Object.entries(value)) {
		const numericStageId = Number(stageId);
		if (!Number.isInteger(numericStageId) || numericStageId < 1) continue;
		const score = Math.min(3, Math.max(0, Number(rawStars) || 0));
		stars[String(numericStageId)] = Math.round(score * 2) / 2;
	}
	return stars;
}

function normalizeSettings(value: Partial<GameSettings> | undefined): GameSettings {
	const skin = value?.skin;
	return {
		skin: skin === 'classic' || skin === 'minecraft' || skin === 'lego' ? skin : DEFAULT_SKIN,
		hapticsEnabled: value?.hapticsEnabled !== false,
		musicEnabled: value?.musicEnabled !== false,
		sfxEnabled: value?.sfxEnabled !== false
	};
}

export class GamePersistence {
	private databasePromise: Promise<IDBDatabase | null> | null = null;
	private writeQueue: Promise<void> = Promise.resolve();

	async load(): Promise<GamePersistenceSnapshot> {
		if (!browser) return this.defaultSnapshot();

		try {
			const database = await this.getDatabase();
			if (!database) return this.defaultSnapshot();

			await this.migrateLegacyStorage(database);
			const [storedProgress, storedSettings] = await Promise.all([
				readRecord<StoredProgress & { id: string }>(database, PROFILE_STORE, PROFILE_ID),
				readRecord<GameSettings & { id: string }>(database, SETTINGS_STORE, SETTINGS_ID)
			]);

			return {
				progress: parseProgress(storedProgress ? JSON.stringify(storedProgress) : null),
				settings: normalizeSettings(storedSettings)
			};
		} catch {
			return this.defaultSnapshot();
		}
	}

	saveProgress(progress: StoredProgress): Promise<void> {
		return this.enqueueWrite(async (database) => {
			await putRecord(database, PROFILE_STORE, { id: PROFILE_ID, ...parseProgress(JSON.stringify(progress)) });
		});
	}

	saveSettings(settings: GameSettings): Promise<void> {
		return this.enqueueWrite(async (database) => {
			await putRecord(database, SETTINGS_STORE, { id: SETTINGS_ID, ...normalizeSettings(settings) });
		});
	}

	recordStageResult(input: StageResultInput): Promise<void> {
		return this.enqueueWrite(async (database) => {
			const existing = await readRecord<StageResultRecord>(database, STAGE_RESULTS_STORE, input.stageId);
			const score = input.score;
			const isClear = input.status === 'cleared';
			const currentBestTime = existing?.bestClearTimeMs ?? null;
			const nextBestTime = isClear && Number.isFinite(input.clearTimeMs)
				? currentBestTime === null
					? Math.max(0, input.clearTimeMs ?? 0)
					: Math.min(currentBestTime, Math.max(0, input.clearTimeMs ?? 0))
				: currentBestTime;

			const record: StageResultRecord = {
				stageId: input.stageId,
				attempts: (existing?.attempts ?? 0) + 1,
				clears: (existing?.clears ?? 0) + (isClear ? 1 : 0),
				failures: (existing?.failures ?? 0) + (isClear ? 0 : 1),
				bestStars: Math.max(existing?.bestStars ?? 0, score?.stars ?? 0),
				bestInkRatio: Math.max(existing?.bestInkRatio ?? 0, score?.inkRatio ?? 0),
				bestClearTimeMs: nextBestTime,
				lastStatus: input.status,
				lastHintViews: Math.max(0, input.hintViews),
				updatedAt: Date.now()
			};

			await putRecord(database, STAGE_RESULTS_STORE, record);
		});
	}

	async getStageResult(stageId: number): Promise<StageResultRecord | null> {
		const database = await this.getDatabase();
		if (!database) return null;
		return (await readRecord<StageResultRecord>(database, STAGE_RESULTS_STORE, stageId)) ?? null;
	}

	saveCustomMap(document: StageMapDocument, id = createMapId(), onlineMapId?: string, sourceOnlineMapId?: string | null): Promise<CustomMapRecord> {
		return this.enqueueWrite(async (database) => {
			const existing = await readRecord<CustomMapRecord>(database, CUSTOM_MAPS_STORE, id);
			const now = Date.now();
			const storedDocument = JSON.parse(JSON.stringify(document)) as StageMapDocument;
			const record: CustomMapRecord = {
				id,
				title: storedDocument.title.trim() || `사용자 맵 ${storedDocument.stageId}`,
				document: storedDocument,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
				onlineMapId: onlineMapId ?? existing?.onlineMapId,
				sourceOnlineMapId: sourceOnlineMapId === null ? undefined : sourceOnlineMapId ?? existing?.sourceOnlineMapId
			};
			await putRecord(database, CUSTOM_MAPS_STORE, record);
			return record;
		});
	}

	async listCustomMaps(): Promise<CustomMapRecord[]> {
		const database = await this.getDatabase();
		if (!database) return [];
		const records = await readAllRecords<CustomMapRecord>(database, CUSTOM_MAPS_STORE);
		return records.sort((left, right) => right.updatedAt - left.updatedAt);
	}

	deleteCustomMap(id: string): Promise<void> {
		return this.enqueueWrite(async (database) => {
			await deleteRecord(database, CUSTOM_MAPS_STORE, id);
		});
	}

	private defaultSnapshot(): GamePersistenceSnapshot {
		return {
			progress: { ...DEFAULT_PROGRESS },
			settings: { ...DEFAULT_GAME_SETTINGS }
		};
	}

	private async getDatabase(): Promise<IDBDatabase | null> {
		if (!browser || typeof indexedDB === 'undefined') return null;
		if (!this.databasePromise) this.databasePromise = openDatabase();
		return this.databasePromise;
	}

	private enqueueWrite<T>(task: (database: IDBDatabase) => Promise<T>): Promise<T> {
		const operation = this.writeQueue.then(async () => {
			const database = await this.getDatabase();
			if (!database) throw new Error('IndexedDB를 사용할 수 없습니다.');
			return task(database);
		});
		this.writeQueue = operation.then(
			() => undefined,
			() => undefined
		);
		return operation;
	}

	private async migrateLegacyStorage(database: IDBDatabase): Promise<void> {
		const migrated = await readRecord<{ id: string }>(database, META_STORE, LEGACY_MIGRATION_ID);
		if (migrated) return;

		const progress = parseProgress(localStorage.getItem(STORAGE_KEY));
		const audio = parseLegacyAudioPreferences(localStorage.getItem(AUDIO_STORAGE_KEY));
		const legacySkin = localStorage.getItem(SKIN_STORAGE_KEY);
		const settings = normalizeSettings({
			...(isSkinId(legacySkin) ? { skin: legacySkin } : {}),
			hapticsEnabled: localStorage.getItem(HAPTIC_STORAGE_KEY) !== 'off',
			...audio
		});

		const transaction = database.transaction([PROFILE_STORE, SETTINGS_STORE, META_STORE], 'readwrite');
		transaction.objectStore(PROFILE_STORE).put({ id: PROFILE_ID, ...progress });
		transaction.objectStore(SETTINGS_STORE).put({ id: SETTINGS_ID, ...settings });
		transaction.objectStore(META_STORE).put({ id: LEGACY_MIGRATION_ID, migratedAt: Date.now() });
		await completeTransaction(transaction);

		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(SKIN_STORAGE_KEY);
		localStorage.removeItem(HAPTIC_STORAGE_KEY);
		localStorage.removeItem(AUDIO_STORAGE_KEY);
	}
}

function parseLegacyAudioPreferences(raw: string | null): AudioPreferences {
	try {
		const parsed = JSON.parse(raw ?? '{}') as Partial<AudioPreferences>;
		return {
			musicEnabled: parsed.musicEnabled !== false,
			sfxEnabled: parsed.sfxEnabled !== false
		};
	} catch {
		return { ...DEFAULT_AUDIO_PREFERENCES };
	}
}

function createMapId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `map-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
	return new Promise((resolve) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(PROFILE_STORE)) database.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
			if (!database.objectStoreNames.contains(SETTINGS_STORE)) database.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
			if (!database.objectStoreNames.contains(STAGE_RESULTS_STORE)) database.createObjectStore(STAGE_RESULTS_STORE, { keyPath: 'stageId' });
			if (!database.objectStoreNames.contains(CUSTOM_MAPS_STORE)) database.createObjectStore(CUSTOM_MAPS_STORE, { keyPath: 'id' });
			if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'id' });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => resolve(null);
		request.onblocked = () => resolve(null);
	});
}

function readRecord<T>(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
		request.onsuccess = () => resolve(request.result as T | undefined);
		request.onerror = () => reject(request.error);
	});
}

function readAllRecords<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
		request.onsuccess = () => resolve(request.result as T[]);
		request.onerror = () => reject(request.error);
	});
}

function putRecord(database: IDBDatabase, storeName: string, value: unknown): Promise<void> {
	const transaction = database.transaction(storeName, 'readwrite');
	transaction.objectStore(storeName).put(value);
	return completeTransaction(transaction);
}

function deleteRecord(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
	const transaction = database.transaction(storeName, 'readwrite');
	transaction.objectStore(storeName).delete(key);
	return completeTransaction(transaction);
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}
