<script lang="ts">
	import { Progress } from '$lib/components/ui/progress/index.js';

	interface Props {
		value: number;
		label?: string;
	}

	let { value, label = '남은 잉크' }: Props = $props();

	let percent = $derived(Math.max(0, Math.min(100, Math.round(value * 100))));
	let toneClass = $derived(
		percent <= 20
			? '[&_[data-slot=progress-indicator]]:bg-rose-500'
			: '[&_[data-slot=progress-indicator]]:bg-sky-500'
	);
</script>

<div class="min-w-0 flex-1" aria-label={`${label} ${percent}%`}>
	<div class="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
		<span>{label}</span>
		<span>{percent}%</span>
	</div>
	<Progress value={percent} class={`h-2.5 bg-white/70 shadow-inner ${toneClass}`} />
</div>
