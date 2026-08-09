<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowDownToLine, ArrowLeft, ClipboardPaste, CloudUpload, FilePlus2, Globe2, Map, Pencil, Play, RefreshCw, Trash2, Trophy } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { CustomMapRecord } from '$lib/game/state/game-persistence.js';
	import type { OnlineLeaderboardEntry, OnlineMapSummary } from '$lib/game/online/types.js';
	import type { SkinId } from '$lib/game/types.js';

	interface Props {
		maps: CustomMapRecord[];
		skin: SkinId;
		importedTitle?: string;
		onBack: () => void;
		onCreate: () => void;
		onEdit: (record: CustomMapRecord) => void;
		onPlay: (record: CustomMapRecord) => void;
		onImport: (shareCode: string) => Promise<void>;
		onDelete: (record: CustomMapRecord) => Promise<void>;
		onPublish?: (record: CustomMapRecord) => Promise<void>;
		onDownloadOnline?: (map: OnlineMapSummary) => Promise<void>;
		nickname?: string;
	}

	let { maps, skin, importedTitle = '', nickname, onBack, onCreate, onEdit, onPlay, onImport, onDelete, onPublish, onDownloadOnline }: Props = $props();
	let shareCode = $state('');
	let message = $state('');
	let error = $state('');
	let deletingId = $state<string | null>(null);
	let publishingId = $state<string | null>(null);
	let downloadingId = $state<string | null>(null);
	let onlineMaps = $state<OnlineMapSummary[]>([]);
	let onlineLoading = $state(false);
	let onlineError = $state('');
	let activeTab = $state<'local' | 'online'>('local');
	let leaderboardMapId = $state<string | null>(null);
	let leaderboardLoadingId = $state<string | null>(null);
	let mapLeaderboards = $state<Record<string, OnlineLeaderboardEntry[]>>({});

	onMount(() => {
		void loadOnlineMaps();
	});

	$effect(() => {
		if (importedTitle) message = `${importedTitle} 지도를 추가했습니다.`;
	});

	async function importMap(): Promise<void> {
		if (!shareCode.trim()) return;
		error = '';
		try {
			await onImport(shareCode);
			message = '지도를 내 목록에 저장했습니다.';
			shareCode = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '지도를 불러오지 못했습니다.';
		}
	}

	async function deleteMap(record: CustomMapRecord): Promise<void> {
		if (!window.confirm(`'${record.title}' 지도를 삭제할까요?`)) return;
		deletingId = record.id;
		try {
			await onDelete(record);
		} finally {
			deletingId = null;
		}
	}

	async function publishMap(record: CustomMapRecord): Promise<void> {
		if (!onPublish) return;
		publishingId = record.id;
		error = '';
		try {
			await onPublish(record);
			message = `'${record.title}' 지도를 온라인에 공유했습니다.`;
			await loadOnlineMaps();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '온라인 공유에 실패했습니다.';
		} finally {
			publishingId = null;
		}
	}

	async function downloadMap(map: OnlineMapSummary): Promise<void> {
		if (!onDownloadOnline) return;
		downloadingId = map.mapId;
		onlineError = '';
		try {
			await onDownloadOnline(map);
			message = `'${map.title}' 지도를 내 지도에 저장했습니다.`;
		} catch (cause) {
			onlineError = cause instanceof Error ? cause.message : '온라인 지도를 내려받지 못했습니다.';
		} finally {
			downloadingId = null;
		}
	}

	async function loadOnlineMaps(): Promise<void> {
		onlineLoading = true;
		onlineError = '';
		try {
			const response = await fetch('/api/maps?limit=20');
			const body = (await response.json()) as { maps?: OnlineMapSummary[]; message?: string };
			if (!response.ok) throw new Error(body.message ?? '온라인 지도를 불러오지 못했습니다.');
			onlineMaps = body.maps ?? [];
		} catch (cause) {
			onlineError = cause instanceof Error ? cause.message : '온라인 지도를 불러오지 못했습니다.';
		} finally {
			onlineLoading = false;
		}
	}

	async function loadMapLeaderboard(map: OnlineMapSummary): Promise<void> {
		if (leaderboardMapId === map.mapId) {
			leaderboardMapId = null;
			return;
		}
		leaderboardMapId = map.mapId;
		if (mapLeaderboards[map.mapId]) return;
		leaderboardLoadingId = map.mapId;
		try {
			const response = await fetch(`/api/maps/${encodeURIComponent(map.mapId)}/leaderboard?limit=5`);
			const body = (await response.json()) as { entries?: OnlineLeaderboardEntry[]; message?: string };
			if (!response.ok) throw new Error(body.message ?? '지도 랭킹을 불러오지 못했습니다.');
			mapLeaderboards = { ...mapLeaderboards, [map.mapId]: body.entries ?? [] };
		} catch (cause) {
			onlineError = cause instanceof Error ? cause.message : '지도 랭킹을 불러오지 못했습니다.';
		} finally {
			leaderboardLoadingId = null;
		}
	}

	function formatDate(timestamp: number): string {
		return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
	}
