import Matter from 'matter-js';
import type { BeeBodyPlugin } from './ObjectFactory.js';
import { selectBombCollision } from './SimulationRules.js';

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

export type CrateDamageReason = 'drawing-impact' | 'breaker-bee-impact';

export interface CrateDamage {
	reason: CrateDamageReason;
	crateBody: Matter.Body;
	sourceBody: Matter.Body;
}

export function setupCollisionEvents(
	engine: Matter.Engine,
	onDogDead: (hit: DogHit) => void,
	onBombDetonated?: (detonation: BombDetonation) => void,
	onCrateDamaged?: (damage: CrateDamage) => void
): () => void {
	const detonatedBombIds = new Set<number>();
	const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const crateBody = pair.bodyA.label === 'crate' ? pair.bodyA : pair.bodyB.label === 'crate' ? pair.bodyB : null;
			const crateSource = crateBody === pair.bodyA ? pair.bodyB : crateBody === pair.bodyB ? pair.bodyA : null;
			if (crateBody && crateSource) {
				if (crateSource.label === 'drawing') {
					onCrateDamaged?.({ reason: 'drawing-impact', crateBody, sourceBody: crateSource });
				} else if (crateSource.label === 'bee' && (crateSource.plugin as BeeBodyPlugin | undefined)?.attackStyle === 'breaker') {
					onCrateDamaged?.({ reason: 'breaker-bee-impact', crateBody, sourceBody: crateSource });
				}
			}

			const bombCollision = selectBombCollision(pair.bodyA, pair.bodyB);
			if (bombCollision && !detonatedBombIds.has(bombCollision.bombBody.id)) {
				detonatedBombIds.add(bombCollision.bombBody.id);
				onBombDetonated?.(bombCollision);
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
