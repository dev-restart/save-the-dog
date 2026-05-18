<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="game-page">
	<main class="game-shell" aria-label="Save The Dog game">
		{@render children()}
	</main>
</div>
