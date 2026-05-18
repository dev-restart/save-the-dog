<script lang="ts">
	import { formatStarScore } from '$lib/game/scoring.js';

	interface Props {
		stars: number;
		label?: string;
		size?: 'sm' | 'md' | 'lg';
	}

	let { stars, label = '별점', size = 'md' }: Props = $props();
	let clampedStars = $derived(Math.min(3, Math.max(0, stars)));
	let sizeClass = $derived(size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl');
	let ariaLabel = $derived(`${label} ${formatStarScore(clampedStars)} / 3.0`);

	function fillPercent(index: number): number {
		const fill = clampedStars - index;
		if (fill >= 1) return 100;
		if (fill >= 0.5) return 50;
		return 0;
	}
</script>

<div class="inline-flex items-center gap-1" aria-label={ariaLabel} title={ariaLabel}>
	{#each [0, 1, 2] as index}
		<span class={`relative inline-block leading-none ${sizeClass}`} aria-hidden="true">
			<span class="text-slate-300">★</span>
			<span class="absolute inset-0 overflow-hidden text-amber-400" style={`width: ${fillPercent(index)}%`}>★</span>
		</span>
	{/each}
</div>
