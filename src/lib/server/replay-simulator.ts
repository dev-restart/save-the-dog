import Matter from 'matter-js';
import { PHYSICS } from '$lib/game/constants.js';
import { DrawingSystem } from '$lib/game/engine/DrawingSystem.js';
import { BeeSystem } from '$lib/game/engine/BeeSystem.js';
import { ObjectFactory } from '$lib/game/engine/ObjectFactory.js';
import { calculateStageScore, type StageScore } from '$lib/game/scoring.js';
import { BASE_WORLD, type StageData } from '$lib/game/types.js';
import type { StageReplay } from '$lib/game/replay.js';

const DOG_HIT_LABELS = new Set(['spike', 'water', 'lava', 'bomb', 'acid', 'boulder', 'rolling-boulder', 'deadzone']);
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
const DRAW_BLOCKING_TYPES = new Set(['ground', 'platform', 'spike', 'wall', 'water', 'lava', 'brick', 'terrain-block', 'wood', 'crate', 'acid', 'ice', 'stone', 'no-draw-zone', 'no-draw-ground', 'no-draw-tree', 'no-draw-rock']);

export interface VerifiedReplayResult {
	status: 'cleared' | 'failed';
	reason?: string;
	clearTimeMs: number;
	inkRatio: number;
	score?: StageScore;
}

