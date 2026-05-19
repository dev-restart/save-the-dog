import Matter from 'matter-js';
import type { BeeDifficultyProfile } from './BeeDifficulty.js';

export class BeeCombat {
	private drawingDurability = new Map<number, number>();

	constructor(
		private world: Matter.World,
		private profile: BeeDifficultyProfile
	) {}

	attackDrawings(bee: Matter.Body, dogBody: Matter.Body, drawings: Matter.Body[], deltaMs: number): boolean {
		if (
			(!this.profile.canPressureDrawing && !this.profile.canDamageDrawing && !this.profile.canDragDrawing) ||
			drawings.length === 0
		) {
			return false;
		}

		let attacked = false;
		const collisions = Matter.Query.collides(bee, drawings);
		for (const collision of collisions) {
			const drawing = collision.bodyA.label === 'drawing' ? collision.bodyA : collision.bodyB;
			if (drawing.label !== 'drawing') continue;

			attacked = true;
			if (this.profile.canDamageDrawing && !this.damageDrawing(drawing, deltaMs)) continue;
			if (this.profile.canPressureDrawing) this.pressureDrawing(drawing, bee, dogBody, deltaMs);
		}
		return attacked;
	}

	clear(): void {
		this.drawingDurability.clear();
	}

	private damageDrawing(drawing: Matter.Body, deltaMs: number): boolean {
		// 방어선 조각별 내구도를 따로 관리해 벌이 실제로 물고 늘어진 부분부터 무너지도록 한다.
		const current = this.drawingDurability.get(drawing.id) ?? this.profile.drawingDurability;
		const next = current - this.profile.drawingDamagePerMs * deltaMs;

		if (next <= 0) {
			Matter.Composite.remove(this.world, drawing);
			this.drawingDurability.delete(drawing.id);
			return false;
		}

		this.drawingDurability.set(drawing.id, next);
		return true;
	}

	private pressureDrawing(drawing: Matter.Body, bee: Matter.Body, dogBody: Matter.Body, deltaMs: number): void {
		const dx = dogBody.position.x - bee.position.x;
		const dy = dogBody.position.y - bee.position.y;
		const length = Math.hypot(dx, dy) || 1;
		const dragRatio = this.profile.canDragDrawing ? 1 : 0.42;
		const distancePerFrame = this.profile.drawingDragPerMs * dragRatio * deltaMs;
		const liftPerFrame = this.profile.drawingLiftPerMs * deltaMs;

		Matter.Body.translate(drawing, {
			x: (dx / length) * distancePerFrame,
			y: (dy / length) * distancePerFrame - liftPerFrame
		});

		if (this.profile.canRotateDrawing || this.profile.canDragDrawing) {
			const rotationDirection = bee.id % 2 === 0 ? 1 : -1;
			const rotationRatio = this.profile.canRotateDrawing ? 1 : 0.28;
			Matter.Body.rotate(drawing, rotationDirection * this.profile.drawingRotationPerMs * rotationRatio * deltaMs);
		}
	}
}
