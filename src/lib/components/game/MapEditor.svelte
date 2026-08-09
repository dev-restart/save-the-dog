<script lang="ts">
	import {
		ArrowLeft,
		CircleAlert,
		Eraser,
		Play,
		RotateCcw,
		RotateCw,
		Save,
		Share2
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getSkinDefinition } from '$lib/game/skins.js';
	import {
		createEmptyStageMapDocument,
		cloneStageMapDocument,
		validateStageMapDocument,
		type StageMapDocument,
		type StageMapObject,
		type StageMapObjectKind
	} from '$lib/game/stages/stage-map-schema.js';
	import type { CustomMapRecord } from '$lib/game/state/game-persistence.js';
	import type { BeeAttackStyle, DifficultyProfileId, ObstacleType, SkinId, StageEnvironment } from '$lib/game/types.js';
	import MapShareDialog from './MapShareDialog.svelte';

	interface Props {
		document: StageMapDocument;
		mapId?: string;
		skin: SkinId;
		onBack: () => void;
		onSave: (document: StageMapDocument, id?: string) => Promise<CustomMapRecord>;
		onTest: (document: StageMapDocument) => void;
	}

	let { document, mapId, skin, onBack, onSave, onTest }: Props = $props();

	type EditorTool = 'select' | StageMapObjectKind;

	const WORLD_WIDTH = 390;
	const WORLD_HEIGHT = 693;
	const GRID_SIZE = 20;
	const STICKY_GRID_TOOLS = new Set<EditorTool>(['brick', 'terrain-block', 'water', 'lava', 'acid']);
	const TOOL_ITEMS: Array<{ kind: EditorTool; label: string }> = [
		{ kind: 'select', label: '선택' },
		{ kind: 'dog', label: '강아지' },
		{ kind: 'hive', label: '벌집' },
		{ kind: 'ground', label: '땅' },
		{ kind: 'platform', label: '발판' },
		{ kind: 'brick', label: '흙 블록' },
		{ kind: 'terrain-block', label: '잔디 블록' },
		{ kind: 'wall', label: '흙벽' },
		{ kind: 'wood', label: '나무판' },
		{ kind: 'stone', label: '돌기둥' },
		{ kind: 'crate', label: '상자' },
		{ kind: 'ice', label: '얼음' },
		{ kind: 'water', label: '물' },
		{ kind: 'lava', label: '용암' },
		{ kind: 'acid', label: '산성 웅덩이' },
		{ kind: 'spike', label: '가시' },
		{ kind: 'bomb', label: '폭탄' },
		{ kind: 'boulder', label: '바위' },
		{ kind: 'rolling-boulder', label: '굴림돌' },
		{ kind: 'no-draw-zone', label: '지형 블록' },
		{ kind: 'no-draw-ground', label: '지면 타일' },
		{ kind: 'no-draw-tree', label: '나무' },
		{ kind: 'no-draw-rock', label: '바위 지형' }
	];
	const OBJECT_LABELS: Record<StageMapObjectKind, string> = {
		dog: '강아지', hive: '벌집', ground: '땅', platform: '발판', spike: '가시', wall: '흙벽', water: '물', lava: '용암',
		brick: '흙 블록', 'terrain-block': '잔디 블록', wood: '나무판', bomb: '폭탄', boulder: '바위', crate: '상자', acid: '산성 웅덩이', ice: '얼음', stone: '돌기둥',
		'rolling-boulder': '굴림돌', 'no-draw-zone': '잔디 지형 블록', 'no-draw-ground': '지면 타일', 'no-draw-tree': '나무 지형', 'no-draw-rock': '바위 지형'
	};
	const ROTATION_STEP = Math.PI / 12;
	const DIFFICULTIES: Array<{ id: DifficultyProfileId; label: string }> = [
		{ id: 'tutorial', label: '튜토리얼' },
		{ id: 'shelter', label: '보호' },
		{ id: 'hazard', label: '함정' },
		{ id: 'swarm', label: '군집' },
		{ id: 'physics', label: '물리' },
		{ id: 'expert', label: '전문가' },
		{ id: 'master', label: '마스터' }
	];

	let map = $state<StageMapDocument>(createEmptyStageMapDocument());
	let savedMapId = $state<string | undefined>(undefined);
	let selectedTool = $state<EditorTool>('select');
	let selectedObjectId = $state<string | null>(null);
	let drag = $state<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
	let error = $state('');
	let status = $state('');
	let showShare = $state(false);
	let isSaving = $state(false);
	let isTesting = $state(false);
	let board = $state<HTMLDivElement | null>(null);
	let selectedObject = $derived(map.objects.find((object) => object.id === selectedObjectId) ?? null);
	let skinAssets = $derived(getSkinDefinition(skin).assets);
	let backgroundSrc = $derived(getBackgroundSrc(map.environment));

	$effect(() => {
		map = cloneStageMapDocument(document);
		savedMapId = mapId;
	});

	function getBackgroundSrc(environment: StageEnvironment): string {
		if (environment === 'volcanic') return skinAssets.volcanoBackground ?? skinAssets.background;
		if (environment === 'forest') return skinAssets.forestBackground ?? skinAssets.background;
		return skinAssets.background;
	}

	function boardPoint(event: PointerEvent): { x: number; y: number } {
		const rect = board?.getBoundingClientRect();
		if (!rect) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
		return {
			x: clamp(((event.clientX - rect.left) / rect.width) * WORLD_WIDTH, 0, WORLD_WIDTH),
			y: clamp(((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT, 0, WORLD_HEIGHT)
		};
	}

	function handleBoardPointerDown(event: PointerEvent): void {
		const point = boardPoint(event);
		error = '';
		status = '';

		if (selectedTool !== 'select') {
			const object = createObject(selectedTool, snapBoardPoint(point));
			if (object.kind === 'dog') map.objects = [...map.objects.filter((item) => item.kind !== 'dog'), object];
			else map.objects = [...map.objects, object];
			selectedObjectId = object.id;
			if (!STICKY_GRID_TOOLS.has(selectedTool)) selectedTool = 'select';
			return;
		}

		const object = findObjectAt(point);
		selectedObjectId = object?.id ?? null;
		if (!object || !board) return;
		board.setPointerCapture(event.pointerId);
		drag = { pointerId: event.pointerId, offsetX: point.x - object.x, offsetY: point.y - object.y };
	}

	function handleBoardPointerMove(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId || !selectedObjectId) return;
		const point = boardPoint(event);
		const nextPoint = { x: clamp(point.x - drag.offsetX, 0, WORLD_WIDTH), y: clamp(point.y - drag.offsetY, 0, WORLD_HEIGHT) };
		const snappedPoint = selectedObject && selectedObject.kind !== 'dog' && selectedObject.kind !== 'hive' ? snapBoardPoint(nextPoint) : nextPoint;
		updateObject(selectedObjectId, snappedPoint);
	}

	function handleBoardPointerEnd(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (board?.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
		drag = null;
	}

	function findObjectAt(point: { x: number; y: number }): StageMapObject | undefined {
		return [...map.objects].reverse().find((object) => {
			const { width, height } = displaySize(object);
			return Math.abs(point.x - object.x) <= width / 2 && Math.abs(point.y - object.y) <= height / 2;
		});
	}

	function createObject(kind: Exclude<EditorTool, 'select'>, point: { x: number; y: number }): StageMapObject {
		const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		if (kind === 'dog') return { id, kind, x: point.x, y: point.y };
		if (kind === 'hive') {
			return { id, kind, x: point.x, y: point.y, beeCount: 10, spawnIntervalMs: 280, beeForce: 0.002, attackStyle: 'direct' };
		}
		const size = defaultSize(kind);
		return { id, kind, x: point.x, y: point.y, width: size.width, height: size.height };
	}

	function snapBoardPoint(point: { x: number; y: number }): { x: number; y: number } {
		return {
			x: clamp(Math.round(point.x / GRID_SIZE) * GRID_SIZE, 0, WORLD_WIDTH),
			y: clamp(Math.round(point.y / GRID_SIZE) * GRID_SIZE, 0, WORLD_HEIGHT)
		};
	}

	function updateObject(id: string, changes: Partial<StageMapObject>): void {
		map.objects = map.objects.map((object) => (object.id === id ? { ...object, ...changes } : object));
	}

	function deleteSelectedObject(): void {
		if (!selectedObject) return;
		if (selectedObject.kind === 'dog') {
			error = '강아지는 삭제할 수 없습니다. 위치를 이동하세요.';
			return;
		}
		if (selectedObject.kind === 'hive' && map.objects.filter((object) => object.kind === 'hive').length === 1) {
			error = '벌집은 하나 이상 필요합니다.';
			return;
		}
		map.objects = map.objects.filter((object) => object.id !== selectedObject.id);
		selectedObjectId = null;
	}

	function rotateSelected(delta: number): void {
		if (!selectedObject || selectedObject.kind === 'dog' || selectedObject.kind === 'hive') return;
		updateObject(selectedObject.id, { angle: normalizeAngle((selectedObject.angle ?? 0) + delta) });
	}

	async function saveMap(): Promise<void> {
		const errors = validateStageMapDocument(map);
		if (errors.length > 0) {
			error = errors[0];
			status = '';
			return;
		}
		error = '';
		status = '';
		isSaving = true;
		try {
			const record = await onSave(map, savedMapId);
			savedMapId = record.id;
			status = '내 지도에 저장했습니다.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '지도를 저장하지 못했습니다.';
		} finally {
			isSaving = false;
		}
	}

	function testMap(): void {
		const errors = validateStageMapDocument(map);
		if (errors.length > 0) {
			error = errors[0];
			status = '';
			return;
		}
		error = '';
		status = '';
		isTesting = true;
		try {
			onTest(map);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '시험 플레이를 시작하지 못했습니다.';
		} finally {
			isTesting = false;
		}
	}

	function openShare(): void {
		const errors = validateStageMapDocument(map);
		if (errors.length > 0) {
			error = errors[0];
			status = '';
			return;
		}
		error = '';
		status = '';
		showShare = true;
	}

	function setNumber(path: 'stageId' | 'inkLimit' | 'survivalSeconds', event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) return;
		if (path === 'stageId') map.stageId = Math.max(1, Math.round(value));
		if (path === 'inkLimit') map.difficulty.inkLimit = Math.round(value);
		if (path === 'survivalSeconds') map.difficulty.survivalMs = Math.round(value * 1000);
	}

	function setObjectNumber(key: keyof Pick<StageMapObject, 'x' | 'y' | 'width' | 'height' | 'angle' | 'beeCount' | 'spawnIntervalMs' | 'beeForce'>, event: Event): void {
		if (!selectedObject) return;
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) return;
		updateObject(selectedObject.id, { [key]: key === 'beeCount' || key === 'spawnIntervalMs' ? Math.round(value) : value });
	}

	function setObjectAngle(event: Event): void {
		if (!selectedObject) return;
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) return;
		updateObject(selectedObject.id, { angle: normalizeAngle((value * Math.PI) / 180) });
	}

	function angleInDegrees(angle: number | undefined): number {
		return Math.round((((angle ?? 0) * 180) / Math.PI) * 10) / 10;
	}

	function selectionToolbarStyle(object: StageMapObject): string {
		const size = displaySize(object);
		const top = clamp(object.y - size.height / 2 - 28, 28, WORLD_HEIGHT - 28);
		return `left:${(object.x / WORLD_WIDTH) * 100}%; top:${(top / WORLD_HEIGHT) * 100}%;`;
	}

	function normalizeAngle(angle: number): number {
		return Math.atan2(Math.sin(angle), Math.cos(angle));
	}

	function displaySize(object: StageMapObject): { width: number; height: number } {
		if (object.kind === 'dog') return { width: 48, height: 48 };
		if (object.kind === 'hive') return { width: 44, height: 44 };
		return { width: object.width ?? 48, height: object.height ?? 32 };
	}

	function objectAsset(kind: StageMapObjectKind): string {
		if (kind === 'dog') return skinAssets.dog;
		if (kind === 'hive') return skinAssets.hive;
		const assets: Partial<Record<ObstacleType, string>> = {
			ground: skinAssets.ground,
			platform: skinAssets.platform,
			spike: skinAssets.spike,
			water: skinAssets.water,
			lava: skinAssets.lava,
		brick: skinAssets.brick,
		'terrain-block': skinAssets.terrainBlock ?? skinAssets.ground,
			wood: skinAssets.wood,
			bomb: skinAssets.bomb,
			boulder: skinAssets.boulder,
			crate: skinAssets.crate,
			acid: skinAssets.acid,
			ice: skinAssets.ice,
			stone: skinAssets.stone,
			'rolling-boulder': skinAssets.rollingBoulder,
			wall: skinAssets.brick,
			'no-draw-zone': skinAssets.noDrawZone,
			'no-draw-ground': skinAssets.noDrawGround,
			'no-draw-tree': skinAssets.noDrawTree,
			'no-draw-rock': skinAssets.noDrawRock
		};
		return assets[kind] ?? skinAssets.platform;
	}

	function defaultSize(kind: ObstacleType): { width: number; height: number } {
		if (kind === 'ground') return { width: 390, height: 20 };
		if (kind === 'platform' || kind === 'wood') return { width: 96, height: 18 };
		if (kind === 'wall') return { width: 40, height: 120 };
		if (kind === 'brick') return { width: 40, height: 40 };
		if (kind === 'terrain-block') return { width: 60, height: 60 };
		if (kind === 'stone') return { width: 40, height: 120 };
		if (kind === 'crate') return { width: 52, height: 52 };
		if (kind === 'water' || kind === 'lava' || kind === 'acid') return { width: 110, height: 36 };
		if (kind === 'spike') return { width: 80, height: 24 };
		if (kind === 'bomb') return { width: 40, height: 40 };
		if (kind === 'boulder' || kind === 'rolling-boulder') return { width: 56, height: 56 };
		if (kind === 'no-draw-zone') return { width: 80, height: 80 };
		if (kind === 'no-draw-ground') return { width: 100, height: 60 };
		if (kind === 'no-draw-tree') return { width: 60, height: 100 };
		if (kind === 'no-draw-rock') return { width: 70, height: 70 };
		return { width: 48, height: 48 };
	}

	function clamp(value: number, minimum: number, maximum: number): number {
		return Math.min(maximum, Math.max(minimum, value));
	}
