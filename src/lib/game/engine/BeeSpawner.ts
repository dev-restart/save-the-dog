import { PHYSICS } from '../constants.js';
import type { HiveData } from '../types.js';

interface HiveRuntime {
	data: HiveData;
	spawned: number;
	elapsedMs: number;
}

export class BeeSpawner {
	private hives: HiveRuntime[];

	constructor(hives: HiveData[]) {
		this.hives = hives.map((data) => ({ data, spawned: 0, elapsedMs: 0 }));
	}

	collectDueSpawns(deltaMs: number, activeBeeCount: number): HiveData[] {
		const due: HiveData[] = [];
		let projectedActiveCount = activeBeeCount;

		for (const hive of this.hives) {
			hive.elapsedMs += deltaMs;
			if (hive.spawned >= hive.data.beeCount) continue;
			if (projectedActiveCount >= PHYSICS.maxActiveBees) continue;
			if (hive.elapsedMs < hive.data.spawnIntervalMs) continue;

			// 한 프레임에 무한히 몰려 나오지 않도록 벌집당 최대 한 마리만 스폰한다.
			hive.elapsedMs = 0;
			hive.spawned += 1;
			projectedActiveCount += 1;
			due.push(hive.data);
		}

		return due;
	}
}
