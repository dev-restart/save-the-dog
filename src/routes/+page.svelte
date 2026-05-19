<script lang="ts">
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import GameShell from '$lib/components/game/GameShell.svelte';
	import MainMenu from '$lib/components/game/MainMenu.svelte';
	import ResultOverlay from '$lib/components/game/ResultOverlay.svelte';
	import { GameSessionState } from '$lib/game/state/game-session.svelte.js';
	import { triggerHaptic } from '$lib/game/haptics.js';
	import type { StageScore } from '$lib/game/scoring.js';
	import { getStage } from '$lib/game/stages/index.js';
	import type { GamePhase, SkinId } from '$lib/game/types.js';

	const session = new GameSessionState();

	let resetKey = $state(0);
	let stage = $derived(getStage(session.currentStage));

	onMount(() => {
		session.load();
	});

	$effect(() => {
		session.setSurvivalDuration(stage.survivalMs);
	});

	function startNewGame(): void {
		session.start(1);
		resetKey += 1;
	}

	function continueGame(): void {
		session.start(session.highestStage);
		resetKey += 1;
	}

	function selectStage(stageId: number): void {
		session.start(stageId);
		resetKey += 1;
	}

	function retryStage(): void {
		session.retry();
		resetKey += 1;
	}

	function nextStage(): void {
		session.nextStage();
		resetKey += 1;
	}

	function returnToMenu(): void {
		session.returnToMenu();
		resetKey += 1;
	}

	function handlePhaseChange(phase: GamePhase): void {
		session.setPhase(phase);
	}

	function handleClear(score: StageScore): void {
		session.markCleared(score);
	}

	function handleFail(): void {
		session.markFailed();
	}

	function handleDogAttacked(): void {
		triggerHaptic('attack', session.hapticsEnabled);
	}

	function handleSkinChange(skin: SkinId): void {
		session.setSkin(skin);
	}

	function handleHapticsChange(enabled: boolean): void {
		session.setHapticsEnabled(enabled);
	}
</script>

<svelte:head>
	<title>Save The Dog</title>
	<meta
		name="description"
		content="Draw a line, block the bees, and keep the dog safe in a SvelteKit physics game."
	/>
</svelte:head>

<GameShell>
	{#if !session.hasStarted}
		<MainMenu
			highestStage={session.highestStage}
			totalClears={session.totalClears}
			totalStars={session.totalStars}
			stageStars={session.stageStars}
			canContinue={session.canContinue}
			skin={session.skin}
			hapticsEnabled={session.hapticsEnabled}
			onStart={startNewGame}
			onContinue={continueGame}
			onStageSelect={selectStage}
			onSkinChange={handleSkinChange}
			onHapticsChange={handleHapticsChange}
		/>
	{:else}
		<div class="relative size-full overflow-hidden">
			<GameCanvas
				{stage}
				{resetKey}
				skin={session.skin}
				onPhaseChange={handlePhaseChange}
				onInkChange={(value) => session.setInkRatio(value)}
				onTimerChange={(value) => session.setSurvivalElapsed(value)}
				onCleared={handleClear}
				onFailed={handleFail}
				onDogAttacked={handleDogAttacked}
			/>
			<GameHud
				stage={stage.id}
				difficulty={stage.difficultyLabel}
				phase={session.phase}
				inkRatio={session.inkRatio}
				remainingSeconds={session.remainingSeconds}
				onRetry={retryStage}
				onMenu={returnToMenu}
			/>
			<ResultOverlay
				phase={session.phase}
				stage={stage.id}
				score={session.currentScore}
				onNext={nextStage}
				onRetry={retryStage}
				onMenu={returnToMenu}
			/>
		</div>
	{/if}
</GameShell>
