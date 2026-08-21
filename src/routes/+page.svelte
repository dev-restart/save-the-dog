<script lang="ts">
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import GameShell from '$lib/components/game/GameShell.svelte';
	import MainMenu from '$lib/components/game/MainMenu.svelte';
	import CustomMapLibrary from '$lib/components/game/CustomMapLibrary.svelte';
	import MapEditor from '$lib/components/game/MapEditor.svelte';
	import NicknameOnboarding from '$lib/components/game/NicknameOnboarding.svelte';
	import RankingBoard from '$lib/components/game/RankingBoard.svelte';
	import ResultOverlay from '$lib/components/game/ResultOverlay.svelte';
	import { GameAudioManager } from '$lib/game/audio.js';
	import { GameSessionState } from '$lib/game/state/game-session.svelte.js';
	import { triggerHaptic } from '$lib/game/haptics.js';
	import type { StageScore } from '$lib/game/scoring.js';
	import type { StageReplay } from '$lib/game/replay.js';
	import { CAMPAIGN_STAGE_COUNT } from '$lib/game/stages/campaign.js';
	import { getStage } from '$lib/game/stages/index.js';
	import {
		cloneStageMapDocument,
		createEmptyStageMapDocument,
		createStageDataFromMapDocument,
		decodeSharedStageMap,
		type StageMapDocument
	} from '$lib/game/stages/stage-map-schema.js';
	import type { CustomMapRecord } from '$lib/game/state/game-persistence.js';
	import type { OnlineMap, OnlineMapSummary, OnlineIdentity, PlayerProgress } from '$lib/game/online/types.js';
	import type { GamePhase, SkinId, StageData } from '$lib/game/types.js';

	const session = new GameSessionState();
	const audioManager = new GameAudioManager();
	const MAX_HINT_VIEWS_PER_STAGE = 3;
	type MenuView = 'menu' | 'library' | 'editor' | 'ranking';

	let resetKey = $state(0);
	let simulationSpeed = $state<1 | 2 | 3>(1);
	let hintViewsRemaining = $state(MAX_HINT_VIEWS_PER_STAGE);
	let showHint = $state(false);
	let menuView = $state<MenuView>('menu');
	let onlineState = $state<'loading' | 'ready' | 'onboarding' | 'offline'>('loading');
	let onlineIdentity = $state<OnlineIdentity | null>(null);
	let customMaps = $state<CustomMapRecord[]>([]);
	let editorDocument = $state<StageMapDocument>(createEmptyStageMapDocument());
	let editorMapId = $state<string | undefined>(undefined);
	let editorKey = $state(0);
	let importedMapTitle = $state('');
	let customStage = $state<StageData | null>(null);
	let activeCustomOnlineMapId = $state<string | null>(null);
	let stage = $derived(customStage ?? getStage(session.currentStage));

	onMount(() => {
		let mounted = true;
		void session.load().then(async () => {
			if (!mounted) return;
			await initializeOnlineIdentity();
			if (onlineState === 'ready') {
				await synchronizeServerData();
				await importMapFromUrl();
			} else if (onlineState === 'offline') {
				customMaps = await session.listCustomMaps();
			}
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

	async function initializeOnlineIdentity(): Promise<void> {
		try {
			const controller = new AbortController();
			const timeout = window.setTimeout(() => controller.abort(), 2500);
			const response = await fetch('/api/identity', { cache: 'no-store', signal: controller.signal });
			window.clearTimeout(timeout);
			const body = (await response.json()) as OnlineIdentity & { message?: string };
			if (!response.ok) throw new Error(body.message ?? '온라인 기능을 사용할 수 없습니다.');
			onlineIdentity = body;
			onlineState = body.registered ? 'ready' : 'onboarding';
		} catch {
			onlineIdentity = null;
			onlineState = 'offline';
		}
	}

	async function createOnlineIdentity(nickname: string, password: string): Promise<void> {
		const response = await fetch('/api/identity', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ nickname, password })
		});
		const body = (await response.json()) as OnlineIdentity & { message?: string };
		if (!response.ok) throw new Error(body.message ?? '계정을 만들지 못했습니다.');
		onlineIdentity = body;
		onlineState = 'ready';
		await synchronizeServerData();
	}

	async function loginOnlineIdentity(nickname: string, password: string): Promise<void> {
		const response = await fetch('/api/identity', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ nickname, password })
		});
		const body = (await response.json()) as OnlineIdentity & { message?: string };
		if (!response.ok) throw new Error(body.message ?? '로그인하지 못했습니다.');
		onlineIdentity = body;
		onlineState = 'ready';
		await synchronizeServerData();
	}

	async function synchronizeServerData(): Promise<void> {
		await refreshServerProgress();
		await refreshCustomMaps();
	}

	async function refreshServerProgress(): Promise<void> {
		if (onlineState !== 'ready') return;
		const response = await fetch('/api/progress', { cache: 'no-store' });
		const body = (await response.json()) as { progress?: PlayerProgress; message?: string };
		if (!response.ok || !body.progress) throw new Error(body.message ?? '게임 진행도를 불러오지 못했습니다.');
		session.applyServerProgress(body.progress);
	}

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
		session.start(Math.min(CAMPAIGN_STAGE_COUNT, session.highestStage));
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
		if (session.currentStage >= CAMPAIGN_STAGE_COUNT) {
			returnToMenu();
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

	function handleClear(score: StageScore, replay: StageReplay): void {
		session.markCleared(score, MAX_HINT_VIEWS_PER_STAGE - hintViewsRemaining);
		void submitStageTelemetry('cleared', 'none', score.inkRatio, session.survivalElapsedMs).catch(() => undefined);
		if (!session.isCustomStage) {
			void submitStageReplay(replay).catch(() => refreshServerProgress().catch(() => undefined));
		}
		if (session.isCustomStage && activeCustomOnlineMapId) {
			void submitCustomMapReplay(activeCustomOnlineMapId, replay).catch(() => undefined);
		}
	}

	async function submitStageReplay(replay: StageReplay): Promise<void> {
		if (onlineState !== 'ready') return;
		const response = await fetch('/api/game/replay', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ replay })
		});
		const body = (await response.json()) as { progress?: PlayerProgress; message?: string };
		if (!response.ok) throw new Error(body.message ?? '서버에서 게임 결과를 검증하지 못했습니다.');
		if (body.progress) session.applyServerProgress(body.progress);
	}

	function handleFail(reason?: string): void {
		session.markFailed(MAX_HINT_VIEWS_PER_STAGE - hintViewsRemaining);
		void submitStageTelemetry('failed', reason ?? 'unknown', session.inkRatio, session.survivalElapsedMs).catch(() => undefined);
	}

	async function submitStageTelemetry(outcome: 'cleared' | 'failed', reason: string, inkRatio: number, elapsedMs: number): Promise<void> {
		if (onlineState !== 'ready' || session.isCustomStage) return;
		await fetch('/api/telemetry/stage', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ stageId: stage.id, outcome, reason, inkRatio, elapsedMs })
		});
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
		simulationSpeed = 1;
	}

	function toggleSimulationSpeed(): void {
		if (session.phase !== 'simulating') return;
		simulationSpeed = simulationSpeed === 1 ? 2 : simulationSpeed === 2 ? 3 : 1;
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

	function openLeaderboard(): void {
		menuView = 'ranking';
	}

	function editCustomMap(record: CustomMapRecord): void {
		editorDocument = cloneStageMapDocument(record.document);
		editorMapId = record.id;
		editorKey += 1;
		menuView = 'editor';
	}

	async function saveCustomMap(document: StageMapDocument, id?: string): Promise<CustomMapRecord> {
		if (onlineState !== 'ready') throw new Error('내 지도를 저장하려면 로그인이 필요합니다.');
		const response = await fetch('/api/my/maps', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ document, mapId: id })
		});
		const record = (await response.json()) as CustomMapRecord & { message?: string };
		if (!response.ok) throw new Error(record.message ?? '내 지도를 저장하지 못했습니다.');
		await session.cacheCustomMap(record);
		await refreshCustomMaps();
		return record;
	}

	async function publishCustomMap(record: CustomMapRecord): Promise<void> {
		if (onlineState !== 'ready') throw new Error('온라인 공유를 하려면 닉네임을 먼저 만들어야 합니다.');
		const response = await fetch('/api/maps', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ document: record.document, mapId: record.onlineMapId, ownerMapId: record.id })
		});
		const body = (await response.json()) as OnlineMapSummary & { message?: string };
		if (!response.ok) throw new Error(body.message ?? '온라인 공유에 실패했습니다.');
		await refreshCustomMaps();
	}

	async function downloadOnlineMap(map: OnlineMapSummary): Promise<void> {
		const response = await fetch(`/api/maps/${encodeURIComponent(map.mapId)}`, { cache: 'no-store' });
		const body = (await response.json()) as OnlineMap & { message?: string };
		if (!response.ok || !body.document) throw new Error(body.message ?? '온라인 지도를 내려받지 못했습니다.');
		const saveResponse = await fetch('/api/my/maps', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ document: body.document, sourceOnlineMapId: map.mapId })
		});
		const saved = (await saveResponse.json()) as CustomMapRecord & { message?: string };
		if (!saveResponse.ok) throw new Error(saved.message ?? '내 지도에 저장하지 못했습니다.');
		await session.cacheCustomMap(saved);
		await refreshCustomMaps();
	}

	async function importCustomMap(shareCode: string): Promise<void> {
		const document = decodeSharedStageMap(shareCode);
		const record = await saveCustomMap(document);
		importedMapTitle = record.title;
	}

	async function deleteCustomMap(record: CustomMapRecord): Promise<void> {
		if (onlineState !== 'ready') throw new Error('내 지도를 삭제하려면 로그인이 필요합니다.');
		const response = await fetch(`/api/my/maps/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
		const body = (await response.json()) as { message?: string };
		if (!response.ok) throw new Error(body.message ?? '내 지도를 삭제하지 못했습니다.');
		await session.deleteCustomMap(record.id);
		await refreshCustomMaps();
	}

	async function submitCustomMapReplay(mapId: string, replay: StageReplay): Promise<void> {
		const response = await fetch(`/api/maps/${encodeURIComponent(mapId)}/leaderboard`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ replay })
		});
		if (!response.ok) return;
	}

	function testCustomMap(document: StageMapDocument, onlineMapId?: string): void {
		customStage = createStageDataFromMapDocument(document);
		activeCustomOnlineMapId = onlineMapId ?? null;
		session.startCustom(customStage.id);
		resetStageUi();
		resetKey += 1;
	}

	function playCustomMap(record: CustomMapRecord): void {
		testCustomMap(record.document, record.sourceOnlineMapId ?? record.onlineMapId);
	}

	function returnToCustomMaps(): void {
		session.returnToMenu();
		customStage = null;
		activeCustomOnlineMapId = null;
		showHint = false;
		menuView = 'library';
		void refreshCustomMaps();
	}

	async function refreshCustomMaps(): Promise<void> {
		if (onlineState !== 'ready') {
			customMaps = await session.listCustomMaps();
			return;
		}
		try {
			const response = await fetch('/api/my/maps', { cache: 'no-store' });
			const body = (await response.json()) as { maps?: CustomMapRecord[]; message?: string };
			if (!response.ok) throw new Error(body.message ?? '내 지도를 불러오지 못했습니다.');
			customMaps = body.maps ?? [];
			await session.replaceCustomMapCache(customMaps);
		} catch (cause) {
			customMaps = await session.listCustomMaps();
			console.warn('내 지도 서버 동기화에 실패해 IndexedDB cache를 사용합니다.', cause);
		}
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
	{:else if onlineState === 'onboarding'}
		<NicknameOnboarding onRegister={createOnlineIdentity} onLogin={loginOnlineIdentity} />
	{:else if onlineState === 'offline'}
		<div class="grid size-full place-items-center bg-slate-950 p-6 text-center text-white" role="alert">
			<div class="grid max-w-xs gap-3">
				<strong class="text-lg">로그인 서버에 연결할 수 없습니다.</strong>
				<span class="text-sm text-slate-300">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</span>
				<button class="rounded-xl bg-white px-4 py-3 font-black text-slate-900" onclick={() => void initializeOnlineIdentity()}>다시 연결</button>
			</div>
		</div>
	{:else if session.hasStarted}
		<div class="relative size-full overflow-hidden">
			<GameCanvas
				{stage}
				{resetKey}
				skin={session.skin}
				{simulationSpeed}
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
				{simulationSpeed}
				inkRatio={session.inkRatio}
				remainingSeconds={session.remainingSeconds}
				{hintViewsRemaining}
				{showHint}
				onHint={handleHintRequest}
				onToggleSpeed={toggleSimulationSpeed}
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
			onPublish={publishCustomMap}
			onDownloadOnline={downloadOnlineMap}
			nickname={onlineIdentity?.nickname}
		/>
	{:else if menuView === 'ranking'}
		<RankingBoard
			nickname={onlineIdentity?.nickname}
			highestStage={session.highestStage}
			totalClears={session.totalClears}
			totalStars={session.totalStars}
			skin={session.skin}
			onBack={() => (menuView = 'menu')}
		/>
	{:else}
		<MainMenu
			nickname={onlineIdentity?.nickname}
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
			onLeaderboard={openLeaderboard}
		/>
	{/if}
</GameShell>
