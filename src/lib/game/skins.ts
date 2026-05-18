import type { SkinId } from './types.js';

export type SkinAsset = 'background' | 'dog' | 'dogHurt' | 'bee' | 'hive' | 'ground' | 'platform' | 'spike';

export interface SkinDefinition {
	id: SkinId;
	label: string;
	assets: Record<SkinAsset, string>;
	menu: {
		introBackground: string;
		introTitle: string;
	};
	drawingFill: string;
	drawingStroke: string;
}

function skinAssets(id: SkinId): Record<SkinAsset, string> {
	return {
		background: `/skins/${id}/background.png`,
		dog: `/skins/${id}/dog.png`,
		dogHurt: `/skins/${id}/dog-hurt.png`,
		bee: `/skins/${id}/bee.png`,
		hive: `/skins/${id}/hive.png`,
		ground: `/skins/${id}/ground.png`,
		platform: `/skins/${id}/platform.png`,
		spike: `/skins/${id}/spike.png`
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
		drawingFill: '#8b5a2b',
		drawingStroke: '#2f1f18'
	},
	{
		id: 'minecraft',
		label: '마인크래프트',
		assets: skinAssets('minecraft'),
		menu: {
			introBackground: '/skins/minecraft/intro-background.png',
			introTitle: '/skins/minecraft/intro-title.svg'
		},
		drawingFill: '#7c5f3b',
		drawingStroke: '#2f2417'
	},
	{
		id: 'lego',
		label: '레고',
		assets: skinAssets('lego'),
		menu: {
			introBackground: '/skins/lego/intro-background.png',
			introTitle: '/skins/lego/intro-title.svg'
		},
		drawingFill: '#d23b28',
		drawingStroke: '#5a140d'
	}
];

export function isSkinId(value: string | null): value is SkinId {
	return value === 'classic' || value === 'minecraft' || value === 'lego';
}

export function getSkinDefinition(skin: SkinId): SkinDefinition {
	return SKINS.find((item) => item.id === skin) ?? SKINS[0];
}
