import { afterEach, describe, expect, it, vi } from 'vitest';
import Matter from 'matter-js';

import { getStage } from '../stages/index.js';
import { PHYSICS } from '../constants.js';
import type { ObstacleData, StageData } from '../types.js';
import type { CrateDamage } from './CollisionHandler.js';
import { ObjectFactory } from './ObjectFactory.js';
import { advanceBombFuses, createDrawingBlockedZones, GameEngine } from './GameEngine.js';
import { DrawingSystem } from './DrawingSystem.js';

interface GameEngineInternals {
	world: Matter.World;
	phase: 'simulating';
	size: { width: number; height: number };
	displaySize: { width: number; height: number };
	clampPoint: (point: { x: number; y: number }) => { x: number; y: number };
	isInsidePlayableViewport: (point: { x: number; y: number }) => boolean;
	renderer: { triggerExplosion: (point: { x: number; y: number }) => void };
	handleCrateDamage: (damage: CrateDamage) => void;
	detonateBomb: (bomb: Matter.Body) => void;
	renderLoop: (timestamp: number) => void;
}

function createTestEngine(obstacles: ObstacleData[]): { game: GameEngine; internals: GameEngineInternals } {
	vi.stubGlobal('window', { devicePixelRatio: 1 });
	const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => context,
		getBoundingClientRect: () => ({ width: 390, height: 693 })
	} as unknown as HTMLCanvasElement;
	const stage: StageData = {
		id: 1,
		dog: { x: 195, y: 520 },
		hives: [],
		obstacles,
		inkLimit: 600,
		survivalMs: 10_000
	};
	const game = new GameEngine(canvas, stage, 'classic', {
		onPhaseChange: vi.fn(),
		onInkChange: vi.fn(),
		onTimerChange: vi.fn(),
		onCleared: vi.fn(),
		onFailed: vi.fn(),
		onDogAttacked: vi.fn(),
		onDrawingAttacked: vi.fn(),
		onBeeActivityChange: vi.fn()
	});
	const internals = game as unknown as GameEngineInternals;
	internals.phase = 'simulating';
	return { game, internals };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GameEngine drawing-blocked terrain', () => {
	it('세로로 긴 모바일 Canvas에서도 물리는 BASE_WORLD이고 입력만 중앙 viewport로 환산한다', () => {
		vi.stubGlobal('window', { devicePixelRatio: 2 });
		const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => context,
			getBoundingClientRect: () => ({ width: 390, height: 844 })
		} as unknown as HTMLCanvasElement;
		const game = new GameEngine(canvas, {
			id: 10,
			dog: { x: 195, y: 552 },
			hives: [],
			obstacles: [],
			inkLimit: 315,
			survivalMs: 7000
		}, 'classic', {
			onPhaseChange: vi.fn(), onInkChange: vi.fn(), onTimerChange: vi.fn(), onCleared: vi.fn(),
			onFailed: vi.fn(), onDogAttacked: vi.fn(), onDrawingAttacked: vi.fn(), onBeeActivityChange: vi.fn()
		});
		const internals = game as unknown as GameEngineInternals;

		expect(internals.size).toEqual({ width: 390, height: 693 });
		expect(internals.displaySize).toEqual({ width: 390, height: 844 });
		expect(internals.isInsidePlayableViewport({ x: 195, y: 50 })).toBe(false);
		expect(internals.clampPoint({ x: 195, y: (844 - 693) / 2 + 346.5 })).toEqual({ x: 195, y: 346.5 });
		game.destroy();
	});

	it('고해상도 모바일에서도 DPR cap으로 backing buffer 크기를 제한한다', () => {
		vi.stubGlobal('window', { devicePixelRatio: 3 });
		const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => context,
			getBoundingClientRect: () => ({ width: 390, height: 844 })
		} as unknown as HTMLCanvasElement;

		const game = new GameEngine(canvas, {
			id: 10,
			dog: { x: 195, y: 552 },
			hives: [],
			obstacles: [],
			inkLimit: 315,
			survivalMs: 7000
		}, 'classic', {
			onPhaseChange: vi.fn(), onInkChange: vi.fn(), onTimerChange: vi.fn(), onCleared: vi.fn(),
			onFailed: vi.fn(), onDogAttacked: vi.fn(), onDrawingAttacked: vi.fn(), onBeeActivityChange: vi.fn()
		});

		expect(canvas.width).toBe(780);
		expect(canvas.height).toBe(1688);
		game.destroy();
	});

	it('Compound Prefab의 보이는 빈 공간에서는 그릴 수 있고 벽을 통과하는 선만 막는다', () => {
		const cases = [
			{
				obstacle: { type: 'terrain-block', prefabId: 'u-shelter', x: 195, y: 500, width: 250, height: 190 } as const,
				openLine: [{ x: 150, y: 420 }, { x: 240, y: 420 }],
				wallLine: [{ x: 45, y: 500 }, { x: 150, y: 500 }]
			},
			{
				obstacle: { type: 'terrain-block', prefabId: 'cliff-pocket-left', x: 148, y: 390, width: 290, height: 400 } as const,
				openLine: [{ x: 125, y: 390 }, { x: 245, y: 390 }],
				wallLine: [{ x: 300, y: 410 }, { x: 0, y: 410 }]
			},
			{
				obstacle: { type: 'stone', prefabId: 'arch-shelter', x: 195, y: 438, width: 310, height: 290 } as const,
				openLine: [{ x: 150, y: 430 }, { x: 240, y: 430 }],
				wallLine: [{ x: 0, y: 440 }, { x: 110, y: 440 }]
			}
		];

		for (const { obstacle, openLine, wallLine } of cases) {
			const drawing = new DrawingSystem(400);
			drawing.setNoDrawZones(createDrawingBlockedZones([obstacle], { width: 390, height: 693 }));
			expect(drawing.start(openLine[0]), `${obstacle.prefabId} open start`).toBe(true);
			expect(drawing.move(openLine[1]).accepted, obstacle.prefabId).toBe(true);
			drawing.reset();
			expect(drawing.start(wallLine[0]), `${obstacle.prefabId} wall start`).toBe(true);
			expect(drawing.move(wallLine[1]).accepted, obstacle.prefabId).toBe(false);
		}
	});

	it('레벨 24의 고정 지형과 웅덩이는 드로잉 금지 영역으로 만들고 굴림돌은 제외한다', () => {
		const stage = getStage(24);
		const zones = createDrawingBlockedZones(stage.obstacles, { width: 390, height: 693 });

		for (const expected of [
			{ x: 108, y: 512 },
			{ x: 222, y: 590 },
			{ x: 150, y: 370, angle: -0.24 },
			{ x: 88, y: 632 },
			{ x: 302, y: 632 }
		]) {
			expect(
				zones.some(
					(zone) =>
						Math.abs(zone.x - expected.x) < 0.001 &&
						Math.abs(zone.y - expected.y) < 0.001 &&
						(expected.angle === undefined || zone.angle === expected.angle)
				)
			).toBe(true);
		}
		expect(zones.some((zone) => Math.abs(zone.x - 186) < 0.001 && Math.abs(zone.y - 304) < 0.001)).toBe(false);
	});

	it('드로잉 금지 영역은 캔버스 크기에 맞춰 좌표와 충돌 여백을 함께 확장한다', () => {
		const zones = createDrawingBlockedZones(
			[{ type: 'terrain-block', x: 100, y: 200, width: 40, height: 40 }],
			{ width: 195, height: 346.5 }
		);

		expect(zones[0]?.x).toBeCloseTo(50);
		expect(zones[0]?.y).toBeCloseTo(100);
		expect(zones[0]?.width).toBeCloseTo(30);
		expect(zones[0]?.height).toBeCloseTo(30);
	});

	it('폭탄 퓨즈는 드로잉 완료 뒤 시뮬레이션이 전달한 시간만 누적해 기폭한다', () => {
		const engine = Matter.Engine.create();
		const bomb = ObjectFactory.createObstacle(
			{ type: 'bomb', x: 195, y: 180, width: 40, height: 40 },
			{ width: 390, height: 693 }
		);
		const fuses = new Map([[bomb.id, 0]]);
		const detonated: number[] = [];
		Matter.Composite.add(engine.world, bomb);

		advanceBombFuses(engine.world, fuses, PHYSICS.bombFuseMs - 1, (body) => {
			detonated.push(body.id);
			fuses.delete(body.id);
		});
		expect(detonated).toEqual([]);

		advanceBombFuses(engine.world, fuses, 1, (body) => {
			detonated.push(body.id);
			fuses.delete(body.id);
		});
		expect(detonated).toEqual([bomb.id]);
	});

	it('background tab에서는 render loop를 멈추고 복귀 시 다시 시작한다', () => {
		const documentListeners = new Map<string, EventListener>();
		const windowListeners = new Map<string, EventListener>();
		let hidden = false;
		vi.stubGlobal('document', {
			get hidden() {
				return hidden;
			},
			addEventListener: vi.fn((type: string, listener: EventListener) => documentListeners.set(type, listener)),
			removeEventListener: vi.fn((type: string) => documentListeners.delete(type))
		});
		vi.stubGlobal('window', {
			devicePixelRatio: 1,
			addEventListener: vi.fn((type: string, listener: EventListener) => windowListeners.set(type, listener)),
			removeEventListener: vi.fn((type: string) => windowListeners.delete(type))
		});
		const requestAnimationFrame = vi.fn(() => 1);
		const cancelAnimationFrame = vi.fn();
		vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
		vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
		const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => context,
			getBoundingClientRect: () => ({ width: 390, height: 693 })
		} as unknown as HTMLCanvasElement;

		const game = new GameEngine(canvas, {
			id: 1,
			dog: { x: 195, y: 520 },
			hives: [],
			obstacles: [],
			inkLimit: 600,
			survivalMs: 10_000
		}, 'classic', {
			onPhaseChange: vi.fn(), onInkChange: vi.fn(), onTimerChange: vi.fn(), onCleared: vi.fn(),
			onFailed: vi.fn(), onDogAttacked: vi.fn(), onDrawingAttacked: vi.fn(), onBeeActivityChange: vi.fn()
		});

		game.start();
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

		hidden = true;
		documentListeners.get('visibilitychange')?.(new Event('visibilitychange'));
		expect(cancelAnimationFrame).toHaveBeenCalledWith(1);

		hidden = false;
		documentListeners.get('visibilitychange')?.(new Event('visibilitychange'));
		expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

		windowListeners.get('pagehide')?.(new Event('pagehide'));
		expect(cancelAnimationFrame).toHaveBeenLastCalledWith(1);

		windowListeners.get('pageshow')?.(new Event('pageshow'));
		expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
		game.destroy();
	});
});

