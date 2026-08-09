import Matter from 'matter-js';

// GameEngine은 Matter.js 월드와 Canvas 렌더링을 소유하는 얇은 런타임 계층이다.
// Svelte 컴포넌트는 입력/수명주기만 연결하고, 실제 게임 규칙은 이 클래스 아래 모듈에서 처리한다.
import { PHYSICS } from '../constants.js';
import { clamp, scaleLengthX, scaleLengthY, scalePoint } from '../geometry.js';
import type { CanvasSize, GamePhase, ObstacleData, ObstacleType, Point, SkinId, StageData } from '../types.js';
import { BeeSystem } from './BeeSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { setupCollisionEvents, type BombDetonation, type DogHit } from './CollisionHandler.js';
import { DrawingSystem } from './DrawingSystem.js';
import { ObjectFactory } from './ObjectFactory.js';
import { FixedStepClock } from './GameLoopClock.js';
import { enforceDogDrawingContainment, isPointInsideClosedDrawing } from './BeeBarrierGuard.js';

import { calculateStageScore, type StageScore } from '../scoring.js';
import { createStageReplay, type ReplayCommand, type StageReplay } from '../replay.js';

// 선은 고정 지형과 웅덩이 내부를 침범할 수 없다. 폭탄·굴림돌처럼 시뮬레이션 뒤에
// 움직여야 하는 오브젝트는 제외해, 그려진 선과 충돌하거나 폭발을 유발할 수 있게 둔다.
const DRAW_BLOCKING_OBSTACLE_TYPES = new Set<ObstacleType>([
	'ground',
	'platform',
	'spike',
	'wall',
	'water',
	'lava',
	'brick',
	'terrain-block',
	'wood',
	'crate',
	'acid',
	'ice',
	'stone',
	'no-draw-zone',
	'no-draw-ground',
	'no-draw-tree',
	'no-draw-rock'
]);

export function createDrawingBlockedZones(obstacles: ObstacleData[], size: CanvasSize) {
	return obstacles
		.filter((obstacle) => DRAW_BLOCKING_OBSTACLE_TYPES.has(obstacle.type))
		.map((obstacle) => {
			const point = scalePoint({ x: obstacle.x, y: obstacle.y }, size);
			return {
				x: point.x,
				y: point.y,
				width: scaleLengthX(obstacle.width, size) + PHYSICS.drawingThickness,
				height: scaleLengthY(obstacle.height, size) + PHYSICS.drawingThickness,
				angle: obstacle.angle
			};
		});
}

export function advanceBombFuses(
	world: Matter.World,
	bombFuseElapsedMs: Map<number, number>,
	stepMs: number,
	onFuseElapsed: (bomb: Matter.Body) => void
): void {
	for (const [bombId, elapsedMs] of bombFuseElapsedMs) {
		const bomb = Matter.Composite.allBodies(world).find((body) => body.id === bombId && body.label === 'bomb');
		if (!bomb) {
			bombFuseElapsedMs.delete(bombId);
			continue;
		}

		const nextElapsedMs = elapsedMs + stepMs;
		if (nextElapsedMs >= PHYSICS.bombFuseMs) {
			onFuseElapsed(bomb);
		} else {
			bombFuseElapsedMs.set(bombId, nextElapsedMs);
		}
	}
}

interface GameEngineCallbacks {
	onPhaseChange: (phase: GamePhase) => void;
	onInkChange: (inkRatio: number) => void;
	onTimerChange: (elapsedMs: number) => void;
	onCleared: (score: StageScore, replay: StageReplay) => void;
	onFailed: (reason?: string) => void;
	onDogAttacked: () => void;
	onDrawingAttacked: () => void;
	onBeeActivityChange: (active: boolean) => void;
}

export class GameEngine {
	private engine = Matter.Engine.create();
	private world = this.engine.world;
	private ctx: CanvasRenderingContext2D;
	private renderer: CanvasRenderer;
	private drawing: DrawingSystem;
	private loopClock = new FixedStepClock({
		fixedDeltaMs: PHYSICS.fixedDeltaMs,
		maxFrameDeltaMs: 80,
		maxStepsPerFrame: 5
	});
	private beeSystem: BeeSystem | null = null;
	private dogBody: Matter.Body | null = null;
	private phase: GamePhase = 'ready';
	private animationFrame = 0;
	private survivalElapsedMs = 0;
	private size: CanvasSize = { width: 390, height: 693 };
	private cleanupCollision: (() => void) | null = null;
	private beesActive = false;
	private simulationSpeed: 1 | 2 | 3 = 1;
	private bombFuseElapsedMs = new Map<number, number>();
	private replayCommands: ReplayCommand[] = [];
	private dogPositionBeforePhysics: Point | null = null;
	private dogContainedDrawingIds = new Set<number>();

	constructor(
		private canvas: HTMLCanvasElement,
		private stage: StageData,
		skin: SkinId,
		private callbacks: GameEngineCallbacks
	) {
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Canvas 2D context를 생성하지 못했습니다.');
		}

