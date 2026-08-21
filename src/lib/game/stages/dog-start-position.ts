import { PHYSICS } from '../constants.js';
import { compileTerrainPrefab } from '../terrain/terrain-compiler.js';
import type { ObstacleData, ObstacleType, StageData } from '../types.js';

const MAX_SUPPORT_GAP = 80;
const HORIZONTAL_EPSILON = 1e-6;
const SUPPORT_TYPES = new Set<ObstacleType>([
	'ground',
	'platform',
	'wall',
	'brick',
	'terrain-block',
	'wood',
	'crate',
	'ice',
	'stone',
	'no-draw-zone',
	'no-draw-ground',
	'no-draw-rock'
]);

export function placeDogOnNearbySupport(stage: StageData): StageData {
	if (stage.designType === 'fall-catch') return stage;

	const support = nearestSupportBelow(stage);
	if (!support) return stage;

	return {
		...stage,
		dog: { ...stage.dog, y: support.top - PHYSICS.dogRadius }
	};
}

function nearestSupportBelow(stage: StageData): { top: number; gap: number } | null {
	let nearest: { top: number; gap: number } | null = null;
	for (const obstacle of stage.obstacles) {
		if (!SUPPORT_TYPES.has(obstacle.type)) continue;

		for (const top of supportTopsAt(stage.dog.x, obstacle)) {
			const dogBottom = stage.dog.y + PHYSICS.dogRadius;
			const gap = top - dogBottom;
			if (gap < 0 || gap > MAX_SUPPORT_GAP || (nearest && gap >= nearest.gap)) continue;
			nearest = { top, gap };
		}
	}
	return nearest;
}

function supportTopsAt(dogX: number, obstacle: ObstacleData): number[] {
	if (!obstacle.prefabId) {
		return isDogHorizontallyOver(dogX, obstacle) ? [obstacle.y - obstacle.height / 2] : [];
	}

	const source = compileTerrainPrefab(obstacle.prefabId);
	const compiled = compileTerrainPrefab(obstacle.prefabId, {
		position: { x: obstacle.x, y: obstacle.y },
		rotation: obstacle.angle ?? 0,
		scale: {
			x: obstacle.width / source.bounds.width,
			y: obstacle.height / source.bounds.height
		}
	});

	return compiled.supportSegments.flatMap((segment) => {
		if (Math.abs(segment.to.y - segment.from.y) > HORIZONTAL_EPSILON) return [];
		const minX = Math.min(segment.from.x, segment.to.x);
		const maxX = Math.max(segment.from.x, segment.to.x);
		if (dogX < minX || dogX > maxX) return [];
		return [(segment.from.y + segment.to.y) / 2];
	});
}

function isDogHorizontallyOver(dogX: number, obstacle: ObstacleData): boolean {
	return dogX >= obstacle.x - obstacle.width / 2 && dogX <= obstacle.x + obstacle.width / 2;
}
