<script lang="ts">
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import GameShell from '$lib/components/game/GameShell.svelte';
	import MainMenu from '$lib/components/game/MainMenu.svelte';
	import ResultOverlay from '$lib/components/game/ResultOverlay.svelte';
	import { GameAudioManager } from '$lib/game/audio.js';
	import { GameSessionState } from '$lib/game/state/game-session.svelte.js';
	import { triggerHaptic } from '$lib/game/haptics.js';
	import type { StageScore } from '$lib/game/scoring.js';
	import { getStage } from '$lib/game/stages/index.js';
	import type { GamePhase, SkinId } from '$lib/game/types.js';

	const session = new GameSessionState();
	const audioManager = new GameAudioManager();

	let resetKey = $state(0);
	let stage = $derived(getStage(session.currentStage));

	onMount(() => {
		session.load();
		audioManager.setPreferences(session.getAudioPreferences());
		audioManager.setSkin(session.skin);
		audioManager.attemptAutoplay();

		const unlockAudio = () => audioManager.unlock();
		document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
		document.addEventListener('keydown', unlockAudio, { once: true, capture: true });
		document.addEventListener('touchstart', unlockAudio, { once: true, capture: true });

		return () => {
			document.removeEventListener('pointerdown', unlockAudio, { capture: true });
			document.removeEventListener('keydown', unlockAudio, { capture: true });
			document.removeEventListener('touchstart', unlockAudio, { capture: true });
			audioManager.destroy();
		};
	});

	$effect(() => {
		session.setSurvivalDuration(stage.survivalMs);
	});

	$effect(() => {
		audioManager.setSkin(session.skin);
		audioManager.setPreferences(session.getAudioPreferences());
		audioManager.syncPhase(session.phase);
	});

	function startNewGame(): void {
		audioManager.unlock();
		session.start(1);
		resetKey += 1;
	}

	function continueGame(): void {
		audioManager.unlock();
		session.start(session.highestStage);
		resetKey += 1;
	}

	function selectStage(stageId: number): void {
		audioManager.unlock();
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

	function handleDrawingAttacked(): void {
		audioManager.playBarrierTap();
	}

	function handleBeeActivityChange(active: boolean): void {
		audioManager.setBeeBuzzing(active);
	}

	function handleSkinChange(skin: SkinId): void {
		audioManager.unlock();
		session.setSkin(skin);
	}

	function handleHapticsChange(enabled: boolean): void {
		session.setHapticsEnabled(enabled);
	}

	function handleMusicChange(enabled: boolean): void {
		audioManager.unlock();
		session.setMusicEnabled(enabled);
	}

	function handleSfxChange(enabled: boolean): void {
		audioManager.unlock();
		session.setSfxEnabled(enabled);
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
			musicEnabled={session.musicEnabled}
			sfxEnabled={session.sfxEnabled}
			onStart={startNewGame}
			onContinue={continueGame}
			onStageSelect={selectStage}
			onSkinChange={handleSkinChange}
			onHapticsChange={handleHapticsChange}
			onMusicChange={handleMusicChange}
			onSfxChange={handleSfxChange}
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
				onDrawingAttacked={handleDrawingAttacked}
				onBeeActivityChange={handleBeeActivityChange}
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
