import Matter from 'matter-js';
import type { BeeDifficultyProfile } from './BeeDifficulty.js';

export class BeeCombat {
	private drawingDurability = new Map<number, number>();

	constructor(
		private world: Matter.World,
		private profile: BeeDifficultyProfile
	) {}

	attackDrawings(bee: Matter.Body, dogBody: Matter.Body, drawings: Matter.Body[], deltaMs: number): void {
		if (!this.profile.canDamageDrawing || drawings.length === 0) return;

		const collisions = Matter.Query.collides(bee, drawings);
		for (const collision of collisions) {
			const drawing = collision.bodyA.label === 'drawing' ? collision.bodyA : collision.bodyB;
			if (drawing.label !== 'drawing') continue;

			this.damageDrawing(drawing, deltaMs);
			if (this.profile.canDragDrawing) {
				this.dragDrawingTowardDog(drawing, bee, dogBody, deltaMs);
			}
		}
	}

	clear(): void {
		this.drawingDurability.clear();
	}

	private damageDrawing(drawing: Matter.Body, deltaMs: number): void {
		// 방어선 조각별 내구도를 따로 관리해 벌이 실제로 물고 늘어진 부분부터 무너지도록 한다.
		const current = this.drawingDurability.get(drawing.id) ?? this.profile.drawingDurability;
		const next = current - this.profile.drawingDamagePerMs * deltaMs;

		if (next <= 0) {
			Matter.Composite.remove(this.world, drawing);
			this.drawingDurability.delete(drawing.id);
			return;
		}

		this.drawingDurability.set(drawing.id, next);
	}

	private dragDrawingTowardDog(drawing: Matter.Body, bee: Matter.Body, dogBody: Matter.Body, deltaMs: number): void {
		const dx = dogBody.position.x - bee.position.x;
		const dy = dogBody.position.y - bee.position.y;
		const length = Math.hypot(dx, dy) || 1;
		const distancePerFrame = this.profile.drawingDragPerMs * deltaMs;

		Matter.Body.translate(drawing, {
			x: (dx / length) * distancePerFrame,
			y: (dy / length) * distancePerFrame
		});

		if (this.profile.canRotateDrawing) {
			const rotationDirection = bee.id % 2 === 0 ? 1 : -1;
			Matter.Body.rotate(drawing, rotationDirection * this.profile.drawingRotationPerMs * deltaMs);
		}
	}
}
