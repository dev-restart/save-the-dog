import Matter from 'matter-js';

// GameEngine은 Matter.js 월드와 Canvas 렌더링을 소유하는 얇은 런타임 계층이다.
// Svelte 컴포넌트는 입력/수명주기만 연결하고, 실제 게임 규칙은 이 클래스 아래 모듈에서 처리한다.
import { PHYSICS } from '../constants.js';
import { clamp, scaleLengthX, scaleLengthY, scalePoint } from '../geometry.js';
import { BASE_WORLD, type CanvasSize, type GamePhase, type ObstacleData, type Point, type SkinId, type StageData } from '../types.js';
import { BeeSystem } from './BeeSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { setupCollisionEvents, type BombDetonation, type CrateDamage, type DogHit } from './CollisionHandler.js';
import { DrawingSystem, type NoDrawZone } from './DrawingSystem.js';
import { ObjectFactory } from './ObjectFactory.js';
import { FixedStepClock } from './GameLoopClock.js';
import { enforceDogDrawingContainment, isPointInsideClosedDrawing } from './BeeBarrierGuard.js';

import { calculateStageScore, type StageScore } from '../scoring.js';
import { getObstacleSpec } from '../obstacle-registry.js';
import { createStageReplay, type ReplayCommand, type StageReplay } from '../replay.js';
import { placeDogOnNearbySupport } from '../stages/dog-start-position.js';
import { compileTerrainPrefab } from '../terrain/terrain-compiler.js';
import { advanceBombFuses, consumeBombFuse, createBombFuseState, selectBombBlastTargets } from './SimulationRules.js';

export { advanceBombFuses } from './SimulationRules.js';

const CRATE_BREAKER_DURABILITY = 3;
const MAX_RENDER_DEVICE_PIXEL_RATIO = 2;