</script>

<section class="editor-screen" data-skin={skin}>
	<header class="editor-header">
		<Button variant="secondary" size="icon-sm" aria-label="내 지도로 돌아가기" onclick={onBack}><ArrowLeft class="size-4" /></Button>
		<div class="editor-heading"><span>MAP WORKBENCH</span><strong>지도 만들기</strong></div>
		<div class="editor-header-actions">
			<Button variant="secondary" size="icon-sm" aria-label="지도 공유" title="공유" onclick={openShare}><Share2 class="size-4" /></Button>
			<Button size="icon-sm" aria-label="지도 저장" title="저장" disabled={isSaving} onclick={saveMap}><Save class="size-4" /></Button>
		</div>
	</header>

	<div class="editor-title-row">
		<input aria-label="지도 이름" bind:value={map.title} maxlength="40" placeholder="지도 이름" />
		<Button class="test-button h-9 px-3 text-xs font-black" disabled={isTesting} aria-busy={isTesting} onclick={testMap}><Play class="size-3.5" /> 시험</Button>
	</div>
	{#if error}<p class="editor-feedback editor-error" role="alert"><CircleAlert class="size-4" /> {error}</p>{/if}
	{#if status}<p class="editor-feedback editor-status" aria-live="polite">{status}</p>{/if}

	<div class="tool-strip" aria-label="오브젝트 팔레트">
		{#each TOOL_ITEMS as item (item.kind)}
			<button type="button" class:tool-active={selectedTool === item.kind} aria-pressed={selectedTool === item.kind} onclick={() => (selectedTool = item.kind)}>{item.label}</button>
		{/each}
	</div>

	<div
		bind:this={board}
		class="map-board"
		style={`background-image: url('${backgroundSrc}')`}
		role="application"
		aria-label="사용자 지도 편집 캔버스"
		onpointerdown={handleBoardPointerDown}
		onpointermove={handleBoardPointerMove}
		onpointerup={handleBoardPointerEnd}
		onpointercancel={handleBoardPointerEnd}
	>
		<div class="board-grid"></div>
		{#each map.objects as object (object.id)}
			{@const size = displaySize(object)}
			{#if object.kind === 'no-draw-ground'}
				<div
					class:selected={object.id === selectedObjectId}
					class="placed-object"
					data-kind={object.kind}
					role="img"
					aria-label={OBJECT_LABELS[object.kind]}
					style={`left:${(object.x / WORLD_WIDTH) * 100}%; top:${(object.y / WORLD_HEIGHT) * 100}%; width:${(size.width / WORLD_WIDTH) * 100}%; height:${(size.height / WORLD_HEIGHT) * 100}%; transform:translate(-50%, -50%) rotate(${object.angle ?? 0}rad);`}
				></div>
			{:else}
				<img
					class:selected={object.id === selectedObjectId}
					class="placed-object"
					data-kind={object.kind}
					src={objectAsset(object.kind)}
					alt=""
					aria-hidden="true"
					style={`left:${(object.x / WORLD_WIDTH) * 100}%; top:${(object.y / WORLD_HEIGHT) * 100}%; width:${(size.width / WORLD_WIDTH) * 100}%; height:${(size.height / WORLD_HEIGHT) * 100}%; transform:translate(-50%, -50%) rotate(${object.angle ?? 0}rad);`}
				/>
			{/if}
		{/each}
		{#if selectedObject && selectedObject.kind !== 'dog' && selectedObject.kind !== 'hive'}
			<div
				class="selection-toolbar"
				role="toolbar"
				tabindex="0"
				aria-label={`${OBJECT_LABELS[selectedObject.kind]} 빠른 편집`}
				style={selectionToolbarStyle(selectedObject)}
				onpointerdown={(event) => event.stopPropagation()}
			>
				<span>{OBJECT_LABELS[selectedObject.kind]}</span>
				<Button variant="secondary" size="icon-sm" aria-label="선택한 오브젝트 왼쪽 회전" title="왼쪽으로 15도" onclick={() => rotateSelected(-ROTATION_STEP)}><RotateCcw class="size-3.5" /></Button>
				<Button variant="secondary" size="icon-sm" aria-label="선택한 오브젝트 오른쪽 회전" title="오른쪽으로 15도" onclick={() => rotateSelected(ROTATION_STEP)}><RotateCw class="size-3.5" /></Button>
				<Button variant="destructive" size="icon-sm" aria-label="선택한 오브젝트 삭제" title="삭제" onclick={deleteSelectedObject}><Eraser class="size-3.5" /></Button>
			</div>
		{/if}
		<div class="board-caption">{selectedTool === 'select' ? '오브젝트를 드래그하세요. 선택하면 회전·삭제 도구가 보여요.' : STICKY_GRID_TOOLS.has(selectedTool) ? `${TOOL_ITEMS.find((item) => item.kind === selectedTool)?.label} 브러시: 20px 격자에 계속 배치합니다.` : `${TOOL_ITEMS.find((item) => item.kind === selectedTool)?.label}을 배치할 위치를 누르세요.`}</div>
	</div>

	<section class="settings-strip" aria-label="지도 규칙 설정">
		<label>배경
			<select bind:value={map.environment}>
				<option value="meadow">초원</option><option value="volcanic">화산</option><option value="forest">숲</option>
			</select>
		</label>
		<label>난이도
			<select bind:value={map.difficulty.profile}>{#each DIFFICULTIES as difficulty}<option value={difficulty.id}>{difficulty.label}</option>{/each}</select>
		</label>
		<label>잉크<input type="number" min="120" max="1200" value={map.difficulty.inkLimit} oninput={(event) => setNumber('inkLimit', event)} /></label>
		<label>생존(초)<input type="number" min="3" max="30" value={map.difficulty.survivalMs / 1000} oninput={(event) => setNumber('survivalSeconds', event)} /></label>
	</section>

	<section class="hint-strip" aria-label="힌트 설정">
		<input aria-label="공략 제목" bind:value={map.hint.objectiveLabel} maxlength="30" placeholder="공략 제목" />
		<input aria-label="공략 힌트" bind:value={map.hint.objectiveHint} maxlength="100" placeholder="공략 힌트" />
	</section>

	{#if selectedObject}
		<section class="object-inspector" aria-label="선택한 오브젝트 설정">
			<div class="inspector-heading">
				<span>{OBJECT_LABELS[selectedObject.kind]}</span>
				<div class="inspector-actions">
					{#if selectedObject.kind !== 'dog' && selectedObject.kind !== 'hive'}
						<Button variant="ghost" size="icon-sm" aria-label="왼쪽으로 15도 회전" title="왼쪽으로 15도" onclick={() => rotateSelected(-ROTATION_STEP)}><RotateCcw class="size-4" /></Button>
						<Button variant="ghost" size="icon-sm" aria-label="오른쪽으로 15도 회전" title="오른쪽으로 15도" onclick={() => rotateSelected(ROTATION_STEP)}><RotateCw class="size-4" /></Button>
					{/if}
					<Button variant="ghost" size="icon-sm" aria-label="선택한 오브젝트 삭제" title="삭제" onclick={deleteSelectedObject}><Eraser class="size-4" /></Button>
				</div>
			</div>
			<div class="inspector-fields">
				<label>X<input type="number" min="0" max="390" value={selectedObject.x} oninput={(event) => setObjectNumber('x', event)} /></label>
				<label>Y<input type="number" min="0" max="693" value={selectedObject.y} oninput={(event) => setObjectNumber('y', event)} /></label>
				{#if selectedObject.kind === 'hive'}
					<label>벌 수<input type="number" min="1" max="30" value={selectedObject.beeCount} oninput={(event) => setObjectNumber('beeCount', event)} /></label>
					<label>간격(ms)<input type="number" min="120" max="2000" value={selectedObject.spawnIntervalMs} oninput={(event) => setObjectNumber('spawnIntervalMs', event)} /></label>
					<label>공격
						<select value={selectedObject.attackStyle ?? 'direct'} onchange={(event) => updateObject(selectedObject.id, { attackStyle: (event.currentTarget as HTMLSelectElement).value as BeeAttackStyle })}>
							<option value="direct">직선</option><option value="flank-left">좌측</option><option value="flank-right">우측</option><option value="breaker">압박</option>
						</select>
					</label>
				{:else if selectedObject.kind !== 'dog'}
					<label>너비<input type="number" min="8" max="390" value={selectedObject.width} oninput={(event) => setObjectNumber('width', event)} /></label>
					<label>높이<input type="number" min="8" max="693" value={selectedObject.height} oninput={(event) => setObjectNumber('height', event)} /></label>
					<label>각도(도)<input type="number" step="1" min="-180" max="180" value={angleInDegrees(selectedObject.angle)} oninput={setObjectAngle} /></label>
				{/if}
			</div>
		</section>
	{/if}

</section>

{#if showShare}
	<MapShareDialog document={map} onClose={() => (showShare = false)} />
{/if}

<style>
	.editor-screen { min-height: 100%; overflow-y: auto; background: #eaf6ff; color: #13273e; padding: max(0.7rem, env(safe-area-inset-top)) 0.75rem max(1rem, env(safe-area-inset-bottom)); }
	.editor-screen[data-skin='minecraft'] { background: #e9f6d0; } .editor-screen[data-skin='lego'] { background: #edf6ff; }
	.editor-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; }
	.editor-heading { display: grid; line-height: 1.05; } .editor-heading span { font-size: 0.58rem; font-weight: 950; letter-spacing: 0.08em; color: #6683a0; } .editor-heading strong { font-size: 1.05rem; font-weight: 950; } .editor-header-actions { display: flex; gap: 0.3rem; }
	.editor-title-row { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; margin-top: 0.7rem; } .editor-title-row input { min-width: 0; border: 1px solid #b7ccdf; border-radius: 4px; background: #fff; padding: 0 0.65rem; font-size: 0.88rem; font-weight: 900; }
	.tool-strip { display: flex; gap: 0.35rem; overflow-x: auto; margin: 0.7rem -0.75rem; padding: 0 0.75rem 0.25rem; } .tool-strip button { flex: 0 0 auto; border: 1px solid #b7cbdd; border-radius: 4px; background: #f9fcff; padding: 0.42rem 0.58rem; font-size: 0.7rem; font-weight: 900; color: #2b4863; } .tool-strip button.tool-active { border-color: #1566b7; background: #1566b7; color: #fff; }
	.map-board { position: relative; width: min(100%, 22rem); aspect-ratio: 390 / 693; margin: 0 auto; overflow: hidden; border: 3px solid #173b60; border-radius: 6px; background-color: #c7edff; background-size: cover; background-position: center; box-shadow: 0 8px 20px rgba(30, 68, 103, 0.24); touch-action: none; }
	.board-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(12,50,76,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(12,50,76,.13) 1px, transparent 1px); background-size: 5.128% 2.886%; pointer-events: none; }
	.placed-object { position: absolute; z-index: 2; object-fit: fill; pointer-events: none; filter: drop-shadow(0 1px 1px rgba(6, 28, 47, .35)); } .placed-object.selected { z-index: 3; outline: 2px dashed #fff; outline-offset: 2px; filter: drop-shadow(0 0 3px #126eda); }
		.placed-object[data-kind='no-draw-ground'] { background: linear-gradient(to bottom, rgba(74, 124, 44, 0.78) 0 28%, rgba(139, 90, 43, 0.72) 28%); border: 2px solid rgba(101, 67, 33, 0.7); border-radius: 4px 4px 0 0; }
	.selection-toolbar { position: absolute; z-index: 6; display: flex; align-items: center; gap: 0.18rem; transform: translate(-50%, -50%); border: 1px solid rgba(23, 59, 96, 0.28); border-radius: 6px; background: rgba(255, 255, 255, 0.96); padding: 0.2rem; box-shadow: 0 4px 12px rgba(13, 44, 72, 0.28); pointer-events: auto; }
	.selection-toolbar span { max-width: 5.2rem; overflow: hidden; color: #173b60; font-size: 0.58rem; font-weight: 950; text-overflow: ellipsis; white-space: nowrap; }
	.board-caption { position: absolute; right: 0.35rem; bottom: 0.35rem; left: 0.35rem; z-index: 4; border-radius: 3px; background: rgba(9,31,51,.72); padding: 0.28rem 0.4rem; color: #fff; font-size: 0.61rem; font-weight: 800; text-align: center; pointer-events: none; }
	.settings-strip, .hint-strip, .object-inspector { display: grid; gap: 0.45rem; border-top: 1px solid rgba(58, 99, 133, .28); margin-top: 0.8rem; padding-top: 0.7rem; } .settings-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .settings-strip label, .inspector-fields label { display: grid; gap: 0.2rem; font-size: 0.65rem; font-weight: 900; color: #496783; } .settings-strip input, .settings-strip select, .hint-strip input, .inspector-fields input, .inspector-fields select { min-width: 0; height: 2rem; border: 1px solid #b7ccdf; border-radius: 4px; background: #fff; padding: 0 0.4rem; color: #1c3853; font-size: 0.72rem; font-weight: 700; }
		.hint-strip { grid-template-columns: 1fr; } .object-inspector { padding-bottom: 0.3rem; } .inspector-heading { display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 950; } .inspector-actions { display: flex; align-items: center; gap: 0.15rem; } .inspector-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
	.editor-feedback { display: flex; align-items: center; gap: 0.35rem; margin: 0.45rem 0 0; font-size: 0.72rem; font-weight: 850; } .editor-error { color: #b3372d; } .editor-status { color: #167044; }
</style>