		this.ctx = context;
		this.renderer = new CanvasRenderer(skin, stage.environment);
		this.drawing = new DrawingSystem(stage.inkLimit);
		// 드로잉이 완료될 때까지는 어떤 물리 body도 움직이면 안 된다.
		this.engine.gravity.y = 0;
		this.resize();
		this.setupWorld();
	}

	start(): void {
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onInkChange(1);
		this.callbacks.onTimerChange(0);
		this.loopClock.reset();
		this.animationFrame = requestAnimationFrame(this.renderLoop);
	}

	destroy(): void {
		if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
		this.cleanupCollision?.();
		this.setBeesActive(false);
		this.beeSystem?.destroy();
		Matter.World.clear(this.world, false);
		Matter.Engine.clear(this.engine);
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);

		this.canvas.width = Math.floor(width * ratio);
		this.canvas.height = Math.floor(height * ratio);
		this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		this.size = { width, height };
	}

	setSimulationSpeed(speed: 1 | 2 | 3): void {
		this.simulationSpeed = speed;
	}

	beginDrawing(point: Point): void {
		if (this.phase !== 'ready') return;
		const clampedPoint = this.clampPoint(point);
		if (!this.drawing.start(clampedPoint)) return;
		this.replayCommands = [{ type: 'start', point: clampedPoint }];
		this.phase = 'drawing';
		this.callbacks.onPhaseChange(this.phase);
	}

	moveDrawing(point: Point): void {
		if (this.phase !== 'drawing') return;
		const clampedPoint = this.clampPoint(point);
		const result = this.drawing.move(clampedPoint);
		if (result.accepted) {
			this.replayCommands.push({ type: 'move', point: clampedPoint });
			this.callbacks.onInkChange(this.drawing.getInkRatio());
		}
		if (result.exhausted) this.endDrawing();
	}

	endDrawing(): void {
		if (this.phase !== 'drawing') return;
		const points = this.drawing.end();
		this.replayCommands.push({ type: 'end' });
		const segments = ObjectFactory.createDrawingSegments(points);

		if (segments.length === 0) {
			this.phase = 'ready';
			this.drawing.reset();
			this.replayCommands = [];
			this.callbacks.onInkChange(1);
			this.callbacks.onPhaseChange(this.phase);
			return;
		}

		Matter.Composite.add(this.world, segments);
		if (this.dogBody) {
			this.dogContainedDrawingIds = new Set(
				segments.filter((drawing) => isPointInsideClosedDrawing(this.dogBody!.position, drawing)).map((drawing) => drawing.id)
			);
		}
		this.drawing.clearPreview();

		this.engine.gravity.y = PHYSICS.gravityY;
		this.beeSystem?.start();
		this.phase = 'simulating';
		this.callbacks.onPhaseChange(this.phase);
	}

	private setupWorld(): void {
		Matter.Composite.clear(this.world, false, true);
		this.engine.gravity.y = 0;
		this.survivalElapsedMs = 0;
		this.dogContainedDrawingIds.clear();

		const walls = ObjectFactory.createWalls(this.size);
		this.dogBody = ObjectFactory.createDog(this.stage.dog, this.size);
		const hives = this.stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, this.size));
		const obstacles = this.stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, this.size));
		this.bombFuseElapsedMs = new Map(
			obstacles.filter((body) => body.label === 'bomb').map((body) => [body.id, 0])
		);

		Matter.Composite.add(this.world, [...walls, ...obstacles, ...hives, this.dogBody]);
		this.beeSystem = new BeeSystem(this.stage.hives, this.world, this.size, this.stage.id, this.stage.difficulty, this.stage.seed ?? `stage-v1-${this.stage.id}`);
		this.cleanupCollision = setupCollisionEvents(
			this.engine,
			(hit) => this.fail(hit),
			(detonation) => this.handleBombDetonation(detonation)
		);

		// 모든 고정 지형과 웅덩이를 드로잉 금지 영역으로 전달한다. 선 두께만큼
		// 확장해 테두리에 걸친 선도 지형을 침범하지 않게 한다.
		const noDrawZones = createDrawingBlockedZones(this.stage.obstacles, this.size);
		this.drawing.setNoDrawZones(noDrawZones);
	}

	private renderLoop = (timestamp: number): void => {
		const tick = this.loopClock.tick(timestamp);

		// Matter.js는 유효한 드로잉이 끝난 뒤에만 전진한다. ready/drawing 단계에서
		// 물리를 돌리면 레벨 24의 굴림돌처럼 입력 전부터 지형이 변한다.
		if (this.phase === 'simulating' && this.dogBody) {
			const scaledSteps = tick.steps.map((stepMs) => stepMs * this.simulationSpeed);
			for (const stepMs of scaledSteps) {
				const previousDogPosition = { x: this.dogBody.position.x, y: this.dogBody.position.y };
				this.dogPositionBeforePhysics = previousDogPosition;
				const beeUpdate = this.beeSystem?.update(stepMs, this.dogBody);
				if (beeUpdate?.drawingAttacked) this.callbacks.onDrawingAttacked();
				if (beeUpdate) this.setBeesActive(beeUpdate.hasActiveBees);
				Matter.Engine.update(this.engine, stepMs);
				advanceBombFuses(this.world, this.bombFuseElapsedMs, stepMs, (bomb) => this.detonateBomb(bomb));
				this.beeSystem?.enforceDrawingBarriers();
				if (this.phase === 'simulating') {
					enforceDogDrawingContainment(
						this.dogBody,
						this.getDrawingBodies(),
						previousDogPosition,
						undefined,
						this.dogContainedDrawingIds
					);
				}
			}

			this.survivalElapsedMs += tick.simulationDeltaMs * this.simulationSpeed;
			this.callbacks.onTimerChange(this.survivalElapsedMs);

			if (this.survivalElapsedMs >= this.stage.survivalMs) {
				this.clear();
			}
		}

		this.renderer.draw(this.ctx, this.world, this.phase, this.drawing.getPoints(), this.drawing.getInkRatio(), timestamp);
		this.animationFrame = requestAnimationFrame(this.renderLoop);
	};

	private clear(): void {
		if (this.phase !== 'simulating') return;
		this.phase = 'cleared';
		this.engine.gravity.y = 0;
		this.setBeesActive(false);
		this.beeSystem?.destroy();
		const score = calculateStageScore({
			inkRatio: this.drawing.getInkRatio(),
			elapsedMs: this.survivalElapsedMs,
			survivalMs: this.stage.survivalMs
		});
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onCleared(score, createStageReplay(this.stage, this.replayCommands));
	}

	private fail(hit: DogHit): void {
		if (this.phase !== 'simulating') return;
		if (hit.reason === 'bee' && hit.otherBody.label === 'bee') {
			if (this.dogPositionBeforePhysics) {
				enforceDogDrawingContainment(
					hit.dogBody,
					this.getDrawingBodies(),
					this.dogPositionBeforePhysics,
					undefined,
					this.dogContainedDrawingIds
				);
			}
			// 충돌 콜백은 barrier guard보다 먼저 발생할 수 있다. 먼저 tunnelled bee를 되돌린 뒤
			// 방어선이 실제로 강아지와 벌 사이에 있는지 판단해야 닫힌 선이 임의로 실패하지 않는다.
			this.beeSystem?.enforceDrawingBarriers();
		}
		if (
			hit.reason === 'bee' &&
			hit.otherBody.label === 'bee' &&
			this.beeSystem?.isDogProtectedFromBee(hit.otherBody, hit.dogBody)
		) {
			this.beeSystem.enforceDrawingBarriers();
			return;
		}

		this.phase = 'failed';
		this.engine.gravity.y = 0;
		this.setBeesActive(false);
		if (hit.reason === 'bee') this.callbacks.onDogAttacked();
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onFailed(hit.reason);
	}

	private getDrawingBodies(): Matter.Body[] {
		return Matter.Composite.allBodies(this.world).filter((body) => body.label === 'drawing');
	}

	private handleBombDetonation({ bombBody }: BombDetonation): void {
		if (this.phase !== 'simulating') return;
		this.detonateBomb(bombBody);
	}

	private detonateBomb(bombBody: Matter.Body): void {
		if (!this.bombFuseElapsedMs.has(bombBody.id)) return;
		this.bombFuseElapsedMs.delete(bombBody.id);

		const dog = this.dogBody;
		const blastRadius = PHYSICS.bombBlastRadius;
		const distanceToDog = dog ? Math.hypot(dog.position.x - bombBody.position.x, dog.position.y - bombBody.position.y) : Infinity;
		this.renderer.triggerExplosion(bombBody.position);

		for (const drawing of Matter.Composite.allBodies(this.world)) {
			if (drawing.label !== 'drawing') continue;
			const bodyRadius = drawing.circleRadius ?? Math.hypot(drawing.bounds.max.x - drawing.bounds.min.x, drawing.bounds.max.y - drawing.bounds.min.y) / 2;
			if (Math.hypot(drawing.position.x - bombBody.position.x, drawing.position.y - bombBody.position.y) <= blastRadius + bodyRadius) {
				Matter.Composite.remove(this.world, drawing);
			}
		}
		Matter.Composite.remove(this.world, bombBody);

		if (distanceToDog <= blastRadius && dog) {
			this.fail({ reason: 'bomb', dogBody: dog, otherBody: bombBody });
		}
	}

	private clampPoint(point: Point): Point {
		return {
			x: clamp(point.x, 0, this.size.width),
			y: clamp(point.y, 0, this.size.height)
		};
	}

	private setBeesActive(active: boolean): void {
		if (this.beesActive === active) return;
		this.beesActive = active;
		this.callbacks.onBeeActivityChange(active);
	}
}
