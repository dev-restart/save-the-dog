import { PHYSICS } from '../constants.js';
import { lerp } from '../geometry.js';
import type { ObstacleData, StageData } from '../types.js';

function createSeededRandom(seed: number): () => number {
	let value = seed >>> 0;

	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 0xffffffff;
	};
}

function getDifficultyFactor(stageId: number): number {
	return Math.min(3.5, 1 + (stageId - 20) * 0.08);
}

function createObstacles(difficulty: number, rng: () => number): ObstacleData[] {
	const obstacles: ObstacleData[] = [
		{ type: 'ground', x: 195, y: 660, width: 390, height: 20 }
	];

	const platformCount = Math.min(4, Math.floor(1 + difficulty));
	for (let index = 0; index < platformCount; index += 1) {
		obstacles.push({
			type: 'platform',
			x: lerp(70, 320, rng()),
			y: lerp(330, 560, rng()),
			width: lerp(70, 145, rng()),
			height: 16,
			angle: lerp(-0.25, 0.25, rng())
		});
	}

	const spikeCount = Math.min(5, Math.floor(difficulty * 1.4));
	for (let index = 0; index < spikeCount; index += 1) {
		obstacles.push({
			type: 'spike',
			x: lerp(55, 335, rng()),
			y: 645,
			width: lerp(55, 120, rng()),
			height: 28
		});
	}

	if (difficulty > 2 && rng() > 0.45) {
		obstacles.push({
			type: 'wall',
			x: rng() > 0.5 ? 70 : 320,
			y: lerp(390, 520, rng()),
			width: 18,
			height: lerp(110, 190, rng())
		});
	}

	return obstacles;
}

export function generateStage(stageId: number): StageData {
	const rng = createSeededRandom(stageId * 2654435761);
	const difficulty = getDifficultyFactor(stageId);
	const hiveCount = difficulty > 2.4 && rng() > 0.5 ? 2 : 1;
	const beeCount = Math.min(PHYSICS.maxActiveBees, Math.floor(12 + difficulty * 4));
	const spawnIntervalMs = Math.max(130, Math.floor(240 - difficulty * 25));

	return {
		id: stageId,
		dog: {
			x: lerp(80, 310, rng()),
			y: lerp(320, 530, rng())
		},
		hives: Array.from({ length: hiveCount }, (_, index) => ({
			x: hiveCount === 1 ? lerp(55, 335, rng()) : index === 0 ? 60 : 330,
			y: lerp(75, 150, rng()),
			beeCount: Math.max(8, Math.floor(beeCount / hiveCount)),
			spawnIntervalMs,
			beeForce: Math.min(0.003, 0.0018 + difficulty * 0.00018)
		})),
		obstacles: createObstacles(difficulty, rng),
		inkLimit: Math.max(320, Math.floor(600 - (stageId - 20) * 8)),
		survivalMs: Math.min(8000, Math.floor(5200 + difficulty * 350)),
		difficultyLabel: `Loop ${stageId - 20}`
	};
}
