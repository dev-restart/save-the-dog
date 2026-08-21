<script lang="ts">
	import {
		ArrowLeft,
		CircleAlert,
		Eraser,
		Play,
		RotateCcw,
		RotateCw,
		Save,
		Share2,
		SlidersHorizontal,
		X
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { isMapTerrainTopExposed, isPointInsideMapObject, isTerrainPrefabTool, terrainPrefabIdFromTool, toolAfterPlacement, type MapEditorTool } from '$lib/game/map-editor-tools.js';
	import { EDITOR_OBSTACLE_TOOL_ITEMS, getObstacleSpec } from '$lib/game/obstacle-registry.js';
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
	import StageThumbnail from './StageThumbnail.svelte';

	interface Props {
		document: StageMapDocument;
		mapId?: string;
		skin: SkinId;
		onBack: () => void;
		onSave: (document: StageMapDocument, id?: string) => Promise<CustomMapRecord>;
		onTest: (document: StageMapDocument) => void;
	}

	let { document, mapId, skin, onBack, onSave, onTest }: Props = $props();

	const WORLD_WIDTH = 390;
	const WORLD_HEIGHT = 693;
	const GRID_SIZE = 20;
	const STATIC_TOOL_ITEMS: Array<{ kind: MapEditorTool; label: string }> = [
		{ kind: 'select', label: '선택' },
		{ kind: 'dog', label: '강아지' },
		{ kind: 'hive', label: '벌집' }
	];
	const PREFAB_TOOL_ITEMS: Array<{ kind: MapEditorTool; label: string }> = [
		{ kind: 'prefab:u-shelter', label: 'ㄷ자 안전실' },
		{ kind: 'prefab:cave-pocket', label: '동굴 포켓' },
		{ kind: 'prefab:slope-left', label: '왼쪽 경사' },
		{ kind: 'prefab:slope-right', label: '오른쪽 경사' },
		{ kind: 'prefab:bomb-niche', label: '폭탄 홈' },
		{ kind: 'prefab:cliff-pocket-left', label: '왼쪽 절벽굴' },
		{ kind: 'prefab:cliff-pocket-right', label: '오른쪽 절벽굴' },
		{ kind: 'prefab:arch-shelter', label: '돌 아치' },
		{ kind: 'prefab:split-pillars', label: '엇갈린 기둥' },
		{ kind: 'prefab:stepped-basin', label: '계단 분지' }
	];
	const terrainBlockToolIndex = EDITOR_OBSTACLE_TOOL_ITEMS.findIndex((item) => item.kind === 'terrain-block');
	const TOOL_ITEMS: Array<{ kind: MapEditorTool; label: string }> = [
		...STATIC_TOOL_ITEMS,
		...EDITOR_OBSTACLE_TOOL_ITEMS.slice(0, terrainBlockToolIndex + 1),
		...PREFAB_TOOL_ITEMS,
		...EDITOR_OBSTACLE_TOOL_ITEMS.slice(terrainBlockToolIndex + 1)
	];
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
	let selectedTool = $state<MapEditorTool>('select');
	let selectedObjectId = $state<string | null>(null);
	let drag = $state<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
	let error = $state('');
	let status = $state('');
	let showShare = $state(false);
	let showSettings = $state(false);
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
			selectedTool = toolAfterPlacement(selectedTool);
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
			return isPointInsideMapObject(point, object, width, height);
		});
	}

	function createObject(kind: Exclude<MapEditorTool, 'select'>, point: { x: number; y: number }): StageMapObject {
		const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		if (isTerrainPrefabTool(kind)) {
			const prefabId = terrainPrefabIdFromTool(kind)!;
			const size = prefabDefaultSize(prefabId);
			return { id, kind: prefabId === 'bomb-niche' ? 'stone' : 'terrain-block', prefabId, x: point.x, y: point.y, width: size.width, height: size.height };
		}
		if (kind === 'dog') return { id, kind, x: point.x, y: point.y };
		if (kind === 'hive') {
			return { id, kind, x: point.x, y: point.y, beeCount: 10, spawnIntervalMs: 280, beeForce: 0.002, attackStyle: 'direct' };
		}
		const size = defaultSize(kind);
		return { id, kind, x: point.x, y: point.y, width: size.width, height: size.height };
	}

	function prefabDefaultSize(prefabId: NonNullable<StageMapObject['prefabId']>): { width: number; height: number } {
		if (prefabId === 'cave-pocket') return { width: 240, height: 300 };
		if (prefabId === 'u-shelter') return { width: 200, height: 180 };
		if (prefabId === 'bomb-niche') return { width: 130, height: 120 };
		if (prefabId === 'cliff-pocket-left' || prefabId === 'cliff-pocket-right') return { width: 260, height: 300 };
		if (prefabId === 'arch-shelter') return { width: 260, height: 220 };
		if (prefabId === 'split-pillars') return { width: 240, height: 240 };
		if (prefabId === 'stepped-basin') return { width: 240, height: 180 };
		return { width: 180, height: 110 };
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
			'no-draw-ground': skinAssets.terrainBlock ?? skinAssets.ground,
			'no-draw-tree': skinAssets.noDrawTree,
			'no-draw-rock': skinAssets.noDrawRock
		};
		return assets[kind] ?? skinAssets.platform;
	}

	function usesBackgroundPreview(kind: StageMapObjectKind): boolean {
		if (kind === 'dog' || kind === 'hive') return false;
		return getObstacleSpec(kind).editor.preview !== 'image';
	}

	function previewClass(kind: StageMapObjectKind): string {
		if (kind === 'dog' || kind === 'hive') return 'horizontal-preview';
		return `${getObstacleSpec(kind).editor.preview}-preview`;
	}

	function defaultSize(kind: ObstacleType): { width: number; height: number } {
		return getObstacleSpec(kind).defaultSize;
	}

	function objectLabel(kind: StageMapObjectKind): string {
		if (kind === 'dog') return '강아지';
		if (kind === 'hive') return '벌집';
		return getObstacleSpec(kind).label;
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
		<Button variant="secondary" class="settings-button h-9 px-3 text-xs font-black" onclick={() => (showSettings = true)}><SlidersHorizontal class="size-3.5" /> 설정</Button>
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
			{#if object.prefabId}
				<div
						class:selected={object.id === selectedObjectId}
						class="placed-object prefab-preview"
						data-kind={object.kind}
						role="img"
						aria-label={objectLabel(object.kind)}
						style={`left:${(object.x / WORLD_WIDTH) * 100}%; top:${(object.y / WORLD_HEIGHT) * 100}%; width:${(size.width / WORLD_WIDTH) * 100}%; height:${(size.height / WORLD_HEIGHT) * 100}%; transform:translate(-50%, -50%) rotate(${object.angle ?? 0}rad);`}
					>
					<StageThumbnail stage={{ id: 0, dog: { x: -200, y: -200 }, hives: [], obstacles: [{ type: object.kind as ObstacleType, x: 195, y: 346.5, width: 390, height: 693, prefabId: object.prefabId }], inkLimit: 1, survivalMs: 1 }} {skin} />
				</div>
			{:else if usesBackgroundPreview(object.kind)}
				<div
					class:selected={object.id === selectedObjectId}
					class:no-terrain-cap={!isMapTerrainTopExposed(object, map.objects)}
						class={`placed-object asset-preview ${previewClass(object.kind)}`}
						data-kind={object.kind}
						data-prefab={object.prefabId}
						role="img"
						aria-label={objectLabel(object.kind)}
						style={`--asset-url:url('${object.kind === 'terrain-block' || object.kind === 'no-draw-zone' || object.kind === 'no-draw-ground' ? (skinAssets.terrainDirt ?? objectAsset(object.kind)) : objectAsset(object.kind)}'); --cap-url:url('${skinAssets.terrainGrassCap ?? objectAsset(object.kind)}'); left:${(object.x / WORLD_WIDTH) * 100}%; top:${(object.y / WORLD_HEIGHT) * 100}%; width:${(size.width / WORLD_WIDTH) * 100}%; height:${(size.height / WORLD_HEIGHT) * 100}%; transform:translate(-50%, -50%) rotate(${object.angle ?? 0}rad);`}
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
					aria-label={`${objectLabel(selectedObject.kind)} 빠른 편집`}
					style={selectionToolbarStyle(selectedObject)}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<span>{objectLabel(selectedObject.kind)}</span>
				<Button variant="secondary" size="icon-sm" aria-label="선택한 오브젝트 왼쪽 회전" title="왼쪽으로 15도" onclick={() => rotateSelected(-ROTATION_STEP)}><RotateCcw class="size-3.5" /></Button>
				<Button variant="secondary" size="icon-sm" aria-label="선택한 오브젝트 오른쪽 회전" title="오른쪽으로 15도" onclick={() => rotateSelected(ROTATION_STEP)}><RotateCw class="size-3.5" /></Button>
				<Button variant="destructive" size="icon-sm" aria-label="선택한 오브젝트 삭제" title="삭제" onclick={deleteSelectedObject}><Eraser class="size-3.5" /></Button>
			</div>
		{/if}
		<div class="board-caption">{selectedTool === 'select' ? '오브젝트를 드래그하세요. 선택하면 회전·삭제 도구가 보여요.' : `${TOOL_ITEMS.find((item) => item.kind === selectedTool)?.label}을 배치할 위치를 누르세요.`}</div>
	</div>


</section>

{#if showSettings}
	<div class="settings-modal-backdrop">
		<button class="settings-modal-dismiss" type="button" tabindex="-1" aria-label="지도 설정 닫기" onclick={() => (showSettings = false)}></button>
		<dialog class="settings-modal" open aria-modal="true" aria-labelledby="map-settings-title">
			<header class="settings-modal-header">
				<div><span>MAP SETTINGS</span><h2 id="map-settings-title">지도 설정</h2></div>
				<Button variant="ghost" size="icon-sm" aria-label="지도 설정 닫기" onclick={() => (showSettings = false)}><X class="size-4" /></Button>
			</header>
			<section class="settings-strip" aria-label="지도 규칙 설정">
				<label>배경<select bind:value={map.environment}><option value="meadow">초원</option><option value="volcanic">화산</option><option value="forest">숲</option></select></label>
				<label>난이도<select bind:value={map.difficulty.profile}>{#each DIFFICULTIES as difficulty}<option value={difficulty.id}>{difficulty.label}</option>{/each}</select></label>
				<label>잉크<input type="number" min="120" max="1200" value={map.difficulty.inkLimit} oninput={(event) => setNumber('inkLimit', event)} /></label>
				<label>생존 시간(초)<input type="number" min="3" max="30" value={map.difficulty.survivalMs / 1000} oninput={(event) => setNumber('survivalSeconds', event)} /></label>
			</section>
			<section class="hint-strip" aria-label="힌트 설정">
				<div class="settings-section-title">공략 안내</div>
				<input aria-label="공략 제목" bind:value={map.hint.objectiveLabel} maxlength="30" placeholder="공략 제목" />
				<input aria-label="공략 힌트" bind:value={map.hint.objectiveHint} maxlength="100" placeholder="공략 힌트" />
			</section>
			{#if selectedObject}
				<section class="object-inspector" aria-label="선택한 오브젝트 설정">
				<div class="inspector-heading">
					<span>선택한 오브젝트 · {objectLabel(selectedObject.kind)}</span>
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
			<Button class="h-10 w-full font-black" onclick={() => (showSettings = false)}>적용</Button>
		</dialog>
	</div>
{/if}

{#if showShare}
	<MapShareDialog document={map} onClose={() => (showShare = false)} />
{/if}

<style>
	.editor-screen { min-height: 100%; overflow-y: auto; background: #eaf6ff; color: #13273e; padding: max(0.7rem, env(safe-area-inset-top)) 0.75rem max(1rem, env(safe-area-inset-bottom)); }
	.editor-screen[data-skin='minecraft'] { background: #e9f6d0; } .editor-screen[data-skin='lego'] { background: #edf6ff; }
	.editor-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; }
	.editor-heading { display: grid; line-height: 1.05; } .editor-heading span { font-size: 0.58rem; font-weight: 950; letter-spacing: 0.08em; color: #6683a0; } .editor-heading strong { font-size: 1.05rem; font-weight: 950; } .editor-header-actions { display: flex; gap: 0.3rem; }
	.editor-title-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0.4rem; margin-top: 0.7rem; } .editor-title-row input { min-width: 0; border: 1px solid #b7ccdf; border-radius: 4px; background: #fff; padding: 0 0.65rem; font-size: 0.88rem; font-weight: 900; }
	.tool-strip { display: flex; gap: 0.35rem; overflow-x: auto; margin: 0.7rem -0.75rem; padding: 0 0.75rem 0.25rem; } .tool-strip button { flex: 0 0 auto; border: 1px solid #b7cbdd; border-radius: 4px; background: #f9fcff; padding: 0.42rem 0.58rem; font-size: 0.7rem; font-weight: 900; color: #2b4863; } .tool-strip button.tool-active { border-color: #1566b7; background: #1566b7; color: #fff; }
	.map-board { position: relative; width: min(100%, 22rem); aspect-ratio: 390 / 693; margin: 0 auto; overflow: hidden; border: 3px solid #173b60; border-radius: 6px; background-color: #c7edff; background-size: cover; background-position: center; box-shadow: 0 8px 20px rgba(30, 68, 103, 0.24); touch-action: none; }
	.board-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(12,50,76,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(12,50,76,.13) 1px, transparent 1px); background-size: 5.128% 2.886%; pointer-events: none; }
	.placed-object { position: absolute; z-index: 2; object-fit: fill; pointer-events: none; filter: drop-shadow(0 1px 1px rgba(6, 28, 47, .35)); } .placed-object.selected { z-index: 3; outline: 2px dashed #fff; outline-offset: 2px; filter: drop-shadow(0 0 3px #126eda); }
	.asset-preview { background-image: var(--asset-url); background-position: top left; }
	.horizontal-preview { background-repeat: repeat-x; background-size: auto 100%; }
	.vertical-preview { background-repeat: no-repeat; background-size: 100% 100%; }
	.brick-preview { border: 1px solid rgba(91,49,21,.5); background-image: var(--asset-url); background-repeat: repeat; background-size: 48px 48px; }
	.prefab-preview { overflow: hidden; filter: drop-shadow(0 1px 1px rgba(6, 28, 47, .35)); }
	.prefab-preview :global(.stage-thumbnail) { width: 100%; height: 100%; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
	.prefab-preview :global(.thumbnail-background), .prefab-preview :global(.thumbnail-ground), .prefab-preview :global(.thumbnail-dog), .prefab-preview :global(.thumbnail-hive) { display: none; }
	.terrain-preview { overflow: hidden; border: 1px solid rgba(91,49,21,.5); background-image: var(--asset-url); background-repeat: repeat; background-size: 72px 72px; }
	.terrain-preview::before { position: absolute; inset: -1px 0 auto; height: min(14px, 24%); background-image: var(--cap-url); background-position: center; background-repeat: repeat-x; background-size: auto 100%; content: ''; }
	.terrain-preview.no-terrain-cap::before { display: none; }
	.editor-screen[data-skin='minecraft'] .placed-object[data-kind='no-draw-tree'],
	.editor-screen[data-skin='minecraft'] .placed-object[data-kind='no-draw-rock'],
	.editor-screen[data-skin='lego'] .placed-object[data-kind='no-draw-tree'],
	.editor-screen[data-skin='lego'] .placed-object[data-kind='no-draw-rock'],
	.editor-screen[data-skin='minecraft'] .placed-object[data-kind='rolling-boulder'],
	.editor-screen[data-skin='lego'] .placed-object[data-kind='rolling-boulder'] { mix-blend-mode: multiply; }
	.selection-toolbar { position: absolute; z-index: 6; display: flex; align-items: center; gap: 0.18rem; transform: translate(-50%, -50%); border: 1px solid rgba(23, 59, 96, 0.28); border-radius: 6px; background: rgba(255, 255, 255, 0.96); padding: 0.2rem; box-shadow: 0 4px 12px rgba(13, 44, 72, 0.28); pointer-events: auto; }
	.selection-toolbar span { max-width: 5.2rem; overflow: hidden; color: #173b60; font-size: 0.58rem; font-weight: 950; text-overflow: ellipsis; white-space: nowrap; }
	.board-caption { position: absolute; right: 0.35rem; bottom: 0.35rem; left: 0.35rem; z-index: 4; border-radius: 3px; background: rgba(9,31,51,.72); padding: 0.28rem 0.4rem; color: #fff; font-size: 0.61rem; font-weight: 800; text-align: center; pointer-events: none; }
	.settings-modal-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; background: rgba(8, 19, 34, .68); backdrop-filter: blur(6px); }
	.settings-modal-dismiss { position: absolute; inset: 0; border: 0; background: transparent; }
	.settings-modal { position: relative; z-index: 1; width: min(100%, 24rem); max-height: min(86dvh, 46rem); overflow-y: auto; border: 1px solid rgba(255,255,255,.78); border-radius: 10px; background: #f7fbff; padding: 1rem; color: #13273e; box-shadow: 0 22px 60px rgba(4,17,32,.38); }
	.settings-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; } .settings-modal-header span { color: #6683a0; font-size: .58rem; font-weight: 950; letter-spacing: .08em; } .settings-modal-header h2 { margin: .1rem 0 0; font-size: 1.1rem; font-weight: 950; }
	.settings-strip, .hint-strip, .object-inspector { display: grid; gap: 0.45rem; border-top: 1px solid rgba(58, 99, 133, .28); margin-top: 0.8rem; padding-top: 0.7rem; } .settings-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .settings-strip label, .inspector-fields label { display: grid; gap: 0.2rem; font-size: 0.65rem; font-weight: 900; color: #496783; } .settings-strip input, .settings-strip select, .hint-strip input, .inspector-fields input, .inspector-fields select { min-width: 0; height: 2rem; border: 1px solid #b7ccdf; border-radius: 4px; background: #fff; padding: 0 0.4rem; color: #1c3853; font-size: 0.72rem; font-weight: 700; }
	.settings-section-title { color: #496783; font-size: .7rem; font-weight: 950; }
		.hint-strip { grid-template-columns: 1fr; } .object-inspector { padding-bottom: 0.3rem; } .inspector-heading { display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 950; } .inspector-actions { display: flex; align-items: center; gap: 0.15rem; } .inspector-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
	.editor-feedback { display: flex; align-items: center; gap: 0.35rem; margin: 0.45rem 0 0; font-size: 0.72rem; font-weight: 850; } .editor-error { color: #b3372d; } .editor-status { color: #167044; }
</style>
