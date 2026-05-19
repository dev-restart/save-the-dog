import Matter from 'matter-js';

export type DogHitReason = 'bee' | 'spike' | 'deadzone';

export function setupCollisionEvents(engine: Matter.Engine, onDogDead: (reason: DogHitReason) => void): () => void {
	const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const labels = [pair.bodyA.label, pair.bodyB.label];
			if (!labels.includes('dog')) continue;

			const reason = labels.find((label): label is DogHitReason =>
				label === 'bee' || label === 'spike' || label === 'deadzone'
			);

			if (reason) {
				onDogDead(reason);
				return;
			}
		}
	};

	Matter.Events.on(engine, 'collisionStart', handler);
	return () => Matter.Events.off(engine, 'collisionStart', handler);
}
