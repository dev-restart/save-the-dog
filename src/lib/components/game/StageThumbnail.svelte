<script lang="ts">
	import { getSkinDefinition } from '$lib/game/skins.js';
	import type { ObstacleData, SkinId, StageData } from '$lib/game/types.js';

	interface Props {
		stage: StageData;
		skin: SkinId;
	}

	let { stage, skin }: Props = $props();
	let assets = $derived(getSkinDefinition(skin).assets);
	const PREVIEW_LIMIT = 10;
	let terrainAsset = $derived(assets.terrainBlock ?? assets.ground);
	let previewObstacles = $derived(
		stage.obstacles
			.filter((obstacle) => obstacle.type !== 'ground')
			.sort((a, b) => previewPriority(a) - previewPriority(b) || b.y - a.y)
			.slice(0, PREVIEW_LIMIT)
	);

	function previewClass(obstacle: ObstacleData): string {
		if (obstacle.type === 'water' || obstacle.type === 'lava' || obstacle.type === 'acid') return `pool ${obstacle.type}`;
		if (obstacle.type === 'rolling-boulder' || obstacle.type === 'boulder') return 'boulder';
		if (obstacle.type === 'bomb') return 'bomb';
		if (obstacle.type === 'wood' || obstacle.type === 'platform') return 'plank';
		if (obstacle.type === 'spike') return 'spike';
		if (obstacle.type === 'no-draw-zone' || obstacle.type === 'no-draw-ground' || obstacle.type === 'no-draw-tree' || obstacle.type === 'no-draw-rock') return `no-draw ${obstacle.type}`;
		if (obstacle.type === 'ice') return 'ice';
		if (obstacle.type === 'stone') return 'stone';
		if (obstacle.type === 'crate') return 'crate';
		return `terrain ${obstacle.type}`;
	}

	function previewPriority(obstacle: ObstacleData): number {
		if (['water', 'lava', 'acid', 'spike', 'bomb', 'no-draw-zone', 'no-draw-ground', 'no-draw-tree', 'no-draw-rock'].includes(obstacle.type)) return 0;
		if (['rolling-boulder', 'boulder', 'ice', 'stone'].includes(obstacle.type)) return 1;
		if (['wood', 'platform', 'brick', 'wall', 'terrain-block'].includes(obstacle.type)) return 2;
		return 3;
	}

	function previewAsset(obstacle: ObstacleData): string | undefined {
		switch (obstacle.type) {
			case 'water': return assets.water;
			case 'lava': return assets.lava;
			case 'acid': return assets.acid;
			case 'bomb': return assets.bomb;
			case 'boulder': return assets.boulder;
			case 'rolling-boulder': return assets.rollingBoulder;
			case 'brick': return assets.brick;
			case 'wood': return assets.wood;
			case 'platform': return assets.platform;
			case 'spike': return assets.spike;
			case 'crate': return assets.crate;
			case 'ice': return assets.ice;
			case 'stone': return assets.stone;
			case 'no-draw-zone': return assets.noDrawZone;
			case 'no-draw-ground': return assets.noDrawGround;
			case 'no-draw-tree': return assets.noDrawTree;
			case 'no-draw-rock': return assets.noDrawRock;
			case 'terrain-block': return assets.terrainBlock;
			default: return undefined;
		}
	}

	function positionStyle(object: { x: number; y: number; width: number; height: number; angle?: number }): string {
		return `left:${(object.x / 390) * 100}%;top:${(object.y / 693) * 100}%;width:${Math.max(4, (object.width / 390) * 100)}%;height:${Math.max(4, (object.height / 693) * 100)}%;transform:translate(-50%,-50%) rotate(${object.angle ?? 0}rad);`;
	}
