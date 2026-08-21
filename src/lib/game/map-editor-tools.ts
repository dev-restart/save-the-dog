import type { StageMapObject, StageMapObjectKind } from './stages/stage-map-schema.js';
import { compileTerrainPrefab } from './terrain/terrain-compiler.js';
import type { TerrainPrefabId } from './terrain/terrain-prefabs.js';

export type TerrainPrefabTool = `prefab:${TerrainPrefabId}`;
export type MapEditorTool = 'select' | StageMapObjectKind | TerrainPrefabTool;

export function isTerrainPrefabTool(tool: MapEditorTool): tool is TerrainPrefabTool {
	return tool.startsWith('prefab:');
}

export function terrainPrefabIdFromTool(tool: MapEditorTool): TerrainPrefabId | undefined {
	if (!isTerrainPrefabTool(tool)) return undefined;
	return tool.slice('prefab:'.length) as TerrainPrefabId;
}

export function toolAfterPlacement(_tool: MapEditorTool): MapEditorTool {
	return 'select';
}

const CONNECTED_TERRAIN_KINDS = new Set<StageMapObjectKind>(['ground', 'terrain-block', 'no-draw-zone', 'no-draw-ground']);

export function isPointInsideMapObject(point: { x: number; y: number }, object: StageMapObject, width: number, height: number): boolean {
	if (object.prefabId) {
		const source = compileTerrainPrefab(object.prefabId);
		const compiled = compileTerrainPrefab(object.prefabId, {
			position: { x: object.x, y: object.y },
			rotation: object.angle ?? 0,
			scale: { x: width / source.bounds.width, y: height / source.bounds.height }
		});
		return compiled.polygons.some((polygon) => pointInPolygon(point, polygon.vertices));
	}
	const angle = -(object.angle ?? 0);
	const dx = point.x - object.x;
	const dy = point.y - object.y;
	const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
	const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
	return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
}

function pointInPolygon(point: { x: number; y: number }, vertices: readonly { x: number; y: number }[]): boolean {
	let inside = false;
	for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
		const a = vertices[index];
		const b = vertices[previous];
		if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
	}
	return inside;
}

export function isMapTerrainTopExposed(object: StageMapObject, objects: StageMapObject[]): boolean {
	if (!CONNECTED_TERRAIN_KINDS.has(object.kind) || Math.abs(object.angle ?? 0) > 0.001 || object.width === undefined || object.height === undefined) return true;
	const left = object.x - object.width / 2;
	const right = object.x + object.width / 2;
	const top = object.y - object.height / 2;

	return !objects.some((candidate) => {
		if (candidate.id === object.id || !CONNECTED_TERRAIN_KINDS.has(candidate.kind) || Math.abs(candidate.angle ?? 0) > 0.001 || candidate.width === undefined || candidate.height === undefined) return false;
		const overlap = Math.min(right, candidate.x + candidate.width / 2) - Math.max(left, candidate.x - candidate.width / 2);
		const candidateBottom = candidate.y + candidate.height / 2;
		return overlap >= Math.min(object.width!, candidate.width) * 0.7 && Math.abs(candidateBottom - top) <= 2;
	});
}
