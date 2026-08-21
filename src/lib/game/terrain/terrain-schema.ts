import type Matter from 'matter-js';

export interface TerrainPoint {
	x: number;
	y: number;
}

export interface TerrainRectangleSource {
	kind: 'rectangle';
	id?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
}

export interface TerrainPolygonSource {
	kind: 'polygon';
	id?: string;
	vertices: readonly TerrainPoint[];
}

export interface TerrainCompoundSource {
	kind: 'compound';
	id?: string;
	parts: readonly TerrainShapeSource[];
}

export type TerrainShapeSource = TerrainRectangleSource | TerrainPolygonSource | TerrainCompoundSource;

export interface TerrainSource {
	prefabId: string;
	shape: TerrainShapeSource;
	material?: string;
	autotileCellSize?: number;
}

export interface TerrainCompileOptions {
	position?: TerrainPoint;
	rotation?: number;
	scale?: number | TerrainPoint;
	autotileCellSize?: number;
	bodyOptions?: Omit<Matter.IChamferableBodyDefinition, 'isStatic'>;
}

export interface TerrainBounds {
	min: TerrainPoint;
	max: TerrainPoint;
	width: number;
	height: number;
}

export interface TerrainPolygon {
	partId: string;
	vertices: readonly TerrainPoint[];
}

export interface CompiledTerrainPart {
	id: string;
	polygon: TerrainPolygon;
	bounds: TerrainBounds;
	body: Matter.Body;
}

export interface TerrainSupportSegment {
	partId: string;
	from: TerrainPoint;
	to: TerrainPoint;
	normal: TerrainPoint;
	length: number;
}

export interface TerrainAutotileCell {
	column: number;
	row: number;
	x: number;
	y: number;
	size: number;
	/** 인접 셀 bitmask: north=1, east=2, south=4, west=8 */
	neighbors: number;
}

export interface CompiledTerrain {
	prefabId: string;
	material: string;
	parts: readonly CompiledTerrainPart[];
	polygons: readonly TerrainPolygon[];
	bounds: TerrainBounds;
	supportSegments: readonly TerrainSupportSegment[];
	autotileCells: readonly TerrainAutotileCell[];
	physics: {
		bodies: readonly Matter.Body[];
	};
	noDraw: {
		polygons: readonly TerrainPolygon[];
		bounds: TerrainBounds;
	};
	render: {
		material: string;
		polygons: readonly TerrainPolygon[];
		bounds: TerrainBounds;
		autotileCells: readonly TerrainAutotileCell[];
	};
}
