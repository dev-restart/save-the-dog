import Matter from 'matter-js';

export type DogHitReason = 'bee' | 'spike' | 'water' | 'lava' | 'bomb' | 'acid' | 'boulder' | 'rolling-boulder' | 'deadzone';

export interface DogHit {
	reason: DogHitReason;
	dogBody: Matter.Body;
	otherBody: Matter.Body;
}

export interface BombDetonation {
	bombBody: Matter.Body;
	triggerBody: Matter.Body;
}

// 폭탄은 다른 동적 위험물·그려진 선뿐 아니라 고정 지형에 떨어져도 기폭한다.
const BOMB_TRIGGER_LABELS = new Set([
	'dog',
	'drawing',
	'boulder',
	'rolling-boulder',
	'ground',
	'platform',
	'brick',
	'terrain-block',
	'wood',
	'crate',
	'ice',
	'stone',
	'no-draw-zone',
	'no-draw-ground',
	'no-draw-tree',
	'no-draw-rock',
	'wall',
	'water',
	'lava',
	'acid',
	'spike'
]);

export function setupCollisionEvents(
	engine: Matter.Engine,
	onDogDead: (hit: DogHit) => void,
	onBombDetonated?: (detonation: BombDetonation) => void
): () => void {
	const detonatedBombIds = new Set<number>();
	const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const bombBody = pair.bodyA.label === 'bomb' ? pair.bodyA : pair.bodyB.label === 'bomb' ? pair.bodyB : null;
			const triggerBody = bombBody === pair.bodyA ? pair.bodyB : bombBody === pair.bodyB ? pair.bodyA : null;
			if (bombBody && triggerBody && BOMB_TRIGGER_LABELS.has(triggerBody.label) && !detonatedBombIds.has(bombBody.id)) {
				detonatedBombIds.add(bombBody.id);
				onBombDetonated?.({ bombBody, triggerBody });
			}

			const dogBody = pair.bodyA.label === 'dog' ? pair.bodyA : pair.bodyB.label === 'dog' ? pair.bodyB : null;
			if (!dogBody) continue;

			const otherBody = pair.bodyA === dogBody ? pair.bodyB : pair.bodyA;
			const reason = dogHitReason(otherBody.label);

			if (reason) {
				onDogDead({ reason, dogBody, otherBody });
				return;
			}
		}
	};

	Matter.Events.on(engine, 'collisionStart', handler);
	return () => Matter.Events.off(engine, 'collisionStart', handler);
}

function dogHitReason(label: string): DogHitReason | null {
	if (
		label === 'bee' ||
		label === 'spike' ||
		label === 'water' ||
		label === 'lava' ||
		label === 'bomb' ||
		label === 'acid' ||
		label === 'boulder' ||
		label === 'rolling-boulder' ||
		label === 'deadzone'
	) {
		return label;
	}
	return null;
}
