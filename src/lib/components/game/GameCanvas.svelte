<script lang="ts">
	import { GameEngine } from '$lib/game/engine/GameEngine.js';
	import type { StageScore } from '$lib/game/scoring.js';
	import type { GamePhase, Point, SkinId, StageData } from '$lib/game/types.js';

	interface Props {
		stage: StageData;
		resetKey: number;
		skin: SkinId;
		onPhaseChange: (phase: GamePhase) => void;
		onInkChange: (inkRatio: number) => void;
		onTimerChange: (elapsedMs: number) => void;
		onCleared: (score: StageScore) => void;
		onFailed: () => void;
	}

	let {
		stage,
		resetKey,
		skin,
		onPhaseChange,
		onInkChange,
		onTimerChange,
		onCleared,
		onFailed
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let engine: GameEngine | null = null;
	let activePointerId: number | null = null;

	function pointFromEvent(event: PointerEvent): Point {
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function handlePointerDown(event: PointerEvent): void {
		if (!canvas || !engine) return;
		event.preventDefault();
		activePointerId = event.pointerId;
		canvas.setPointerCapture(event.pointerId);
		engine.beginDrawing(pointFromEvent(event));
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!engine || activePointerId !== event.pointerId) return;
		event.preventDefault();
		engine.moveDrawing(pointFromEvent(event));
	}

	function handlePointerEnd(event: PointerEvent): void {
		if (!canvas || !engine || activePointerId !== event.pointerId) return;
		event.preventDefault();
		activePointerId = null;
		if (canvas.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
		engine.endDrawing();
	}

	$effect(() => {
		if (!canvas) return;

		const instance = new GameEngine(canvas, stage, skin, {
			onPhaseChange,
			onInkChange,
			onTimerChange,
			onCleared,
			onFailed
		});
		engine = instance;
		instance.start();

		const observer = new ResizeObserver(() => instance.resize());
		observer.observe(canvas);

		resetKey;
		skin;

		return () => {
			observer.disconnect();
			instance.destroy();
			if (engine === instance) engine = null;
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="absolute inset-0 size-full touch-none"
	aria-label={`Save The Dog Stage ${stage.id}`}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerEnd}
	onpointercancel={handlePointerEnd}
></canvas>
