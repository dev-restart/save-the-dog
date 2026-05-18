export const BASE_WORLD = {
	width: 390,
	height: 693
} as const;

export type GamePhase = 'ready' | 'drawing' | 'simulating' | 'cleared' | 'failed' | 'transitioning';
export type SkinId = 'classic' | 'minecraft' | 'lego';

export interface Point {
	x: number;
	y: number;
}

export interface CanvasSize {
	width: number;
	height: number;
}

export type ObstacleType = 'ground' | 'platform' | 'spike' | 'wall';

export interface ObstacleData {
	type: ObstacleType;
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
}

export interface HiveData {
	x: number;
	y: number;
	beeCount: number;
	spawnIntervalMs: number;
	beeForce?: number;
}

export interface StageData {
	id: number;
	dog: Point;
	hives: HiveData[];
	obstacles: ObstacleData[];
	inkLimit: number;
	survivalMs: number;
	difficultyLabel?: string;
}

export interface StoredProgress {
	highestStage: number;
	lastPlayedStage: number;
	totalClears: number;
	stageStars: Record<string, number>;
	version: 1;
}

export interface GameEngineSnapshot {
	phase: GamePhase;
	inkRatio: number;
	survivalElapsedMs: number;
	stageId: number;
}

export type BodyLabel =
	| 'dog'
	| 'bee'
	| 'hive'
	| 'ground'
	| 'platform'
	| 'spike'
	| 'drawing'
	| 'wall'
	| 'deadzone';