describe('GameEngine crate destruction', () => {
	it('breaker bee 충돌을 3회 누적하면 crate를 제거하고 파괴 효과를 낸다', () => {
		const { game, internals } = createTestEngine([
			{ type: 'crate', x: 195, y: 300, width: 52, height: 52 }
		]);
		const crate = Matter.Composite.allBodies(internals.world).find((body) => body.label === 'crate');
		expect(crate).toBeDefined();
		const breaker = ObjectFactory.createBee({ x: 195, y: 300 }, { width: 390, height: 693 }, 'breaker');
		const triggerEffect = vi.spyOn(internals.renderer, 'triggerExplosion');
		const damage = { reason: 'breaker-bee-impact', crateBody: crate!, sourceBody: breaker } satisfies CrateDamage;

		internals.handleCrateDamage(damage);
		internals.handleCrateDamage(damage);
		expect(Matter.Composite.allBodies(internals.world)).toContain(crate);

		internals.handleCrateDamage(damage);
		expect(Matter.Composite.allBodies(internals.world)).not.toContain(crate);
		expect(triggerEffect).toHaveBeenCalledOnce();
		game.destroy();
	});

	it('drawing 충격은 crate를 즉시 제거한다', () => {
		const { game, internals } = createTestEngine([
			{ type: 'crate', x: 195, y: 300, width: 52, height: 52 }
		]);
		const crate = Matter.Composite.allBodies(internals.world).find((body) => body.label === 'crate');
		const [drawing] = ObjectFactory.createDrawingSegments([
			{ x: 160, y: 300 },
			{ x: 230, y: 300 }
		]);
		expect(crate).toBeDefined();

		internals.handleCrateDamage({ reason: 'drawing-impact', crateBody: crate!, sourceBody: drawing });

		expect(Matter.Composite.allBodies(internals.world)).not.toContain(crate);
		game.destroy();
	});

	it('bomb blast 반경 안의 crate를 제거한다', () => {
		const { game, internals } = createTestEngine([
			{ type: 'bomb', x: 195, y: 300, width: 40, height: 40 },
			// 중심은 blastRadius 밖이지만 crate 가장자리는 폭발 반경 안에 있다.
			{ type: 'crate', x: 290, y: 300, width: 52, height: 52 }
		]);
		const bodies = Matter.Composite.allBodies(internals.world);
		const bomb = bodies.find((body) => body.label === 'bomb');
		const crate = bodies.find((body) => body.label === 'crate');
		expect(bomb).toBeDefined();
		expect(crate).toBeDefined();

		internals.detonateBomb(bomb!);

		const remainingBodies = Matter.Composite.allBodies(internals.world);
		expect(remainingBodies).not.toContain(bomb);
		expect(remainingBodies).not.toContain(crate);
		game.destroy();
	});
});
