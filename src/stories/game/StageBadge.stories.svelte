<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StageBadge from '$lib/components/game/StageBadge.svelte';

	const { Story } = defineMeta({
		title: 'Game/StageBadge',
		component: StageBadge,
		tags: ['autodocs']
	});
</script>

<Story name="Normal" args={{ stage: 3, difficulty: 'Easy' }} />
<Story name="High Difficulty" args={{ stage: 24, difficulty: 'Loop 4' }} />
