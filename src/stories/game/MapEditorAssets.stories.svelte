<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapEditor from '$lib/components/game/MapEditor.svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import { createEmptyStageMapDocument, createStageDataFromMapDocument, createStageMapDocument } from '$lib/game/stages/stage-map-schema.js';
	import { getStage } from '$lib/game/stages/index.js';
	import type { StageMapDocument } from '$lib/game/stages/stage-map-schema.js';

	const { Story } = defineMeta({ title: 'Game/Map Editor Assets', tags: ['autodocs'] });
	const document = createStageMapDocument(getStage(20));
	const allAssetsDocument = {
		...createEmptyStageMapDocument(),
		title: '전체 에셋 QA 지도',
		objects: [
			{ id: 'dog', kind: 'dog' as const, x: 195, y: 590 },
			{ id: 'hive', kind: 'hive' as const, x: 195, y: 70, beeCount: 8, spawnIntervalMs: 320, beeForce: 0.0018, attackStyle: 'direct' as const },
			{ id: 'terrain', kind: 'terrain-block' as const, x: 48, y: 145, width: 64, height: 64 },
			{ id: 'brick', kind: 'brick' as const, x: 125, y: 145, width: 64, height: 64 },
			{ id: 'wood', kind: 'wood' as const, x: 220, y: 140, width: 90, height: 18, angle: -0.12 },
			{ id: 'stone', kind: 'stone' as const, x: 330, y: 160, width: 44, height: 120 },
			{ id: 'water', kind: 'water' as const, x: 66, y: 245, width: 110, height: 36 },
			{ id: 'lava', kind: 'lava' as const, x: 195, y: 245, width: 110, height: 36 },
			{ id: 'acid', kind: 'acid' as const, x: 324, y: 245, width: 110, height: 36 },
			{ id: 'spike', kind: 'spike' as const, x: 58, y: 315, width: 84, height: 24 },
			{ id: 'ice', kind: 'ice' as const, x: 145, y: 315, width: 52, height: 52 },
			{ id: 'bomb', kind: 'bomb' as const, x: 225, y: 315, width: 42, height: 42 },
			{ id: 'boulder', kind: 'boulder' as const, x: 295, y: 315, width: 56, height: 56 },
			{ id: 'rolling', kind: 'rolling-boulder' as const, x: 360, y: 315, width: 56, height: 56 },
			{ id: 'crate', kind: 'crate' as const, x: 55, y: 410, width: 54, height: 54 },
			{ id: 'platform', kind: 'platform' as const, x: 145, y: 410, width: 100, height: 18 },
			{ id: 'zone', kind: 'no-draw-zone' as const, x: 245, y: 410, width: 72, height: 72 },
			{ id: 'wall', kind: 'wall' as const, x: 345, y: 420, width: 42, height: 120 },
			{ id: 'tree', kind: 'no-draw-tree' as const, x: 95, y: 525, width: 64, height: 100 },
			{ id: 'rock', kind: 'no-draw-rock' as const, x: 195, y: 525, width: 72, height: 72 },
			{ id: 'no-ground', kind: 'no-draw-ground' as const, x: 300, y: 525, width: 110, height: 60 },
			{ id: 'ground', kind: 'ground' as const, x: 195, y: 660, width: 390, height: 20 }
		]
	};
	const prefabDocument = {
		...createEmptyStageMapDocument(),
		title: 'Prefab 지형 QA 지도',
		objects: [
			{ id: 'dog', kind: 'dog' as const, x: 195, y: 590 },
			{ id: 'hive', kind: 'hive' as const, x: 195, y: 70, beeCount: 8, spawnIntervalMs: 320, beeForce: 0.0018, attackStyle: 'direct' as const },
			{ id: 'shelter', kind: 'terrain-block' as const, prefabId: 'u-shelter' as const, x: 105, y: 220, width: 170, height: 150 },
			{ id: 'cave', kind: 'terrain-block' as const, prefabId: 'cave-pocket' as const, x: 285, y: 220, width: 170, height: 190 },
			{ id: 'slope-left', kind: 'terrain-block' as const, prefabId: 'slope-left' as const, x: 100, y: 430, width: 160, height: 100 },
			{ id: 'slope-right', kind: 'terrain-block' as const, prefabId: 'slope-right' as const, x: 290, y: 430, width: 160, height: 100 },
			{ id: 'niche', kind: 'stone' as const, prefabId: 'bomb-niche' as const, x: 195, y: 555, width: 130, height: 110 },
			{ id: 'bomb', kind: 'bomb' as const, x: 195, y: 580, width: 40, height: 40 },
			{ id: 'ground', kind: 'ground' as const, x: 195, y: 660, width: 390, height: 20 }
		]
	};
	const skins = ['classic', 'minecraft', 'lego'] as const;
	const allAssetsStage = createStageDataFromMapDocument(allAssetsDocument);
	const noop = () => undefined;
	const save = async (next: StageMapDocument) => ({
		id: 'asset-qa',
		title: next.title,
		document: next,
		createdAt: 0,
		updatedAt: 0
	});
</script>

<Story name="Three Skin Comparison">
	<div class="comparison">
		{#each skins as skin}
			<MapEditor {document} onSave={save} onBack={noop} onTest={noop} {skin} />
		{/each}
	</div>
</Story>

<Story name="All Placeable Objects">
	<div class="comparison">
		{#each skins as skin}
			<MapEditor document={allAssetsDocument} onSave={save} onBack={noop} onTest={noop} {skin} />
		{/each}
	</div>
</Story>

<Story name="Game Renderer Comparison">
	<div class="game-comparison">
		{#each skins as skin}
			<div class="game-frame">
				<GameCanvas stage={allAssetsStage} resetKey={0} {skin} simulationSpeed={1} onPhaseChange={noop} onInkChange={noop} onTimerChange={noop} onCleared={noop} onFailed={noop} onDogAttacked={noop} onDrawingAttacked={noop} onBeeActivityChange={noop} />
			</div>
		{/each}
	</div>
</Story>

<Story name="Terrain Prefabs">
	<MapEditor document={prefabDocument} onSave={save} onBack={noop} onTest={noop} skin="classic" />
</Story>

<style>
	.comparison { display: grid; grid-template-columns: repeat(3, minmax(340px, 1fr)); gap: 16px; min-width: 1080px; padding: 16px; background: #dce9f2; }
	.game-comparison { display: grid; grid-template-columns: repeat(3, 390px); gap: 16px; padding: 16px; background: #172033; }
	.game-frame { position: relative; width: 390px; height: 693px; overflow: hidden; border-radius: 12px; }
</style>
