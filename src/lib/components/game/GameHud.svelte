<script lang="ts">
	import { Home, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { GamePhase } from '$lib/game/types.js';
	import InkMeter from './InkMeter.svelte';
	import StageBadge from './StageBadge.svelte';

	interface Props {
		stage: number;
		difficulty?: string;
		phase: GamePhase;
		inkRatio: number;
		remainingSeconds: number;
		onRetry: () => void;
		onMenu: () => void;
	}

	let {
		stage,
		difficulty = 'Ready',
		phase,
		inkRatio,
		remainingSeconds,
		onRetry,
		onMenu
	}: Props = $props();

	let showTimer = $derived(phase === 'simulating');
	let timerTone = $derived(remainingSeconds <= 3 ? 'text-rose-600' : 'text-slate-900');
</script>

<header class="pointer-events-auto absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
	<div class="flex h-14 items-center gap-2 rounded-md border border-white/70 bg-white/78 px-2 shadow-lg shadow-slate-900/10 backdrop-blur">
		<StageBadge {stage} {difficulty} />
		<InkMeter value={inkRatio} />
		<div class="flex shrink-0 items-center gap-1">
			<Button variant="ghost" size="icon-sm" aria-label="처음 화면" onclick={onMenu}>
				<Home class="size-4" />
			</Button>
			<Button variant="ghost" size="icon-sm" aria-label="다시 시작" onclick={onRetry}>
				<RotateCcw class="size-4" />
			</Button>
		</div>
	</div>

	{#if showTimer}
		<div class={`mx-auto mt-2 w-fit rounded-md bg-white/80 px-3 py-1 text-lg font-black shadow ${timerTone}`}>
			{remainingSeconds.toFixed(1)}s
		</div>
	{/if}
</header>
