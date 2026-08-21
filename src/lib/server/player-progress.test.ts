import { describe, expect, it } from 'vitest';

import { buildAuthoritativeProgress, normalizePlayerProgress } from './player-progress.js';

describe('normalizePlayerProgress', () => {
	it('진행 동기화 요청에서는 lastPlayedStage만 받아들인다', () => {
		expect(
			normalizePlayerProgress({
				highestStage: 999,
				lastPlayedStage: 24,
				stageStars: { '1': 2.7, '2': 1.2, '501': 3, invalid: 2 },
				version: 1
			})
		).toEqual({
			lastPlayedStage: 24,
			version: 1
		});
	});
});

describe('buildAuthoritativeProgress', () => {
	it('검증된 stage_scores만으로 진행도를 계산한다', () => {
		expect(
			buildAuthoritativeProgress({
				stageStars: { '1': 3, '2': 1.5 },
				maxClearedStage: 2,
				storedLastPlayedStage: 99
			})
		).toEqual({
			highestStage: 3,
			lastPlayedStage: 3,
			totalClears: 2,
			totalStars: 4.5,
			stageStars: { '1': 3, '2': 1.5 },
			version: 1
		});
	});

	it('검증 기록이 없으면 조작된 진행도 대신 1단계를 유지한다', () => {
		expect(
			buildAuthoritativeProgress({
				stageStars: {},
				maxClearedStage: 0,
				storedLastPlayedStage: 88
			})
		).toEqual({
			highestStage: 1,
			lastPlayedStage: 1,
			totalClears: 0,
			totalStars: 0,
			stageStars: {},
			version: 1
		});
	});

	it('비연속 stage score는 해금 기준으로 인정하지 않는다', () => {
		expect(
			buildAuthoritativeProgress({
				stageStars: { '1': 3, '10': 3 },
				maxClearedStage: 10,
				storedLastPlayedStage: 10
			})
		).toEqual({
			highestStage: 2,
			lastPlayedStage: 2,
			totalClears: 2,
			totalStars: 6,
			stageStars: { '1': 3, '10': 3 },
			version: 1
		});
	});
});
