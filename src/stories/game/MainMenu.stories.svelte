<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import MainMenu from '$lib/components/game/MainMenu.svelte';

	const { Story } = defineMeta({
		title: 'Game/MainMenu',
		component: MainMenu,
		tags: ['autodocs'],
		args: {
			onStart: fn(),
			onContinue: fn(),
			onStageSelect: fn(),
			onSkinChange: fn()
		}
	});
</script>

<Story
	name="New Player"
	args={{ highestStage: 1, totalClears: 0, totalStars: 0, stageStars: {}, canContinue: false, skin: 'classic' }}
/>
<Story
	name="Returning Player"
	args={{
		highestStage: 12,
		totalClears: 24,
		totalStars: 31.5,
		stageStars: { '1': 3, '2': 2.5, '3': 2, '4': 2.5, '5': 3, '6': 2, '7': 1.5, '8': 2, '9': 2.5, '10': 3, '11': 2 },
		canContinue: true,
		skin: 'lego'
	}}
/>
