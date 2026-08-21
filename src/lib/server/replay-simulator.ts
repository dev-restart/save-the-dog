import Matter from 'matter-js';
import { PHYSICS } from '$lib/game/constants.js';
import { DrawingSystem } from '$lib/game/engine/DrawingSystem.js';
import { createDrawingBlockedZones } from '$lib/game/engine/GameEngine.js';
import { BeeSystem } from '$lib/game/engine/BeeSystem.js';
import { ObjectFactory } from '$lib/game/engine/ObjectFactory.js';
import { enforceDogDrawingContainment, isPointInsideClosedDrawing } from '$lib/game/engine/BeeBarrierGuard.js';
import { calculateStageScore, type StageScore } from '$lib/game/scoring.js';
import { BASE_WORLD, type StageData } from '$lib/game/types.js';
import type { StageReplay } from '$lib/game/replay.js';
import { placeDogOnNearbySupport } from '$lib/game/stages/dog-start-position.js';
import {
	advanceBombFuses,
	consumeBombFuse,
	createBombFuseState,
	selectBombBlastTargets,
	selectBombCollision
} from '$lib/game/engine/SimulationRules.js';

const DOG_HIT_LABELS = new Set(['spike', 'water', 'lava', 'bomb', 'acid', 'boulder', 'rolling-boulder', 'deadzone']);

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
	drawing.setNoDrawZones(createDrawingBlockedZones(stage.obstacles, BASE_WORLD));
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
	// 실제 GameEngine과 동일한 지지면 보정을 적용해야 client에서 플레이한 위치를
	// 서버 replay에서도 같은 벌 접근 경로로 판정할 수 있다.
	const dog = ObjectFactory.createDog(placeDogOnNearbySupport(stage).dog, BASE_WORLD);
	const hives = stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, BASE_WORLD));
	const obstacles = stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, BASE_WORLD));
	Matter.Composite.add(world, [...walls, ...obstacles, ...hives, dog, ...segments]);

	const beeSystem = new BeeSystem(stage.hives, world, BASE_WORLD, stage.id, stage.difficulty, stage.seed ?? `stage-v1-${stage.id}`);
	beeSystem.start();
	const containedDrawingIds = new Set(
		segments.filter((drawingBody) => isPointInsideClosedDrawing(dog.position, drawingBody)).map((drawingBody) => drawingBody.id)
	);
	const bombFuses = createBombFuseState(obstacles);
	let failedReason: string | undefined;
	let pendingBeeHits: Array<{ bee: Matter.Body; dog: Matter.Body }> = [];
	const crateBeeHits = new Map<number, number>();
	const collisionHandler = (event: Matter.IEventCollision<Matter.Engine>) => {
		for (const pair of event.pairs) {
			const bombCollision = selectBombCollision(pair.bodyA, pair.bodyB);
			if (bombCollision) detonateBomb(bombCollision.bombBody);
			const crate = pair.bodyA.label === 'crate' ? pair.bodyA : pair.bodyB.label === 'crate' ? pair.bodyB : null;
			const crateTrigger = crate === pair.bodyA ? pair.bodyB : crate === pair.bodyB ? pair.bodyA : null;
			if (crate && crateTrigger?.label === 'drawing') Matter.Composite.remove(world, crate);
			if (crate && crateTrigger?.label === 'bee' && (crateTrigger.plugin as { attackStyle?: string }).attackStyle === 'breaker') {
				const hits = (crateBeeHits.get(crate.id) ?? 0) + 1;
				crateBeeHits.set(crate.id, hits);
				if (hits >= 3) Matter.Composite.remove(world, crate);
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
		const previousDogPosition = { x: dog.position.x, y: dog.position.y };
		const update = beeSystem.update(stepMs, dog);
		if (update.drawingAttacked) {
			// 방어선을 미는 동작은 실제 게임과 동일한 BeeSystem 상태만 재현한다.
		}
		Matter.Engine.update(engine, stepMs);
		beeSystem.enforceDrawingBarriers();
		enforceDogDrawingContainment(dog, segments, previousDogPosition, undefined, containedDrawingIds);
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
		if (!consumeBombFuse(bombFuses, bomb)) return;
		const blast = selectBombBlastTargets(Matter.Composite.allBodies(world), bomb, dog);
		if (blast.hitsDog) failedReason ??= 'bomb';
		for (const body of blast.destroyedBodies) Matter.Composite.remove(world, body);
		Matter.Composite.remove(world, bomb);
	}
}
