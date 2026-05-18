<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InkMeter from '$lib/components/game/InkMeter.svelte';

	const { Story } = defineMeta({
		title: 'Game/InkMeter',
		component: InkMeter,
		tags: ['autodocs']
	});
</script>

<Story name="Full" args={{ value: 1 }} />
<Story name="Warning" args={{ value: 0.18 }} />
<Story name="Empty" args={{ value: 0 }} />
