<script lang="ts">
	import { ArrowLeft, ClipboardPaste, FilePlus2, Map, Pencil, Play, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { CustomMapRecord } from '$lib/game/state/game-persistence.js';
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
	}

	let { maps, skin, importedTitle = '', onBack, onCreate, onEdit, onPlay, onImport, onDelete }: Props = $props();
	let shareCode = $state('');
	let message = $state('');
	let error = $state('');
	let deletingId = $state<string | null>(null);

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

	<section class="import-band" aria-label="커스텀 지도 불러오기">
		<label for="custom-map-import">공유 코드 불러오기</label>
		<textarea id="custom-map-import" bind:value={shareCode} placeholder="QR에서 열리거나 받은 공유 코드를 붙여넣으세요."></textarea>
		<Button variant="secondary" class="h-10 w-full font-black" onclick={importMap}>
			<ClipboardPaste class="size-4" /> 지도 불러오기
		</Button>
		{#if message}<p class="import-message" aria-live="polite">{message}</p>{/if}
		{#if error}<p class="import-error" role="alert">{error}</p>{/if}
	</section>

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
	.map-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-bottom: 1px solid rgba(46, 77, 104, 0.2); padding: 0.6rem 0; }
	.map-row-main { min-width: 0; }
	.map-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem; font-weight: 900; }
	.map-row-meta { margin-top: 0.15rem; font-size: 0.67rem; font-weight: 700; color: #59718a; }
	.map-row-actions { display: flex; align-items: center; gap: 0.25rem; }
	.empty-map-list { display: grid; min-height: 13rem; place-items: center; align-content: center; gap: 0.65rem; color: #54718b; text-align: center; font-size: 0.82rem; }
	.empty-map-list strong { color: #1f3f5d; }
</style>
