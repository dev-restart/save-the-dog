import type { SkinId } from './types.js';

export type RequiredSkinAsset =
	| 'background'
	| 'dog'
	| 'dogHurt'
	| 'bee'
	| 'hive'
	| 'ground'
	| 'platform'
	| 'spike';
export type OptionalSkinAsset =
	| 'water'
	| 'lava'
	| 'brick'
	| 'wood'
	| 'bomb'
	| 'boulder'
	| 'crate'
	| 'acid'
	| 'ice'
	| 'stone'
	| 'rollingBoulder'
	| 'volcanoBackground'
	| 'forestBackground'
	| 'noDrawZone'
	| 'noDrawGround'
	| 'noDrawTree'
	| 'noDrawRock'
	| 'explosion'
	| 'groundCross'
	| 'dirtWall'
	| 'stonePillar'
	| 'terrainBlock';
export type SkinAsset = RequiredSkinAsset | OptionalSkinAsset;

export interface SkinDefinition {
	id: SkinId;
	label: string;
	assets: Record<RequiredSkinAsset, string> & Partial<Record<OptionalSkinAsset, string>>;
	menu: {
		introBackground: string;
		introTitle: string;
	};
	drawingFill: string;
	drawingStroke: string;
}

function skinAssets(id: SkinId): SkinDefinition['assets'] {
	return {
		background: `/skins/${id}/background.png`,
		volcanoBackground: `/skins/${id}/background-volcano.png`,
		forestBackground: `/skins/${id}/background-forest.png`,
		dog: `/skins/${id}/dog.png`,
		dogHurt: `/skins/${id}/dog-hurt.png`,
		bee: `/skins/${id}/bee.png`,
		hive: `/skins/${id}/hive.png`,
		ground: `/skins/${id}/ground.png`,
		platform: `/skins/${id}/platform.png`,
		spike: `/skins/${id}/spike.png`,
		water: `/skins/${id}/water.png`,
		lava: `/skins/${id}/lava.png`,
		brick: `/skins/${id}/brick.png`,
		wood: `/skins/${id}/wood.png`,
		bomb: `/skins/${id}/bomb.png`,
		boulder: `/skins/${id}/boulder.png`,
		crate: `/skins/${id}/crate.png`,
		acid: `/skins/${id}/acid.png`,
		ice: `/skins/${id}/ice.png`,
		stone: `/skins/${id}/stone.png`,
		rollingBoulder: `/skins/${id}/rolling-boulder.png`,
		// 연결형 지형은 각 스킨 파일을 쓰되, 모두 금지 표식 없는 타일로 통일한다.
		noDrawZone: `/skins/${id}/no-draw-zone.png`,
		noDrawGround: `/skins/${id}/no-draw-ground.png`,
		noDrawTree: `/skins/${id}/no-draw-tree.png`,
		noDrawRock: `/skins/${id}/no-draw-rock.png`,
		// 폭발 연출은 현재 세 스킨이 같은 게임 플레이 실루엣을 공유한다.
		explosion: '/skins/classic/bomb-explosion-v1.png',
		groundCross: `/skins/${id}/ground-cross.png`,
		dirtWall: `/skins/${id}/dirt-wall.png`,
		stonePillar: `/skins/${id}/stone-pillar.png`,
		// 블록 지형은 세 스킨에서 같은 충돌 실루엣을 공유한다. 이후 스킨별 변형을 추가해도 호출부는 유지된다.
		terrainBlock: '/skins/classic/terrain-block-v2.png'
	};
}

export const DEFAULT_SKIN: SkinId = 'classic';

export const SKINS: SkinDefinition[] = [
	{
		id: 'classic',
		label: '오리지널',
		assets: skinAssets('classic'),
		menu: {
			introBackground: '/skins/classic/intro-background.png',
			introTitle: '/skins/classic/intro-title.svg'
		},
		drawingFill: '#111827',
		drawingStroke: '#020617'
	},
	{
		id: 'minecraft',
		label: '마인크래프트',
		assets: skinAssets('minecraft'),
		menu: {
			introBackground: '/skins/minecraft/intro-background.png',
			introTitle: '/skins/minecraft/intro-title.svg'
		},
		drawingFill: '#111827',
		drawingStroke: '#020617'
	},
	{
		id: 'lego',
		label: '레고',
		assets: skinAssets('lego'),
		menu: {
			introBackground: '/skins/lego/intro-background.png',
			introTitle: '/skins/lego/intro-title.svg'
		},
		drawingFill: '#111827',
		drawingStroke: '#020617'
	}
];

export function isSkinId(value: string | null): value is SkinId {
	return value === 'classic' || value === 'minecraft' || value === 'lego';
}

export function getSkinDefinition(skin: SkinId): SkinDefinition {
	return SKINS.find((item) => item.id === skin) ?? SKINS[0];
}
