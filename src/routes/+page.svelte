<script lang="ts">
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import GameShell from '$lib/components/game/GameShell.svelte';
	import MainMenu from '$lib/components/game/MainMenu.svelte';
	import CustomMapLibrary from '$lib/components/game/CustomMapLibrary.svelte';
	import MapEditor from '$lib/components/game/MapEditor.svelte';
	import ResultOverlay from '$lib/components/game/ResultOverlay.svelte';
	import { GameAudioManager } from '$lib/game/audio.js';
	import { GameSessionState } from '$lib/game/state/game-session.svelte.js';
	import { triggerHaptic } from '$lib/game/haptics.js';
	import type { StageScore } from '$lib/game/scoring.js';
	import { getStage } from '$lib/game/stages/index.js';
	import {
		cloneStageMapDocument,
		createEmptyStageMapDocument,
		createStageDataFromMapDocument,
		decodeSharedStageMap,
		type StageMapDocument
	} from '$lib/game/stages/stage-map-schema.js';
	import type { CustomMapRecord } from '$lib/game/state/game-persistence.js';
	import type { GamePhase, SkinId, StageData } from '$lib/game/types.js';

	const session = new GameSessionState();
	const audioManager = new GameAudioManager();
	const MAX_HINT_VIEWS_PER_STAGE = 3;
	type MenuView = 'menu' | 'library' | 'editor';

	let resetKey = $state(0);
	let hintViewsRemaining = $state(MAX_HINT_VIEWS_PER_STAGE);
	let showHint = $state(false);
	let menuView = $state<MenuView>('menu');
	let customMaps = $state<CustomMapRecord[]>([]);
	let editorDocument = $state<StageMapDocument>(createEmptyStageMapDocument());
	let editorMapId = $state<string | undefined>(undefined);
	let editorKey = $state(0);
	let importedMapTitle = $state('');
	let customStage = $state<StageData | null>(null);
	let stage = $derived(customStage ?? getStage(session.currentStage));

	onMount(() => {
		let mounted = true;
		void session.load().then(async () => {
			if (!mounted) return;
			await refreshCustomMaps();
			await importMapFromUrl();
			if (!mounted) return;
			audioManager.setPreferences(session.getAudioPreferences());
			audioManager.setSkin(session.skin);
			audioManager.attemptAutoplay();
		});

		const unlockAudio = () => audioManager.unlock();
		document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
		document.addEventListener('keydown', unlockAudio, { once: true, capture: true });
		document.addEventListener('touchstart', unlockAudio, { once: true, capture: true });

		return () => {
			mounted = false;
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
		customStage = null;
		session.start(1);
		resetStageUi();
		resetKey += 1;
	}

	function continueGame(): void {
		audioManager.unlock();
		customStage = null;
		session.start(session.highestStage);
		resetStageUi();
		resetKey += 1;
	}

	function selectStage(stageId: number): void {
		audioManager.unlock();
		customStage = null;
		session.start(stageId);
		resetStageUi();
		resetKey += 1;
	}

	function retryStage(): void {
		session.retry();
		resetStageUi();
		resetKey += 1;
	}

	function nextStage(): void {
		if (session.isCustomStage) {
			returnToCustomMaps();
			return;
		}
		session.nextStage();
		resetStageUi();
		resetKey += 1;
	}

	function returnToMenu(): void {
		session.returnToMenu();
		customStage = null;
		menuView = 'menu';
		showHint = false;
		resetKey += 1;
	}

	function handlePhaseChange(phase: GamePhase): void {
		session.setPhase(phase);
		if (phase === 'drawing' || phase === 'simulating' || phase === 'cleared' || phase === 'failed') {
			showHint = false;
		}
	}

	function handleClear(score: StageScore): void {
		session.markCleared(score, MAX_HINT_VIEWS_PER_STAGE - hintViewsRemaining);
	}

	function handleFail(): void {
		session.markFailed(MAX_HINT_VIEWS_PER_STAGE - hintViewsRemaining);
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

	function resetStageUi(): void {
		hintViewsRemaining = MAX_HINT_VIEWS_PER_STAGE;
		showHint = false;
	}

	function handleHintRequest(): void {
		if (session.phase === 'simulating' || showHint || hintViewsRemaining <= 0) return;
		hintViewsRemaining -= 1;
		showHint = true;
	}

	function openMapCreator(): void {
		editorDocument = createEmptyStageMapDocument();
		editorMapId = undefined;
		editorKey += 1;
		menuView = 'editor';
	}

	function openMapLibrary(): void {
		importedMapTitle = '';
		void refreshCustomMaps();
		menuView = 'library';
	}

	function editCustomMap(record: CustomMapRecord): void {
		editorDocument = cloneStageMapDocument(record.document);
		editorMapId = record.id;
		editorKey += 1;
		menuView = 'editor';
	}

	async function saveCustomMap(document: StageMapDocument, id?: string): Promise<CustomMapRecord> {
		const record = await session.saveCustomMap(document, id);
		await refreshCustomMaps();
		return record;
	}

	async function importCustomMap(shareCode: string): Promise<void> {
		const document = decodeSharedStageMap(shareCode);
		const record = await session.saveCustomMap(document);
		importedMapTitle = record.title;
		await refreshCustomMaps();
	}

	async function deleteCustomMap(record: CustomMapRecord): Promise<void> {
		await session.deleteCustomMap(record.id);
		await refreshCustomMaps();
	}

	function testCustomMap(document: StageMapDocument): void {
		customStage = createStageDataFromMapDocument(document);
		session.startCustom(customStage.id);
		resetStageUi();
		resetKey += 1;
	}

	function playCustomMap(record: CustomMapRecord): void {
		testCustomMap(record.document);
	}

	function returnToCustomMaps(): void {
		session.returnToMenu();
		customStage = null;
		showHint = false;
		menuView = 'library';
		void refreshCustomMaps();
	}

	async function refreshCustomMaps(): Promise<void> {
		customMaps = await session.listCustomMaps();
	}

	async function importMapFromUrl(): Promise<void> {
		const shareCode = new URLSearchParams(window.location.search).get('custom-map');
		if (!shareCode) return;
		try {
			await importCustomMap(shareCode);
			menuView = 'library';
			window.history.replaceState({}, '', window.location.pathname);
		} catch {
			window.history.replaceState({}, '', window.location.pathname);
		}
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
	{#if !session.isLoaded}
		<div class="grid size-full place-items-center bg-sky-100 text-sm font-semibold text-slate-700" role="status">
			저장 데이터를 불러오는 중...
		</div>
	{:else if session.hasStarted}
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
				stage={session.isCustomStage ? '사용자 맵' : stage.id}
				difficulty={session.isCustomStage ? '제작 맵' : stage.difficultyLabel}
				objectiveLabel={stage.objectiveLabel}
				objectiveHint={stage.objectiveHint}
				dangerLabel={stage.dangerLabel}
				phase={session.phase}
				inkRatio={session.inkRatio}
				remainingSeconds={session.remainingSeconds}
				{hintViewsRemaining}
				{showHint}
				onHint={handleHintRequest}
				onRetry={retryStage}
				onMenu={session.isCustomStage ? returnToCustomMaps : returnToMenu}
			/>
			<ResultOverlay
				phase={session.phase}
				stage={stage.id}
				score={session.currentScore}
				nextLabel={session.isCustomStage ? '내 지도' : '다음 Stage'}
				onNext={nextStage}
				onRetry={retryStage}
				onMenu={session.isCustomStage ? returnToCustomMaps : returnToMenu}
			/>
		</div>
	{:else if menuView === 'editor'}
		{#key editorKey}
			<MapEditor
				document={editorDocument}
				mapId={editorMapId}
				skin={session.skin}
				onBack={openMapLibrary}
				onSave={saveCustomMap}
				onTest={testCustomMap}
			/>
		{/key}
	{:else if menuView === 'library'}
		<CustomMapLibrary
			maps={customMaps}
			skin={session.skin}
			importedTitle={importedMapTitle}
			onBack={() => (menuView = 'menu')}
			onCreate={openMapCreator}
			onEdit={editCustomMap}
			onPlay={playCustomMap}
			onImport={importCustomMap}
			onDelete={deleteCustomMap}
		/>
	{:else}
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
			onMapCreate={openMapCreator}
			onMapLibrary={openMapLibrary}
		/>
	{/if}
</GameShell>
