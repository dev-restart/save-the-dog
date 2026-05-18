import Matter from 'matter-js';

export function setupCollisionEvents(engine: Matter.Engine, onDogDead: () => void): () => void {
	const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const labels = [pair.bodyA.label, pair.bodyB.label];
			const dogHit =
				labels.includes('dog') &&
				(labels.includes('bee') || labels.includes('spike') || labels.includes('deadzone'));

			if (dogHit) {
				onDogDead();
				return;
			}
		}
	};

	Matter.Events.on(engine, 'collisionStart', handler);
	return () => Matter.Events.off(engine, 'collisionStart', handler);
}
