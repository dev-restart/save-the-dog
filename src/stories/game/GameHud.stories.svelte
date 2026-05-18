<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import GameHud from '$lib/components/game/GameHud.svelte';

	const { Story } = defineMeta({
		title: 'Game/GameHud',
		component: GameHud,
		tags: ['autodocs'],
		args: {
			stage: 7,
			difficulty: 'Two Hives',
			onRetry: fn(),
			onMenu: fn()
		}
	});
</script>

<Story name="Ready" args={{ phase: 'ready', inkRatio: 1, remainingSeconds: 5 }} />
<Story name="Drawing" args={{ phase: 'drawing', inkRatio: 0.45, remainingSeconds: 5 }} />
<Story name="Simulating" args={{ phase: 'simulating', inkRatio: 0.18, remainingSeconds: 2.7 }} />
