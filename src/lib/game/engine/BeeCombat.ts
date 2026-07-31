import Matter from 'matter-js';
import type { BeeDifficultyProfile } from './BeeDifficulty.js';

export class BeeCombat {
	constructor(_world: Matter.World, _profile: BeeDifficultyProfile) {}

	attackDrawings(bee: Matter.Body, _dogBody: Matter.Body, drawings: Matter.Body[], _deltaMs: number): boolean {
		if (drawings.length === 0) return false;

		const collisions = Matter.Query.collides(bee, drawings);
		return collisions.some((collision) => {
			const drawing = collision.bodyA.label === 'drawing' ? collision.bodyA : collision.bodyB;
			return drawing.label === 'drawing';
		});
	}

	clear(): void {}
}
