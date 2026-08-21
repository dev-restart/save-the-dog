<script lang="ts">
	import { onMount } from 'svelte';
	import Matter from 'matter-js';
	import { placeDogOnNearbySupport } from '$lib/game/stages/dog-start-position.js';
	import { CanvasRenderer } from '$lib/game/engine/CanvasRenderer.js';
	import { ObjectFactory } from '$lib/game/engine/ObjectFactory.js';
	import type { CanvasSize, SkinId, StageData } from '$lib/game/types.js';

	interface Props {
		stage: StageData;
		skin: SkinId;
	}

	const WORLD_SIZE: CanvasSize = { width: 390, height: 693 };
	const THUMBNAIL_SIZE = { width: 390, height: 285 } as const;

	let { stage, skin }: Props = $props();
	let canvasElement: HTMLCanvasElement | undefined;
	let renderer: CanvasRenderer | null = null;
	let renderFrame = 0;
	let renderSequence = 0;
	let isReady = $state(false);

	function cancelRenderLoop(): void {
		if (renderFrame) cancelAnimationFrame(renderFrame);
		renderFrame = 0;
	}

	function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
		const context = canvas.getContext('2d');
		if (!context) return null;
		const ratio = globalThis.devicePixelRatio || 1;
		const width = canvas.clientWidth || THUMBNAIL_SIZE.width;
		const height = canvas.clientHeight || THUMBNAIL_SIZE.height;
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		return context;
	}

	function drawThumbnail(): void {
		if (!canvasElement || !renderer) return;
		const context = resizeCanvas(canvasElement);
		if (!context) return;

		const offscreen = document.createElement('canvas');
		offscreen.width = WORLD_SIZE.width;
		offscreen.height = WORLD_SIZE.height;
		const offscreenContext = offscreen.getContext('2d');
		if (!offscreenContext) return;

		const engine = Matter.Engine.create();
		engine.gravity.y = 0;
		const dog = ObjectFactory.createDog(placeDogOnNearbySupport(stage).dog, WORLD_SIZE);
		const hives = stage.hives.map((hive) => ObjectFactory.createHive({ x: hive.x, y: hive.y }, WORLD_SIZE));
		const obstacles = stage.obstacles.map((obstacle) => ObjectFactory.createObstacle(obstacle, WORLD_SIZE));

		Matter.Composite.add(engine.world, [...obstacles, ...hives, dog]);
		renderer.draw(offscreenContext, engine.world, 'ready', [], 1, globalThis.performance?.now?.() ?? Date.now());
		Matter.World.clear(engine.world, false);
		Matter.Engine.clear(engine);

		context.clearRect(0, 0, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height);
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(offscreen, 0, 0, WORLD_SIZE.width, WORLD_SIZE.height, 0, 0, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height);
		isReady = true;
	}

	function scheduleRenderLoop(): void {
		if (!canvasElement) return;
		cancelRenderLoop();
		isReady = false;
		const sequence = ++renderSequence;
		let attempts = 0;

		const tick = () => {
			if (sequence !== renderSequence) return;
			drawThumbnail();
			if (attempts < 24) {
				attempts += 1;
				renderFrame = requestAnimationFrame(tick);
			}
		};

		tick();
	}

	onMount(() => {
		renderer = new CanvasRenderer(skin, stage.environment);
		scheduleRenderLoop();
		return () => cancelRenderLoop();
	});

	$effect(() => {
		renderer = new CanvasRenderer(skin, stage.environment);
		stage;
		skin;
		if (canvasElement) scheduleRenderLoop();
	});
</script>

<div class={`stage-thumbnail ${isReady ? 'is-ready' : 'is-loading'}`} aria-hidden="true">
	<canvas bind:this={canvasElement} width={THUMBNAIL_SIZE.width} height={THUMBNAIL_SIZE.height}></canvas>
</div>

<style>
	.stage-thumbnail {
		position: relative;
		aspect-ratio: 390 / 285;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.85);
		border-radius: 13px;
		background: linear-gradient(180deg, #aee3ff 0%, #eaf8ff 68%, #f7fcff 100%);
		box-shadow: inset 0 0 0 1px rgba(20, 62, 78, 0.08);
	}

	.stage-thumbnail.is-loading::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.28) 50%, rgba(255, 255, 255, 0) 100%),
			linear-gradient(180deg, #aee3ff 0%, #eaf8ff 68%, #f7fcff 100%);
		animation: thumbnail-shimmer 1.2s linear infinite;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	@keyframes thumbnail-shimmer {
		from { transform: translateX(-100%); }
		to { transform: translateX(100%); }
	}
</style>
