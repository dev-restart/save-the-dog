<script lang="ts">
	import { FastForward, HelpCircle, Home, RotateCcw, ShieldAlert } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { GamePhase } from '$lib/game/types.js';
	import InkMeter from './InkMeter.svelte';
	import StageBadge from './StageBadge.svelte';

	interface Props {
		stage: number | string;
		difficulty?: string;
		objectiveLabel?: string;
		objectiveHint?: string;
		dangerLabel?: string;
		phase: GamePhase;
		simulationSpeed: 1 | 2 | 3;
		inkRatio: number;
		remainingSeconds: number;
		hintViewsRemaining?: number;
		showHint?: boolean;
		onHint?: () => void;
		onToggleSpeed: () => void;
		onRetry: () => void;
		onMenu: () => void;
	}

	let {
		stage,
		difficulty = 'Ready',
		objectiveLabel = '강아지 보호',
		objectiveHint = '벌과 위험 지형을 동시에 막으세요.',
		dangerLabel = '벌 공격',
		phase,
		simulationSpeed,
		inkRatio,
		remainingSeconds,
		hintViewsRemaining = 3,
		showHint = false,
		onHint = () => {},
		onToggleSpeed,
		onRetry,
		onMenu
	}: Props = $props();

	let showTimer = $derived(phase === 'simulating');
	let canShowHint = $derived(!showTimer && !showHint && hintViewsRemaining > 0);
	let canToggleSpeed = $derived(phase === 'simulating');
	let timerTone = $derived(remainingSeconds <= 3 ? 'text-rose-600' : 'text-slate-900');
</script>

<header class="pointer-events-auto absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
	<div class="flex h-14 items-center gap-2 rounded-md border border-white/70 bg-white/78 px-2 shadow-lg shadow-slate-900/10 backdrop-blur">
		<StageBadge {stage} {difficulty} />
		<InkMeter value={inkRatio} />
		<div class="flex shrink-0 items-center gap-1">
			<Button
				variant={simulationSpeed > 1 ? 'default' : 'ghost'}
				size="icon-sm"
				class="relative"
				aria-label={simulationSpeed === 1 ? '2배속으로 진행' : simulationSpeed === 2 ? '3배속으로 진행' : '일반 속도로 진행'}
				title={simulationSpeed === 1 ? '2배속' : simulationSpeed === 2 ? '3배속' : '배속 해제'}
				disabled={!canToggleSpeed}
				onclick={onToggleSpeed}
			>
				<FastForward class="size-4" />
				<span class="absolute -right-1 -top-1 rounded bg-amber-400 px-1 text-[8px] font-black leading-3 text-slate-950" aria-hidden="true">{simulationSpeed}×</span>
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="relative"
				aria-label={`힌트 보기, ${hintViewsRemaining}회 남음`}
				disabled={!canShowHint}
				onclick={onHint}
			>
				<HelpCircle class="size-4" />
				<span
					class="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-amber-400 text-[9px] font-black leading-none text-slate-950"
					aria-hidden="true"
				>
					{hintViewsRemaining}
				</span>
			</Button>
			<Button variant="ghost" size="icon-sm" aria-label="처음 화면" onclick={onMenu}>
				<Home class="size-4" />
			</Button>
			<Button variant="ghost" size="icon-sm" aria-label="다시 시작" onclick={onRetry}>
				<RotateCcw class="size-4" />
			</Button>
		</div>
	</div>

	{#if showTimer}
		<div data-testid="survival-timer" class={`mx-auto mt-2 w-fit rounded-md bg-white/80 px-3 py-1 text-lg font-black shadow ${timerTone}`}>
			{remainingSeconds.toFixed(1)}s
		</div>
	{:else if phase === 'ready' || phase === 'drawing'}
		<div class="mx-auto mt-2 w-fit rounded-md border border-white/70 bg-white/84 px-3 py-1 text-[11px] font-black text-slate-700 shadow">
			{phase === 'drawing' ? '선을 그리고 있어요. 손을 떼면 시작합니다.' : '선을 그린 뒤 손을 떼면 10초가 시작됩니다.'}
		</div>
	{/if}
</header>

{#if showHint && !showTimer}
	<div class="pointer-events-none absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 rounded-md border border-white/70 bg-white/84 px-3 py-2 text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur">
		<div class="flex items-center gap-1 text-xs font-black">
			<ShieldAlert class="size-4 text-sky-600" />
			<span>{objectiveLabel}</span>
			<span class="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">{dangerLabel}</span>
		</div>
		<p class="mt-1 text-[11px] font-semibold leading-snug text-slate-600">{objectiveHint}</p>
	</div>
{/if}
