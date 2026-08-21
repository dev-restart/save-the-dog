import type { TerrainSource } from './terrain-schema.js';

export const TERRAIN_PREFABS = {
	'cave-pocket': {
		prefabId: 'cave-pocket',
		material: 'rock',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'roof', x: 0, y: -50, width: 180, height: 20 },
				{ kind: 'rectangle', id: 'back-wall', x: -80, y: 20, width: 20, height: 140 },
				{ kind: 'rectangle', id: 'floor', x: 0, y: 80, width: 180, height: 20 }
			]
		}
	},
	'slope-left': {
		prefabId: 'slope-left',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'polygon',
			vertices: [
				{ x: -70, y: -35 },
				{ x: 70, y: 35 },
				{ x: 70, y: 55 },
				{ x: -70, y: 55 }
			]
		}
	},
	'slope-right': {
		prefabId: 'slope-right',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'polygon',
			vertices: [
				{ x: -70, y: 35 },
				{ x: 70, y: -35 },
				{ x: 70, y: 55 },
				{ x: -70, y: 55 }
			]
		}
	},
	'bomb-niche': {
		prefabId: 'bomb-niche',
		material: 'stone',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'left-wall', x: -55, y: 0, width: 20, height: 100 },
				{ kind: 'rectangle', id: 'right-wall', x: 55, y: 0, width: 20, height: 100 },
				{ kind: 'rectangle', id: 'roof', x: 0, y: -40, width: 130, height: 20 }
			]
		}
	},
	'u-shelter': {
		prefabId: 'u-shelter',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'left-wall', x: -70, y: 0, width: 20, height: 140 },
				{ kind: 'rectangle', id: 'right-wall', x: 70, y: 0, width: 20, height: 140 },
				{ kind: 'rectangle', id: 'floor', x: 0, y: 60, width: 160, height: 20 }
			]
		}
	},
	'cliff-pocket-left': {
		prefabId: 'cliff-pocket-left',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'upper-mass', x: -20, y: -80, width: 200, height: 40 },
				{ kind: 'polygon', id: 'overhang', vertices: [
					{ x: -120, y: -60 },
					{ x: 80, y: -60 },
					{ x: 40, y: -20 },
					{ x: -120, y: -20 }
				] },
				{ kind: 'rectangle', id: 'back-wall', x: -105, y: 20, width: 30, height: 160 },
				{ kind: 'rectangle', id: 'floor-ledge', x: -55, y: 90, width: 130, height: 20 }
			]
		}
	},
	'cliff-pocket-right': {
		prefabId: 'cliff-pocket-right',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'upper-mass', x: 20, y: -80, width: 200, height: 40 },
				{ kind: 'polygon', id: 'overhang', vertices: [
					{ x: -80, y: -60 },
					{ x: 120, y: -60 },
					{ x: 120, y: -20 },
					{ x: -40, y: -20 }
				] },
				{ kind: 'rectangle', id: 'back-wall', x: 105, y: 20, width: 30, height: 160 },
				{ kind: 'rectangle', id: 'floor-ledge', x: 55, y: 90, width: 130, height: 20 }
			]
		}
	},
	'arch-shelter': {
		prefabId: 'arch-shelter',
		material: 'stone',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'roof', x: 0, y: -90, width: 220, height: 20 },
				{ kind: 'polygon', id: 'left-shoulder', vertices: [
					{ x: -110, y: -80 },
					{ x: -45, y: -80 },
					{ x: -65, y: -45 },
					{ x: -110, y: -45 }
				] },
				{ kind: 'polygon', id: 'right-shoulder', vertices: [
					{ x: 45, y: -80 },
					{ x: 110, y: -80 },
					{ x: 110, y: -45 },
					{ x: 65, y: -45 }
				] },
				{ kind: 'rectangle', id: 'left-pillar', x: -95, y: 10, width: 30, height: 110 },
				{ kind: 'rectangle', id: 'right-pillar', x: 95, y: 10, width: 30, height: 110 }
			]
		}
	},
	'split-pillars': {
		prefabId: 'split-pillars',
		material: 'stone',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'left-pillar', x: -80, y: 20, width: 60, height: 160 },
				{ kind: 'rectangle', id: 'left-cap', x: -80, y: -70, width: 90, height: 20 },
				{ kind: 'rectangle', id: 'right-pillar', x: 80, y: 0, width: 60, height: 200 },
				{ kind: 'rectangle', id: 'right-cap', x: 80, y: -110, width: 90, height: 20 }
			]
		}
	},
	'stepped-basin': {
		prefabId: 'stepped-basin',
		material: 'earth',
		autotileCellSize: 20,
		shape: {
			kind: 'compound',
			parts: [
				{ kind: 'rectangle', id: 'left-outer-step', x: -100, y: 10, width: 40, height: 140 },
				{ kind: 'rectangle', id: 'left-inner-step', x: -65, y: 50, width: 30, height: 60 },
				{ kind: 'rectangle', id: 'basin-floor', x: 0, y: 90, width: 120, height: 20 },
				{ kind: 'rectangle', id: 'right-inner-step', x: 65, y: 50, width: 30, height: 60 },
				{ kind: 'rectangle', id: 'right-outer-step', x: 100, y: 10, width: 40, height: 140 }
			]
		}
	}
} as const satisfies Record<string, TerrainSource>;

export type TerrainPrefabId = keyof typeof TERRAIN_PREFABS;

export function getTerrainPrefab(prefabId: TerrainPrefabId): TerrainSource {
	return TERRAIN_PREFABS[prefabId];
}
