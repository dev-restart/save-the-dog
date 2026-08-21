import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';

const BOMB_TRIGGER_LABELS = new Set([
	'dog',
	'drawing',
	'boulder',
	'rolling-boulder'
]);

const BOMB_BLAST_TARGET_LABELS = new Set(['drawing', 'crate']);

export interface BombCollision {
	bombBody: Matter.Body;
	triggerBody: Matter.Body;
}

export interface BombBlastSelection {
	hitsDog: boolean;
	destroyedBodies: Matter.Body[];
}

export function createBombFuseState(bodies: readonly Matter.Body[]): Map<number, number> {
	return new Map(bodies.filter((body) => body.label === 'bomb').map((body) => [body.id, 0]));
}

export function consumeBombFuse(fuses: Map<number, number>, bomb: Matter.Body): boolean {
	if (!fuses.has(bomb.id)) return false;
	fuses.delete(bomb.id);
	return true;
}

export function advanceBombFuses(
	world: Matter.World,
	fuses: Map<number, number>,
	stepMs: number,
	onFuseElapsed: (bomb: Matter.Body) => void
): void {
	for (const [bombId, elapsedMs] of fuses) {
		const bomb = Matter.Composite.allBodies(world).find((body) => body.id === bombId && body.label === 'bomb');
		if (!bomb) {
			fuses.delete(bombId);
			continue;
		}

		const nextElapsedMs = elapsedMs + stepMs;
		if (nextElapsedMs >= PHYSICS.bombFuseMs) {
			onFuseElapsed(bomb);
		} else {
			fuses.set(bombId, nextElapsedMs);
		}
	}
}

export function selectBombCollision(bodyA: Matter.Body, bodyB: Matter.Body): BombCollision | null {
	const bombBody = bodyA.label === 'bomb' ? bodyA : bodyB.label === 'bomb' ? bodyB : null;
	if (!bombBody) return null;

	const triggerBody = bombBody === bodyA ? bodyB : bodyA;
	if (!BOMB_TRIGGER_LABELS.has(triggerBody.label)) return null;
	return { bombBody, triggerBody };
}

export function selectBombBlastTargets(
	bodies: readonly Matter.Body[],
	bomb: Matter.Body,
	dog: Matter.Body | null,
	blastRadius = PHYSICS.bombBlastRadius
): BombBlastSelection {
	return {
		hitsDog: dog !== null && distanceBetween(dog, bomb) <= blastRadius,
		destroyedBodies: bodies.filter(
			(body) => BOMB_BLAST_TARGET_LABELS.has(body.label) && distanceBetween(body, bomb) <= blastRadius + bodyBlastRadius(body)
		)
	};
}

function distanceBetween(bodyA: Matter.Body, bodyB: Matter.Body): number {
	return Math.hypot(bodyA.position.x - bodyB.position.x, bodyA.position.y - bodyB.position.y);
}

function bodyBlastRadius(body: Matter.Body): number {
	if (body.circleRadius && body.circleRadius > 0) return body.circleRadius;
	return Math.hypot(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2;
}