</script>

	<div class={`stage-thumbnail ${stage.environment ?? 'meadow'}`} aria-hidden="true">
		<div class="thumbnail-ground"></div>
		{#each previewObstacles as obstacle (`${obstacle.type}-${obstacle.x}-${obstacle.y}`)}
			{@const obstacleClass = previewClass(obstacle)}
			{@const obstacleAsset = previewAsset(obstacle)}
			{#if obstacleAsset}
				<img class={`thumbnail-object asset-object ${obstacleClass}`} src={obstacleAsset} alt="" style={positionStyle(obstacle)} />
			{:else}
				<span class={`thumbnail-object ${obstacleClass}`} style={`${positionStyle(obstacle)}background-image:url('${terrainAsset}');`}></span>
			{/if}
		{/each}
	<img class="thumbnail-dog" src={assets.dog} alt="" style={`left:${(stage.dog.x / 390) * 100}%;top:${(stage.dog.y / 693) * 100}%;`} />
	{#each stage.hives.slice(0, 2) as hive (`${hive.x}-${hive.y}`)}
		<img class="thumbnail-hive" src={assets.hive} alt="" style={`left:${(hive.x / 390) * 100}%;top:${(hive.y / 693) * 100}%;`} />
	{/each}
</div>

<style>
	.stage-thumbnail { position: relative; aspect-ratio: 390 / 190; overflow: hidden; border: 1px solid rgba(255,255,255,.78); border-radius: 10px; background: linear-gradient(#bfe9ff, #f7fcff); box-shadow: inset 0 0 0 1px rgba(20, 62, 78, .08); }
	.stage-thumbnail.forest { background: linear-gradient(#b8e3c4, #eff9e9); }
	.stage-thumbnail.volcanic { background: linear-gradient(#59483d, #f2b46c); }
	.thumbnail-ground { position: absolute; right: 0; bottom: 0; left: 0; height: 17%; background: repeating-linear-gradient(90deg, #bf6d38 0 15px, #a95329 15px 17px), linear-gradient(#70c940 0 25%, #bf6d38 25%); border-top: 4px solid #78ca3f; }
	.thumbnail-object { position: absolute; display: block; transform-origin: center; }
	.asset-object { object-fit: contain; filter: drop-shadow(0 1px 1px rgba(15,23,42,.24)); }
	.terrain { background-color: #bf6d38; background-position: center; background-size: cover; border: 1px solid rgba(91, 49, 21, .48); }
	.terrain.brick { opacity: .92; }
	.pool { border: 1px solid rgba(4, 72, 104, .5); background-color: #38bdf8; background-image: repeating-linear-gradient(90deg, transparent 0 13px, rgba(255,255,255,.45) 13px 15px); }
	.pool.lava { border-color: rgba(112, 36, 12, .58); background-color: #fb923c; background-image: repeating-linear-gradient(135deg, #f97316 0 9px, #fde047 9px 12px); }
	.pool.acid { border-color: rgba(54, 95, 15, .6); background-color: #a3e635; background-image: repeating-linear-gradient(135deg, #84cc16 0 9px, #ecfccb 9px 12px); }
	.plank { height: max(4px, 4%) !important; border: 1px solid #6b3f1d; border-radius: 3px; background: #b9783e; }
	.boulder { width: 11% !important; height: 22% !important; border: 1px solid #475569; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #cbd5e1, #64748b 60%, #334155); }
	.spike { background: repeating-linear-gradient(135deg, transparent 0 7px, #94a3b8 7px 12px); }
	.bomb { filter: drop-shadow(0 0 4px rgba(239,68,68,.65)); }
	.no-draw { border: 2px dashed rgba(127,29,29,.72); background-color: rgba(248,113,113,.3); opacity: .88; }
	.no-draw.no-draw-tree, .no-draw.no-draw-rock { border-style: solid; }
	.ice { border: 1px solid rgba(14,116,144,.45); background: linear-gradient(135deg, #e0f2fe, #67e8f9); opacity: .88; }
	.stone { border: 1px solid rgba(71,85,105,.58); background: #64748b; opacity: .9; }
	.crate { border: 1px solid rgba(120,53,15,.56); background: #b9783e; }
	.thumbnail-dog, .thumbnail-hive { position: absolute; z-index: 2; width: 14%; height: auto; transform: translate(-50%, -50%); filter: drop-shadow(0 1px 1px rgba(15,23,42,.3)); }
	.thumbnail-hive { width: 13%; }
</style>
