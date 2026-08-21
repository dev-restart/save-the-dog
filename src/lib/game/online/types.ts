import type { StageMapDocument } from '../stages/stage-map-schema.js';

export interface OnlineIdentity {
	registered: boolean;
	nickname?: string;
}

export interface PlayerProgress {
	highestStage: number;
	lastPlayedStage: number;
	totalClears: number;
	totalStars: number;
	stageStars: Record<string, number>;
	version: 1;
}

export interface OnlineMapSummary {
	mapId: string;
	title: string;
	authorNickname: string;
	contentHash: string;
	createdAt: string;
	updatedAt: string;
	downloadCount: number;
	objectCount: number;
}

export interface OnlineMap extends OnlineMapSummary {
	document: StageMapDocument;
}

export interface OnlineMapsResponse {
	maps: OnlineMapSummary[];
	nextCursor: string | null;
}

export interface OnlineLeaderboardEntry {
	nickname: string;
	stars: number;
	clearTimeMs: number | null;
	inkRatio: number | null;
	hintViews: number;
	updatedAt: string;
}

export interface PlayerLeaderboardEntry {
	nickname: string;
	highestStage: number;
	totalStars: number;
	totalClears: number;
	updatedAt: string;
}
