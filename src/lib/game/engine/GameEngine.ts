import Matter from 'matter-js';

// GameEngine은 Matter.js 월드와 Canvas 렌더링을 소유하는 얇은 런타임 계층이다.
// Svelte 컴포넌트는 입력/수명주기만 연결하고, 실제 게임 규칙은 이 클래스 아래 모듈에서 처리한다.
import { PHYSICS } from '../constants.js';
import { clamp } from '../geometry.js';
import type { CanvasSize, GamePhase, Point, SkinId, StageData } from '../types.js';
import { BeeSystem } from './BeeSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { setupCollisionEvents, type DogHitReason } from './CollisionHandler.js';
import { DrawingSystem } from './DrawingSystem.js';
import { ObjectFactory } from './ObjectFactory.js';
import { FixedStepClock } from './GameLoopClock.js';

import { calculateStageScore, type StageScore } from '../scoring.js';

interface GameEngineCallbacks {
	onPhaseChange: (phase: GamePhase) => void;
	onInkChange: (inkRatio: number) => void;
	onTimerChange: (elapsedMs: number) => void;
	onCleared: (score: StageScore) => void;
	onFailed: () => void;
	onDogAttacked: () => void;
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
		this.renderer = new CanvasRenderer(skin);
		this.drawing = new DrawingSystem(stage.inkLimit);
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

	beginDrawing(point: Point): void {
		if (this.phase !== 'ready') return;
		this.phase = 'drawing';
		this.drawing.start(this.clampPoint(point));
		this.callbacks.onPhaseChange(this.phase);
	}

	moveDrawing(point: Point): void {
		if (this.phase !== 'drawing') return;
		const result = this.drawing.move(this.clampPoint(point));
		if (result.accepted) this.callbacks.onInkChange(this.drawing.getInkRatio());
		if (result.exhausted) this.endDrawing();
	}

	endDrawing(): void {
		if (this.phase !== 'drawing') return;
		const points = this.drawing.end();
		const segments = ObjectFactory.createDrawingSegments(points);

		if (segments.length === 0) {
			this.phase = 'ready';
			this.drawing.reset();
			this.callbacks.onInkChange(1);
			this.callbacks.onPhaseChange(this.phase);
			return;
		}

		Matter.Composite.add(this.world, segments);
		this.drawing.clearPreview();

		this.phase = 'simulating';
		this.engine.gravity.y = PHYSICS.gravityY;
		this.beeSystem?.start();
		this.callbacks.onPhaseChange(this.phase);
	}

	private setupWorld(): void {
		Matter.Composite.clear(this.world, false, true);
		this.engine.gravity.y = 0;
		this.survivalElapsedMs = 0;

		const walls = ObjectFactory.createWalls(this.size);
		this.dogBody = ObjectFactory.createDog(this.stage.dog, this.size);
		const hives = this.stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, this.size));
		const obstacles = this.stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, this.size));

		Matter.Composite.add(this.world, [...walls, ...obstacles, ...hives, this.dogBody]);
		this.beeSystem = new BeeSystem(this.stage.hives, this.world, this.size, this.stage.id);
		this.cleanupCollision = setupCollisionEvents(this.engine, (reason) => this.fail(reason));
	}

	private renderLoop = (timestamp: number): void => {
		const tick = this.loopClock.tick(timestamp);

		// Matter.js는 고정 delta로 여러 번 전진시키고, UI 타이머는 실제 처리된 물리 시간만 반영한다.
		if (this.phase === 'simulating' && this.dogBody) {
			for (const stepMs of tick.steps) {
				this.beeSystem?.update(stepMs, this.dogBody);
				Matter.Engine.update(this.engine, stepMs);
				this.beeSystem?.enforceDrawingBarriers();
			}

			this.survivalElapsedMs += tick.simulationDeltaMs;
			this.callbacks.onTimerChange(this.survivalElapsedMs);

			if (this.survivalElapsedMs >= this.stage.survivalMs) {
				this.clear();
			}
		} else {
			for (const stepMs of tick.steps) {
				Matter.Engine.update(this.engine, stepMs);
			}
		}

		this.renderer.draw(this.ctx, this.world, this.phase, this.drawing.getPoints(), this.drawing.getInkRatio());
		this.animationFrame = requestAnimationFrame(this.renderLoop);
	};

	private clear(): void {
		if (this.phase !== 'simulating') return;
		this.phase = 'cleared';
		this.engine.gravity.y = 0;
		this.beeSystem?.destroy();
		const score = calculateStageScore({
			inkRatio: this.drawing.getInkRatio(),
			elapsedMs: this.survivalElapsedMs,
			survivalMs: this.stage.survivalMs
		});
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onCleared(score);
	}

	private fail(reason: DogHitReason): void {
		if (this.phase !== 'simulating') return;
		this.phase = 'failed';
		this.engine.gravity.y = 0;
		if (reason === 'bee') this.callbacks.onDogAttacked();
		this.callbacks.onPhaseChange(this.phase);
		this.callbacks.onFailed();
	}

	private clampPoint(point: Point): Point {
		return {
			x: clamp(point.x, 0, this.size.width),
			y: clamp(point.y, 0, this.size.height)
		};
	}
}
