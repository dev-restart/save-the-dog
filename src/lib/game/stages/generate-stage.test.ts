import { describe, expect, it } from 'vitest';
import { generateStage } from './generate-stage.js';

describe('generateStage', () => {
	it('21단계 이후에도 강아지 받침대와 난이도형 장애물을 결정론적으로 생성한다', () => {
		const first = generateStage(24);
		const second = generateStage(24);

		expect(second).toEqual(first);
		expect(first.obstacles[0]?.type).toBe('ground');
		expect(first.obstacles.some((obstacle) => obstacle.type === 'platform' && obstacle.x === first.dog.x)).toBe(true);
		expect(first.obstacles.length).toBeGreaterThanOrEqual(4);
	});

	it('단계가 올라갈수록 벌/스폰/장애물 압박을 높이고 잉크를 줄인다', () => {
		const early = generateStage(21);
		const late = generateStage(45);
		const earlyBeeCount = early.hives.reduce((total, hive) => total + hive.beeCount, 0);
		const lateBeeCount = late.hives.reduce((total, hive) => total + hive.beeCount, 0);

		expect(lateBeeCount).toBeGreaterThanOrEqual(earlyBeeCount);
		expect(Math.min(...late.hives.map((hive) => hive.spawnIntervalMs))).toBeLessThanOrEqual(
			Math.min(...early.hives.map((hive) => hive.spawnIntervalMs))
		);
		expect(late.inkLimit).toBeLessThan(early.inkLimit);
		expect(late.obstacles.length).toBeGreaterThanOrEqual(early.obstacles.length);
	});
});