</script>

<section class="library-screen" data-skin={skin}>
	<header class="library-header">
		<Button variant="secondary" size="icon-sm" aria-label="메뉴로 돌아가기" onclick={onBack}>
			<ArrowLeft class="size-4" />
		</Button>
		<div>
			<div class="eyebrow"><Map class="size-3.5" /> 사용자 제작 지도</div>
			<h1>내 지도</h1>
		</div>
		<Button size="sm" class="font-black" onclick={onCreate}>
			<FilePlus2 class="size-4" /> 만들기
		</Button>
	</header>
	<div class="identity-line"><Globe2 class="size-3.5" /> {nickname ? `${nickname}님의 지도 보관함` : '온라인 공유는 닉네임이 필요합니다.'}</div>
	<nav class="library-tabs" aria-label="지도 목록 구분">
		<button type="button" class:active={activeTab === 'local'} onclick={() => (activeTab = 'local')}>내 지도 <span>{maps.length}</span></button>
		<button type="button" class:active={activeTab === 'online'} onclick={() => (activeTab = 'online')}>온라인 지도 <span>{onlineMaps.length}</span></button>
	</nav>

	<section class="import-band" aria-label="커스텀 지도 불러오기">
		<label for="custom-map-import">공유 코드 불러오기</label>
		<textarea id="custom-map-import" bind:value={shareCode} placeholder="QR에서 열리거나 받은 공유 코드를 붙여넣으세요."></textarea>
		<Button variant="secondary" class="h-10 w-full font-black" onclick={importMap}>
			<ClipboardPaste class="size-4" /> 지도 불러오기
		</Button>
		{#if message}<p class="import-message" aria-live="polite">{message}</p>{/if}
		{#if error}<p class="import-error" role="alert">{error}</p>{/if}
	</section>

	{#if activeTab === 'local'}
	<div class="map-list" aria-label="저장한 지도 목록">
		{#if maps.length === 0}
			<div class="empty-map-list">
				<Map class="size-8" />
				<strong>저장한 지도가 없습니다.</strong>
				<Button size="sm" onclick={onCreate}><FilePlus2 class="size-4" /> 첫 지도 만들기</Button>
			</div>
		{:else}
			{#each maps as map (map.id)}
				<article class="map-row">
					<div class="map-row-main">
						<div class="map-row-title">{map.title}</div>
						<div class="map-row-meta">{map.document.objects.length}개 오브젝트 · {formatDate(map.updatedAt)}</div>
					</div>
					<div class="map-row-actions">
						{#if onPublish}<Button variant="secondary" size="icon-sm" aria-label={`${map.title} 온라인 공유`} title={map.onlineMapId ? '온라인 지도 업데이트' : '온라인 공유'} disabled={publishingId === map.id} onclick={() => void publishMap(map)}><CloudUpload class="size-4" /></Button>{/if}
						<Button variant="secondary" size="icon-sm" aria-label={`${map.title} 편집`} title="편집" onclick={() => onEdit(map)}>
							<Pencil class="size-4" />
						</Button>
						<Button size="icon-sm" aria-label={`${map.title} 플레이`} title="플레이" onclick={() => onPlay(map)}>
							<Play class="size-4" />
						</Button>
						<Button variant="ghost" size="icon-sm" aria-label={`${map.title} 삭제`} title="삭제" disabled={deletingId === map.id} onclick={() => deleteMap(map)}>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</article>
			{/each}
		{/if}
	</div>
	{:else}
	<div class="online-toolbar"><span>다른 플레이어가 공유한 지도</span><Button variant="ghost" size="icon-sm" aria-label="온라인 지도 새로고침" onclick={() => void loadOnlineMaps()}><RefreshCw class="size-4" /></Button></div>
	{#if onlineError}<p class="import-error" role="alert">{onlineError}</p>{/if}
	<div class="map-list" aria-label="온라인 지도 목록">
		{#if onlineLoading}<div class="empty-map-list">온라인 지도를 불러오는 중...</div>
		{:else if onlineMaps.length === 0}<div class="empty-map-list"><Globe2 class="size-8" /><strong>공유된 지도가 없습니다.</strong></div>
		{:else}
			{#each onlineMaps as map (map.mapId)}
				<article class="map-row">
					<div class="map-row-main"><div class="map-row-title">{map.title}</div><div class="map-row-meta">{map.authorNickname} · {map.objectCount}개 오브젝트 · 다운로드 {map.downloadCount}</div></div>
					<div class="map-row-actions"><Button variant="secondary" size="icon-sm" aria-label={`${map.title} 랭킹 보기`} title="랭킹" disabled={leaderboardLoadingId === map.mapId} onclick={() => void loadMapLeaderboard(map)}><Trophy class="size-4" /></Button><Button size="icon-sm" aria-label={`${map.title} 내 지도에 저장`} title="내 지도에 저장" disabled={downloadingId === map.mapId} onclick={() => void downloadMap(map)}><ArrowDownToLine class="size-4" /></Button></div>
				</article>
				{#if leaderboardMapId === map.mapId}
					<div class="map-leaderboard" aria-label={`${map.title} 지도 랭킹`}>
						{#if (mapLeaderboards[map.mapId] ?? []).length === 0}<span>아직 등록된 기록이 없습니다.</span>{:else}{#each mapLeaderboards[map.mapId] as entry, index (entry.nickname)}<div><strong>{index + 1}. {entry.nickname}</strong><span>★ {entry.stars.toFixed(1)} · {entry.clearTimeMs === null ? '-' : `${(entry.clearTimeMs / 1000).toFixed(1)}초`}</span></div>{/each}{/if}
					</div>
				{/if}
			{/each}
		{/if}
	</div>
	{/if}
</section>

<style>
	.library-screen {
		min-height: 100%;
		padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
		background: linear-gradient(180deg, #dff4ff 0%, #f8fcff 47%, #d7efcf 100%);
		color: #13273e;
		overflow-y: auto;
	}

	.library-screen[data-skin='minecraft'] { background: linear-gradient(180deg, #dff1c2, #fbffe8 52%, #c7dfb1); }
	.library-screen[data-skin='lego'] { background: linear-gradient(180deg, #e4f4ff, #fff8d8 55%, #e4f2ff); }

	.library-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.65rem; }
	.identity-line { display: flex; align-items: center; gap: .3rem; margin-top: .55rem; color: #607b91; font-size: .68rem; font-weight: 800; }
	.library-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: .3rem; margin-top: .8rem; border-bottom: 1px solid rgba(46,77,104,.16); }
	.library-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; padding: .55rem .25rem; color: #71889a; font-size: .76rem; font-weight: 900; cursor: pointer; }
	.library-tabs button.active { border-bottom-color: #2876a5; color: #1d4f70; }
	.library-tabs span { margin-left: .15rem; color: #9bafbd; font-size: .66rem; }
	.eyebrow { display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; font-weight: 900; color: #52708d; }
	h1 { margin: 0.12rem 0 0; font-size: 1.35rem; font-weight: 950; letter-spacing: 0; }

	.import-band { margin-top: 1rem; border-top: 2px solid rgba(73, 115, 149, 0.28); border-bottom: 2px solid rgba(73, 115, 149, 0.18); padding: 0.8rem 0; }
	.import-band label { display: block; margin-bottom: 0.35rem; font-size: 0.78rem; font-weight: 900; }
	.import-band textarea { display: block; width: 100%; height: 4.6rem; resize: none; border: 1px solid #b9cee1; border-radius: 4px; background: rgba(255,255,255,0.82); padding: 0.55rem; font-size: 0.72rem; color: #263d55; }
	.import-band :global(button) { margin-top: 0.45rem; }
	.import-message, .import-error { margin: 0.45rem 0 0; font-size: 0.75rem; font-weight: 800; }
	.import-message { color: #177344; }
	.import-error { color: #b3382d; }

	.map-list { display: grid; gap: 0.55rem; padding: 0.9rem 0; }
	.online-toolbar { display: flex; align-items: center; justify-content: space-between; margin-top: .75rem; color: #55718a; font-size: .72rem; font-weight: 800; }
	.map-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-bottom: 1px solid rgba(46, 77, 104, 0.2); padding: 0.6rem 0; }
	.map-leaderboard { display: grid; gap: .35rem; margin: -.2rem 0 .45rem; border-radius: 10px; background: rgba(255,255,255,.6); padding: .5rem .6rem; color: #55718a; font-size: .67rem; font-weight: 700; }
	.map-leaderboard div { display: flex; justify-content: space-between; gap: .5rem; } .map-leaderboard strong { color: #294a64; } .map-leaderboard span { white-space: nowrap; }
	.map-row-main { min-width: 0; }
	.map-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem; font-weight: 900; }
	.map-row-meta { margin-top: 0.15rem; font-size: 0.67rem; font-weight: 700; color: #59718a; }
	.map-row-actions { display: flex; align-items: center; gap: 0.25rem; }
	.empty-map-list { display: grid; min-height: 13rem; place-items: center; align-content: center; gap: 0.65rem; color: #54718b; text-align: center; font-size: 0.82rem; }
	.empty-map-list strong { color: #1f3f5d; }
</style>
