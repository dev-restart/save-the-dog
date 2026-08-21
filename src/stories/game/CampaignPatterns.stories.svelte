<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import StageThumbnail from '$lib/components/game/StageThumbnail.svelte';
	import { getStage } from '$lib/game/stages/index.js';

	const { Story } = defineMeta({ title: 'Game/Campaign Patterns', tags: ['autodocs'] });
	const stageIds = Array.from({ length: 10 }, (_, index) => index + 1);
	const showcaseStageIds = [1, 3, 5, 6, 8, 10];
	const noop = () => undefined;
</script>

<Story name="Pattern Progression">
	<div class="pattern-board">
		{#each stageIds as stageId}
			{@const stage = getStage(stageId)}
			<article>
				<strong>{stageId}단계 · {stage.objectiveLabel}</strong>
				<StageThumbnail {stage} skin="classic" />
				<small>{stage.dangerLabel}</small>
			</article>
		{/each}
	</div>
</Story>

<Story name="Playable Quiz Progression">
	<div class="playable-board">
		{#each showcaseStageIds as stageId}
			{@const stage = getStage(stageId)}
			<article class="playable-card">
				<header>
					<strong>{stageId}단계 · {stage.objectiveLabel}</strong>
					<small>{stage.objectiveHint}</small>
				</header>
				<div class="game-frame">
					<GameCanvas stage={stage} resetKey={0} skin="classic" simulationSpeed={1} onPhaseChange={noop} onInkChange={noop} onTimerChange={noop} onCleared={noop} onFailed={noop} onDogAttacked={noop} onDrawingAttacked={noop} onBeeActivityChange={noop} />
				</div>
			</article>
		{/each}
	</div>
</Story>

<style>
	.pattern-board { display: grid; grid-template-columns: repeat(3, minmax(0, 390px)); gap: 20px; padding: 24px; background: #eef6fb; color: #18324a; }
	article { display: grid; gap: 8px; align-content: start; }
	strong { font: 800 15px/1.3 Inter, sans-serif; }
	small { color: #66798a; font: 700 12px/1.3 Inter, sans-serif; }
	.playable-board { display: grid; grid-template-columns: repeat(3, 390px); gap: 24px; min-width: 1230px; padding: 24px; background: #172033; color: white; }
	.playable-card { overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; background: #0f172a; box-shadow: 0 18px 45px rgba(2, 6, 23, 0.28); }
	.playable-card header { display: grid; gap: 4px; min-height: 70px; padding: 14px 16px; }
	.playable-card small { color: #b9c7d5; }
	.game-frame { position: relative; width: 390px; height: 693px; overflow: hidden; background: #9bdcff; }
</style>
