import { describe, expect, it } from 'vitest';
import { parseProgress } from './game-persistence.js';

describe('parseProgress', () => {
	it('기존 진행 데이터를 안전한 범위로 정리해 IndexedDB 이관에 사용한다', () => {
		const progress = parseProgress(
			JSON.stringify({
				highestStage: 8,
				lastPlayedStage: 5,
				totalClears: 12,
				stageStars: { '1': 3.4, '2': -1, invalid: 2 },
				version: 1
			})
		);

		expect(progress).toEqual({
			highestStage: 8,
				lastPlayedStage: 5,
				totalClears: 12,
				stageStars: { '1': 3, '2': 0 },
				version: 1
			});
	});

	it('손상되었거나 버전이 다른 데이터는 초기 진행도로 되돌린다', () => {
		expect(parseProgress('{')).toMatchObject({ highestStage: 1, totalClears: 0 });
		expect(parseProgress(JSON.stringify({ version: 2 }))).toMatchObject({ highestStage: 1, totalClears: 0 });
	});
});
