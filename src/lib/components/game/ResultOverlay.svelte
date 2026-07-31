<script lang="ts">
	import { ArrowRight, Home, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import StarRating from './StarRating.svelte';
	import type { StageScore } from '$lib/game/scoring.js';
	import type { GamePhase } from '$lib/game/types.js';

	interface Props {
		phase: GamePhase;
		stage: number;
		score: StageScore | null;
		onNext: () => void;
		nextLabel?: string;
		onRetry: () => void;
		onMenu: () => void;
	}

	let { phase, stage, score, onNext, nextLabel = '다음 Stage', onRetry, onMenu }: Props = $props();
	let visible = $derived(phase === 'cleared' || phase === 'failed');
	let cleared = $derived(phase === 'cleared');
</script>

{#if visible}
	<section class="absolute inset-0 z-30 flex items-center justify-center p-5" aria-live="assertive">
		<div class="grid justify-items-center gap-5 text-center drop-shadow-[0_8px_18px_rgba(0,0,0,0.32)]">
			{#if cleared}
				{#if score}
					<StarRating stars={score.stars} label={`Stage ${stage} 별점`} size="lg" />
				{/if}
				<h2 class="text-5xl font-black text-white">성공</h2>
				<div class="flex items-center justify-center gap-3">
					<Button class="size-14 rounded-full p-0" aria-label={nextLabel} title={nextLabel} onclick={onNext}>
						<ArrowRight class="size-7" />
					</Button>
					<Button variant="secondary" class="size-14 rounded-full bg-white/90 p-0" aria-label="처음 화면" title="처음 화면" onclick={onMenu}>
						<Home class="size-7" />
					</Button>
				</div>
			{:else}
				<h2 class="text-5xl font-black text-white">실패</h2>
				<div class="flex items-center justify-center gap-3">
					<Button class="size-14 rounded-full p-0" aria-label="다시 시도" title="다시 시도" onclick={onRetry}>
						<RotateCcw class="size-7" />
					</Button>
					<Button variant="secondary" class="size-14 rounded-full bg-white/90 p-0" aria-label="처음 화면" title="처음 화면" onclick={onMenu}>
						<Home class="size-7" />
					</Button>
				</div>
			{/if}
		</div>
	</section>
{/if}
