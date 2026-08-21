import type { ObstacleType } from './types.js';

interface Size {
	width: number;
	height: number;
}

type EditorPreviewKind = 'horizontal' | 'vertical' | 'brick' | 'terrain' | 'image';

export interface ObstacleSpec {
	label: string;
	defaultSize: Size;
	blocksDrawing: boolean;
	editor: {
		available: boolean;
		preview: EditorPreviewKind;
	};
}

export const OBSTACLE_SPECS = {
	ground: {
		label: '땅',
		defaultSize: { width: 390, height: 20 },
		blocksDrawing: true,
		editor: { available: true, preview: 'terrain' }
	},
	platform: {
		label: '발판',
		defaultSize: { width: 96, height: 18 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	spike: {
		label: '가시',
		defaultSize: { width: 80, height: 24 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	wall: {
		label: '흙벽',
		defaultSize: { width: 40, height: 120 },
		blocksDrawing: true,
		editor: { available: true, preview: 'brick' }
	},
	water: {
		label: '물',
		defaultSize: { width: 110, height: 36 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	lava: {
		label: '용암',
		defaultSize: { width: 110, height: 36 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	brick: {
		label: '흙 블록',
		defaultSize: { width: 40, height: 40 },
		blocksDrawing: true,
		editor: { available: true, preview: 'brick' }
	},
	'terrain-block': {
		label: '잔디 블록',
		defaultSize: { width: 60, height: 60 },
		blocksDrawing: true,
		editor: { available: true, preview: 'terrain' }
	},
	wood: {
		label: '나무판',
		defaultSize: { width: 96, height: 18 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	bomb: {
		label: '폭탄',
		defaultSize: { width: 40, height: 40 },
		blocksDrawing: false,
		editor: { available: true, preview: 'image' }
	},
	boulder: {
		label: '바위',
		defaultSize: { width: 56, height: 56 },
		blocksDrawing: false,
		editor: { available: true, preview: 'image' }
	},
	crate: {
		label: '상자',
		defaultSize: { width: 52, height: 52 },
		blocksDrawing: true,
		editor: { available: true, preview: 'image' }
	},
	acid: {
		label: '산성 웅덩이',
		defaultSize: { width: 110, height: 36 },
		blocksDrawing: true,
		editor: { available: true, preview: 'horizontal' }
	},
	ice: {
		label: '얼음',
		defaultSize: { width: 48, height: 48 },
		blocksDrawing: true,
		editor: { available: true, preview: 'image' }
	},
	stone: {
		label: '돌기둥',
		defaultSize: { width: 40, height: 120 },
		blocksDrawing: true,
		editor: { available: true, preview: 'vertical' }
	},
	'rolling-boulder': {
		label: '굴림돌',
		defaultSize: { width: 56, height: 56 },
		blocksDrawing: false,
		editor: { available: true, preview: 'image' }
	},
	'no-draw-zone': {
		label: '지형 블록',
		defaultSize: { width: 80, height: 80 },
		blocksDrawing: true,
		editor: { available: true, preview: 'terrain' }
	},
	'no-draw-ground': {
		label: '지면 타일',
		defaultSize: { width: 100, height: 60 },
		blocksDrawing: true,
		editor: { available: true, preview: 'terrain' }
	},
	'no-draw-tree': {
		label: '나무',
		defaultSize: { width: 60, height: 100 },
		blocksDrawing: true,
		editor: { available: true, preview: 'image' }
	},
	'no-draw-rock': {
		label: '바위 지형',
		defaultSize: { width: 70, height: 70 },
		blocksDrawing: true,
		editor: { available: true, preview: 'image' }
	}
} satisfies Record<ObstacleType, ObstacleSpec>;

export const OBSTACLE_TYPES = Object.freeze(
	Object.keys(OBSTACLE_SPECS) as ObstacleType[]
);

export const OBSTACLE_TYPE_SET = new Set<ObstacleType>(OBSTACLE_TYPES);

export const EDITOR_OBSTACLE_TOOL_ITEMS = OBSTACLE_TYPES.filter(
	(kind) => OBSTACLE_SPECS[kind].editor.available
).map((kind) => ({
	kind,
	label: OBSTACLE_SPECS[kind].label
})) satisfies Array<{ kind: ObstacleType; label: string }>;

export function isObstacleType(value: string): value is ObstacleType {
	return OBSTACLE_TYPE_SET.has(value as ObstacleType);
}

export function getObstacleSpec(kind: ObstacleType): ObstacleSpec {
	return OBSTACLE_SPECS[kind];
}
