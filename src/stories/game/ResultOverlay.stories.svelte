<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import ResultOverlay from '$lib/components/game/ResultOverlay.svelte';

	const { Story } = defineMeta({
		title: 'Game/ResultOverlay',
		component: ResultOverlay,
		tags: ['autodocs'],
		args: {
			stage: 5,
			score: { stars: 2, inkStars: 2, timeStars: 0, inkRatio: 0.55, timeRatio: 1 },
			onNext: fn(),
			onRetry: fn(),
			onMenu: fn()
		}
	});
</script>

<Story name="Cleared" args={{ phase: 'cleared' }} />
<Story name="Failed" args={{ phase: 'failed', score: null }} />
