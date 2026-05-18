import { describe, expect, it } from 'vitest';
import { BeeSpawner } from './BeeSpawner.js';

describe('BeeSpawner', () => {
	it('벌집별 스폰 간격에 맞춰 한 프레임당 벌집 하나에서 한 마리씩만 내보낸다', () => {
		const spawner = new BeeSpawner([{ x: 10, y: 10, beeCount: 2, spawnIntervalMs: 100 }]);

		expect(spawner.collectDueSpawns(99, 0)).toHaveLength(0);
		expect(spawner.collectDueSpawns(1, 0)).toHaveLength(1);
		expect(spawner.collectDueSpawns(1000, 1)).toHaveLength(1);
		expect(spawner.collectDueSpawns(1000, 2)).toHaveLength(0);
	});
});