export function verifyStageReplay(stage: StageData, replay: StageReplay): VerifiedReplayResult {
	if (replay.stageId !== stage.id) throw new Error('replay 단계가 실제 단계와 다릅니다.');
	if (stage.seed && replay.seed !== stage.seed) throw new Error('replay seed가 실제 단계와 다릅니다.');

	const drawing = new DrawingSystem(stage.inkLimit);
	drawing.setNoDrawZones(stage.obstacles.filter((obstacle) => DRAW_BLOCKING_TYPES.has(obstacle.type)).map((obstacle) => ({
		x: obstacle.x,
		y: obstacle.y,
		width: obstacle.width + PHYSICS.drawingThickness,
		height: obstacle.height + PHYSICS.drawingThickness,
		angle: obstacle.angle
	})));
	let started = false;
	let ended = false;
	for (const command of replay.commands) {
		if (command.type === 'start') {
			if (started || ended || !drawing.start(command.point)) throw new Error('replay 시작 명령이 올바르지 않습니다.');
			started = true;
			continue;
		}
		if (!started || ended) throw new Error('replay 명령 순서가 올바르지 않습니다.');
		if (command.type === 'move') {
			const result = drawing.move(command.point);
			if (!result.accepted) throw new Error('replay 드로잉이 실제 규칙과 다릅니다.');
			if (result.exhausted && replay.commands.at(-1)?.type !== 'end') throw new Error('잉크 소진 뒤 replay가 종료되지 않았습니다.');
		} else {
			ended = true;
		}
	}
	if (!started || !ended) throw new Error('replay 드로잉이 종료되지 않았습니다.');

	const segments = ObjectFactory.createDrawingSegments(drawing.end());
	if (segments.length === 0) throw new Error('replay 방어선이 비어 있습니다.');

	const engine = Matter.Engine.create();
	engine.gravity.y = PHYSICS.gravityY;
	const world = engine.world;
	const walls = ObjectFactory.createWalls(BASE_WORLD);
	const dog = ObjectFactory.createDog(stage.dog, BASE_WORLD);
	const hives = stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, BASE_WORLD));
	const obstacles = stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, BASE_WORLD));
	Matter.Composite.add(world, [...walls, ...obstacles, ...hives, dog, ...segments]);

	const beeSystem = new BeeSystem(stage.hives, world, BASE_WORLD, stage.id, stage.difficulty, stage.seed ?? `stage-v1-${stage.id}`);
	beeSystem.start();
	const bombFuses = new Map(obstacles.filter((body) => body.label === 'bomb').map((body) => [body.id, 0]));
	let failedReason: string | undefined;
	let pendingBeeHits: Array<{ bee: Matter.Body; dog: Matter.Body }> = [];
	const collisionHandler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const bomb = pair.bodyA.label === 'bomb' ? pair.bodyA : pair.bodyB.label === 'bomb' ? pair.bodyB : null;
			const trigger = bomb === pair.bodyA ? pair.bodyB : bomb === pair.bodyB ? pair.bodyA : null;
			if (bomb && trigger && BOMB_TRIGGER_LABELS.has(trigger.label)) {
				detonateBomb(bomb);
			}

			const dogBody = pair.bodyA.label === 'dog' ? pair.bodyA : pair.bodyB.label === 'dog' ? pair.bodyB : null;
			if (!dogBody) continue;
			const other = pair.bodyA === dogBody ? pair.bodyB : pair.bodyA;
			if (other.label === 'bee') pendingBeeHits.push({ bee: other, dog: dogBody });
			else if (DOG_HIT_LABELS.has(other.label)) failedReason ??= other.label;
		}
	};
	Matter.Events.on(engine, 'collisionStart', collisionHandler);

	let elapsedMs = 0;
	while (elapsedMs < stage.survivalMs && !failedReason) {
		pendingBeeHits = [];
		const stepMs = Math.min(PHYSICS.fixedDeltaMs, stage.survivalMs - elapsedMs);
		const update = beeSystem.update(stepMs, dog);
		if (update.drawingAttacked) {
			// 방어선을 미는 동작은 실제 게임과 동일한 BeeSystem 상태만 재현한다.
		}
		Matter.Engine.update(engine, stepMs);
		beeSystem.enforceDrawingBarriers();
		for (const hit of pendingBeeHits) {
			if (!beeSystem.isDogProtectedFromBee(hit.bee, hit.dog)) failedReason ??= 'bee';
		}
		advanceBombFuses(world, bombFuses, stepMs, detonateBomb);
		elapsedMs += stepMs;
	}

	Matter.Events.off(engine, 'collisionStart', collisionHandler);
	beeSystem.destroy();
	const inkRatio = drawing.getInkRatio();
	Matter.World.clear(world, false);
	Matter.Engine.clear(engine);

	if (failedReason) return { status: 'failed', reason: failedReason, clearTimeMs: elapsedMs, inkRatio };
	return {
		status: 'cleared',
		clearTimeMs: elapsedMs,
		inkRatio,
		score: calculateStageScore({ inkRatio, elapsedMs: stage.survivalMs, survivalMs: stage.survivalMs })
	};

	function detonateBomb(bomb: Matter.Body): void {
		if (!bombFuses.has(bomb.id)) return;
		bombFuses.delete(bomb.id);
		if (Math.hypot(dog.position.x - bomb.position.x, dog.position.y - bomb.position.y) <= PHYSICS.bombBlastRadius) {
			failedReason ??= 'bomb';
		}
		for (const body of Matter.Composite.allBodies(world)) {
			if (body.label !== 'drawing') continue;
			const radius = Math.hypot(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2;
			if (Math.hypot(body.position.x - bomb.position.x, body.position.y - bomb.position.y) <= PHYSICS.bombBlastRadius + radius) {
				Matter.Composite.remove(world, body);
			}
		}
		Matter.Composite.remove(world, bomb);
	}
}

function advanceBombFuses(world: Matter.World, fuses: Map<number, number>, stepMs: number, onFuseElapsed: (bomb: Matter.Body) => void): void {
	for (const [bombId, elapsedMs] of fuses) {
		const bomb = Matter.Composite.allBodies(world).find((body) => body.id === bombId && body.label === 'bomb');
		if (!bomb) {
			fuses.delete(bombId);
			continue;
		}
		const next = elapsedMs + stepMs;
		if (next >= PHYSICS.bombFuseMs) onFuseElapsed(bomb);
		else fuses.set(bombId, next);
	}
}
