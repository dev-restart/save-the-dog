export const BASE_WORLD = {
	width: 390,
	height: 693
} as const;

export type GamePhase = 'ready' | 'drawing' | 'simulating' | 'cleared' | 'failed' | 'transitioning';
export type SkinId = 'classic' | 'minecraft' | 'lego';
export type StageEnvironment = 'meadow' | 'volcanic' | 'forest';
export type DifficultyProfileId = 'tutorial' | 'shelter' | 'hazard' | 'swarm' | 'physics' | 'expert' | 'master';

export interface StageDifficulty {
	profile: DifficultyProfileId;
	overrides?: {
		intelligence?: number;
		aiRefreshBudget?: number;
		forceMultiplier?: number;
		maxSpeed?: number;
		attackCandidateLimit?: number;
		attackPathSearchLimit?: number;
	};
}

export interface Point {
	x: number;
	y: number;
}

export interface CanvasSize {
	width: number;
	height: number;
}

export type ObstacleType =
	| 'ground'
	| 'platform'
	| 'spike'
	| 'wall'
	| 'water'
	| 'lava'
	| 'brick'
	| 'terrain-block'
	| 'wood'
	| 'bomb'
	| 'boulder'
	| 'crate'
	| 'acid'
	| 'ice'
	| 'stone'
	| 'rolling-boulder'
	| 'no-draw-zone'
	| 'no-draw-ground'
	| 'no-draw-tree'
	| 'no-draw-rock';
export type BeeAttackStyle = 'direct' | 'flank-left' | 'flank-right' | 'breaker';
export type StageDesignType =
	| 'basic-cover'
	| 'fall-catch'
	| 'bridge-gap'
	| 'anchor-wall'
	| 'trap-basin'
	| 'split-hive'
	| 'terrain-pocket'
	| 'hive-box'
	| 'slope-slide'
	| 'pressure-cage'
	| 'final-composite';

export interface ObstacleData {
	type: ObstacleType;
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
	/** 연결 지형 compiler가 물리·Drawing 금지·렌더링에 함께 사용하는 저작 prefab. */
	prefabId?: import('./terrain/terrain-prefabs.js').TerrainPrefabId;
}

export interface HiveData {
	x: number;
	y: number;
	beeCount: number;
	spawnIntervalMs: number;
	beeForce?: number;
	attackStyle?: BeeAttackStyle;
}

export interface StageData {
	id: number;
	seed?: string;
	dog: Point;
	hives: HiveData[];
	obstacles: ObstacleData[];
	inkLimit: number;
	survivalMs: number;
	environment?: StageEnvironment;
	difficultyLabel?: string;
	designType?: StageDesignType;
	objectiveLabel?: string;
	objectiveHint?: string;
	dangerLabel?: string;
	designerNote?: string;
	difficulty?: StageDifficulty;
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
	| 'water'
	| 'lava'
	| 'brick'
	| 'terrain-block'
	| 'wood'
	| 'bomb'
	| 'boulder'
	| 'crate'
	| 'acid'
	| 'ice'
	| 'stone'
	| 'rolling-boulder'
	| 'drawing'
	| 'wall'
	| 'deadzone'
	| 'no-draw-zone'
	| 'no-draw-ground'
	| 'no-draw-tree'
	| 'no-draw-rock';
