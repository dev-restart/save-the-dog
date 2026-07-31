import Matter from 'matter-js';

export type DogHitReason = 'bee' | 'spike' | 'water' | 'lava' | 'bomb' | 'acid' | 'rolling-boulder' | 'deadzone';

export interface DogHit {
	reason: DogHitReason;
	dogBody: Matter.Body;
	otherBody: Matter.Body;
}

export function setupCollisionEvents(engine: Matter.Engine, onDogDead: (hit: DogHit) => void): () => void {
	const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
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
		label === 'rolling-boulder' ||
		label === 'deadzone'
	) {
		return label;
	}
	return null;
}