export function createDrawingBlockedZones(obstacles: ObstacleData[], size: CanvasSize): NoDrawZone[] {
	return obstacles
		.filter((obstacle) => getObstacleSpec(obstacle.type).blocksDrawing)
		.flatMap<NoDrawZone>((obstacle) => {
			const point = scalePoint({ x: obstacle.x, y: obstacle.y }, size);
			if (obstacle.prefabId) {
				const source = compileTerrainPrefab(obstacle.prefabId);
				const compiled = compileTerrainPrefab(obstacle.prefabId, {
					position: point,
					rotation: obstacle.angle ?? 0,
					scale: {
						x: scaleLengthX(obstacle.width, size) / source.bounds.width,
						y: scaleLengthY(obstacle.height, size) / source.bounds.height
					}
				});
				return compiled.noDraw.polygons.map((polygon) => ({
					x: (compiled.bounds.min.x + compiled.bounds.max.x) / 2,
					y: (compiled.bounds.min.y + compiled.bounds.max.y) / 2,
					width: compiled.bounds.width,
					height: compiled.bounds.height,
					vertices: polygon.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }))
				}));
			}
			return {
				x: point.x,
				y: point.y,
				width: scaleLengthX(obstacle.width, size) + PHYSICS.drawingThickness,
				height: scaleLengthY(obstacle.height, size) + PHYSICS.drawingThickness,
				angle: obstacle.angle
			};
		});
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
	private size: CanvasSize = { ...BASE_WORLD };
	private displaySize: CanvasSize = { ...BASE_WORLD };
	private cleanupCollision: (() => void) | null = null;
	private beesActive = false;
	private simulationSpeed: 1 | 2 | 3 = 1;
	private bombFuseElapsedMs = new Map<number, number>();
	private crateBreakerHits = new Map<number, number>();
	private replayCommands: ReplayCommand[] = [];
	private dogPositionBeforePhysics: Point | null = null;
	private dogContainedDrawingIds = new Set<number>();
	private isDestroyed = false;
	private isRenderPaused = false;

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
		this.attachLifecycleListeners();
	}

	start(): void {
		if (this.isDestroyed) return;
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onInkChange(1);
		this.callbacks.onTimerChange(0);
		this.loopClock.reset();
		this.resumeRendering();
	}

	destroy(): void {
		this.isDestroyed = true;
		this.detachLifecycleListeners();
		if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
		this.cleanupCollision?.();
		this.setBeesActive(false);
		this.beeSystem?.destroy();
		Matter.World.clear(this.world, false);
		Matter.Engine.clear(this.engine);
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		const ratio = this.getRenderPixelRatio();
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);

		this.canvas.width = Math.floor(width * ratio);
		this.canvas.height = Math.floor(height * ratio);
		this.displaySize = { width, height };
	}

	setSimulationSpeed(speed: 1 | 2 | 3): void {
		this.simulationSpeed = speed;
	}

	beginDrawing(point: Point): void {
		if (this.phase !== 'ready') return;
		if (!this.isInsidePlayableViewport(point)) return;
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
		this.crateBreakerHits.clear();

		const walls = ObjectFactory.createWalls(this.size);
		const dogStart = placeDogOnNearbySupport(this.stage).dog;
		this.dogBody = ObjectFactory.createDog(dogStart, this.size);
		const hives = this.stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, this.size));
		const obstacles = this.stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, this.size));
		this.bombFuseElapsedMs = createBombFuseState(obstacles);

		Matter.Composite.add(this.world, [...walls, ...obstacles, ...hives, this.dogBody]);
		this.beeSystem = new BeeSystem(this.stage.hives, this.world, this.size, this.stage.id, this.stage.difficulty, this.stage.seed ?? `stage-v1-${this.stage.id}`);
		this.cleanupCollision = setupCollisionEvents(
			this.engine,
			(hit) => this.fail(hit),
			(detonation) => this.handleBombDetonation(detonation),
			(damage) => this.handleCrateDamage(damage)
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
			physics: for (const fixedStepMs of tick.steps) {
				for (let repeat = 0; repeat < this.simulationSpeed; repeat += 1) {
					if (this.phase !== 'simulating') break physics;
					const stepMs = Math.min(fixedStepMs, this.stage.survivalMs - this.survivalElapsedMs);
					if (stepMs <= 0) break physics;
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
					this.survivalElapsedMs += stepMs;
				}
			}

			this.callbacks.onTimerChange(this.survivalElapsedMs);

			if (this.phase === 'simulating' && this.survivalElapsedMs >= this.stage.survivalMs) {
				this.clear();
			}
		}

		const viewport = this.getPlayableViewport();
		const ratio = this.getRenderPixelRatio();
		this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		this.ctx.clearRect(0, 0, this.displaySize.width, this.displaySize.height);
		this.ctx.setTransform(ratio * viewport.scale, 0, 0, ratio * viewport.scale, ratio * viewport.offsetX, ratio * viewport.offsetY);
		this.renderer.draw(this.ctx, this.world, this.phase, this.drawing.getPoints(), this.drawing.getInkRatio(), timestamp, this.size);
		this.animationFrame = requestAnimationFrame(this.renderLoop);
	};

	private attachLifecycleListeners(): void {
		if (typeof document === 'undefined' || typeof window === 'undefined') return;
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		window.addEventListener('pagehide', this.handlePageHide);
		window.addEventListener('pageshow', this.handlePageShow);
	}

	private detachLifecycleListeners(): void {
		if (typeof document === 'undefined' || typeof window === 'undefined') return;
		document.removeEventListener('visibilitychange', this.handleVisibilityChange);
		window.removeEventListener('pagehide', this.handlePageHide);
		window.removeEventListener('pageshow', this.handlePageShow);
	}

	private handleVisibilityChange = (): void => {
		if (document.hidden) {
			this.pauseRendering();
			return;
		}
		this.resumeRendering();
	};

	private handlePageHide = (): void => {
		this.pauseRendering();
	};

	private handlePageShow = (): void => {
		this.resumeRendering();
	};

	private pauseRendering(): void {
		if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
		this.animationFrame = 0;
		this.isRenderPaused = true;
	}

	private resumeRendering(): void {
		if (this.isDestroyed || this.animationFrame) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		this.isRenderPaused = false;
		this.loopClock.reset();
		this.animationFrame = requestAnimationFrame(this.renderLoop);
	}

	private getRenderPixelRatio(): number {
		if (typeof window === 'undefined') return 1;
		return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DEVICE_PIXEL_RATIO);
	}

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
		this.callbacks.onCleared(score, createStageReplay(this.stage, this.replayCommands, this.size));
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

	private handleCrateDamage({ reason, crateBody }: CrateDamage): void {
		if (this.phase !== 'simulating' || !Matter.Composite.get(this.world, crateBody.id, 'body')) return;
		if (reason === 'drawing-impact') {
			this.destroyCrate(crateBody);
			return;
		}

		const hits = (this.crateBreakerHits.get(crateBody.id) ?? 0) + 1;
		if (hits >= CRATE_BREAKER_DURABILITY) {
			this.destroyCrate(crateBody);
		} else {
			this.crateBreakerHits.set(crateBody.id, hits);
		}
	}

	private destroyCrate(crateBody: Matter.Body): void {
		this.crateBreakerHits.delete(crateBody.id);
		this.renderer.triggerExplosion(crateBody.position);
		Matter.Composite.remove(this.world, crateBody);
	}

	private detonateBomb(bombBody: Matter.Body): void {
		if (!consumeBombFuse(this.bombFuseElapsedMs, bombBody)) return;

		const dog = this.dogBody;
		const blast = selectBombBlastTargets(Matter.Composite.allBodies(this.world), bombBody, dog);
		this.renderer.triggerExplosion(bombBody.position);

		for (const body of blast.destroyedBodies) {
			if (body.label === 'crate') this.destroyCrate(body);
			else Matter.Composite.remove(this.world, body);
		}
		Matter.Composite.remove(this.world, bombBody);

		if (blast.hitsDog && dog) {
			this.fail({ reason: 'bomb', dogBody: dog, otherBody: bombBody });
		}
	}

	private clampPoint(point: Point): Point {
		const viewport = this.getPlayableViewport();
		return {
			x: clamp((point.x - viewport.offsetX) / viewport.scale, 0, this.size.width),
			y: clamp((point.y - viewport.offsetY) / viewport.scale, 0, this.size.height)
		};
	}

	private isInsidePlayableViewport(point: Point): boolean {
		const viewport = this.getPlayableViewport();
		return (
			point.x >= viewport.offsetX &&
			point.x <= viewport.offsetX + this.size.width * viewport.scale &&
			point.y >= viewport.offsetY &&
			point.y <= viewport.offsetY + this.size.height * viewport.scale
		);
	}

	private getPlayableViewport(): { scale: number; offsetX: number; offsetY: number } {
		const scale = Math.min(this.displaySize.width / this.size.width, this.displaySize.height / this.size.height);
		return {
			scale,
			offsetX: (this.displaySize.width - this.size.width * scale) / 2,
			offsetY: (this.displaySize.height - this.size.height * scale) / 2
		};
	}

	private setBeesActive(active: boolean): void {
		if (this.beesActive === active) return;
		this.beesActive = active;
		this.callbacks.onBeeActivityChange(active);
	}
}
