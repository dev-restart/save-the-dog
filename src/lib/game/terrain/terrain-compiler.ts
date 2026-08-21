import Matter from 'matter-js';
import { getTerrainPrefab, type TerrainPrefabId } from './terrain-prefabs.js';
import type {
	CompiledTerrain,
	CompiledTerrainPart,
	TerrainAutotileCell,
	TerrainBounds,
	TerrainCompileOptions,
	TerrainPoint,
	TerrainPolygon,
	TerrainShapeSource,
	TerrainSource,
	TerrainSupportSegment
} from './terrain-schema.js';

const EPSILON = 1e-7;

export function compileTerrainPrefab(prefabId: TerrainPrefabId, options: TerrainCompileOptions = {}): CompiledTerrain {
	return compileTerrain(getTerrainPrefab(prefabId), options);
}

export function compileTerrain(source: TerrainSource, options: TerrainCompileOptions = {}): CompiledTerrain {
	if (!source.prefabId.trim()) throw new Error('Terrain prefabId must not be empty.');

	const scale = normalizeScale(options.scale);
	const position = options.position ?? { x: 0, y: 0 };
	const rotation = options.rotation ?? 0;
	const rawParts = flattenShape(source.shape);
	if (rawParts.length === 0) throw new Error(`Terrain "${source.prefabId}" must contain at least one part.`);

	const polygons = rawParts.map(({ id, vertices }) => ({
		partId: id,
		vertices: normalizeWinding(vertices.map((point) => transformPoint(point, scale, rotation, position)))
	}));

	for (const polygon of polygons) validatePolygon(polygon, source.prefabId);

	const parts = polygons.map((polygon) => compilePart(source.prefabId, polygon, options));
	const bounds = boundsForPolygons(polygons);
	const cellSize = options.autotileCellSize ?? source.autotileCellSize ?? 20;
	if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Terrain autotileCellSize must be greater than zero.');

	const supportSegments = compileSupportSegments(polygons);
	const autotileCells = compileAutotileCells(polygons, bounds, cellSize);
	const material = source.material ?? 'terrain';

	return {
		prefabId: source.prefabId,
		material,
		parts,
		polygons,
		bounds,
		supportSegments,
		autotileCells,
		physics: { bodies: parts.map((part) => part.body) },
		noDraw: { polygons, bounds },
		render: { material, polygons, bounds, autotileCells }
	};
}

interface RawPart {
	id: string;
	vertices: TerrainPoint[];
}

function flattenShape(shape: TerrainShapeSource, parentId = 'part'): RawPart[] {
	if (shape.kind === 'compound') {
		return shape.parts.flatMap((part, index) => flattenShape(part, part.id ?? `${shape.id ?? parentId}-${index}`));
	}

	const id = shape.id ?? parentId;
	if (shape.kind === 'polygon') return [{ id, vertices: shape.vertices.map(copyPoint) }];
	if (shape.width <= 0 || shape.height <= 0) throw new Error(`Terrain rectangle "${id}" must have positive dimensions.`);

	const halfWidth = shape.width / 2;
	const halfHeight = shape.height / 2;
	const angle = shape.angle ?? 0;
	const corners = [
		{ x: -halfWidth, y: -halfHeight },
		{ x: halfWidth, y: -halfHeight },
		{ x: halfWidth, y: halfHeight },
		{ x: -halfWidth, y: halfHeight }
	];
	return [{
		id,
		vertices: corners.map((corner) => {
			const rotated = rotatePoint(corner, angle);
			return { x: rotated.x + shape.x, y: rotated.y + shape.y };
		})
	}];
}

function normalizeScale(scale: TerrainCompileOptions['scale']): TerrainPoint {
	const normalized = typeof scale === 'number' ? { x: scale, y: scale } : (scale ?? { x: 1, y: 1 });
	if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y) || Math.abs(normalized.x) < EPSILON || Math.abs(normalized.y) < EPSILON) {
		throw new Error('Terrain scale must contain finite, non-zero values.');
	}
	return normalized;
}

function transformPoint(point: TerrainPoint, scale: TerrainPoint, rotation: number, position: TerrainPoint): TerrainPoint {
	const rotated = rotatePoint({ x: point.x * scale.x, y: point.y * scale.y }, rotation);
	return { x: rotated.x + position.x, y: rotated.y + position.y };
}

function rotatePoint(point: TerrainPoint, angle: number): TerrainPoint {
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
}

function copyPoint(point: TerrainPoint): TerrainPoint {
	return { x: point.x, y: point.y };
}

function signedArea(vertices: readonly TerrainPoint[]): number {
	return vertices.reduce((area, point, index) => {
		const next = vertices[(index + 1) % vertices.length];
		return area + point.x * next.y - next.x * point.y;
	}, 0) / 2;
}

function normalizeWinding(vertices: TerrainPoint[]): TerrainPoint[] {
	return signedArea(vertices) < 0 ? vertices.reverse() : vertices;
}

function validatePolygon(polygon: TerrainPolygon, prefabId: string): void {
	if (polygon.vertices.length < 3) throw new Error(`Terrain "${prefabId}" part "${polygon.partId}" needs at least three vertices.`);
	if (polygon.vertices.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
		throw new Error(`Terrain "${prefabId}" part "${polygon.partId}" contains a non-finite vertex.`);
	}
	if (Math.abs(signedArea(polygon.vertices)) < EPSILON) throw new Error(`Terrain "${prefabId}" part "${polygon.partId}" has zero area.`);
	if (!isConvex(polygon.vertices)) throw new Error(`Terrain "${prefabId}" part "${polygon.partId}" must be convex; use a compound for concave terrain.`);
}

function isConvex(vertices: readonly TerrainPoint[]): boolean {
	let direction = 0;
	for (let index = 0; index < vertices.length; index += 1) {
		const a = vertices[index];
		const b = vertices[(index + 1) % vertices.length];
		const c = vertices[(index + 2) % vertices.length];
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		if (Math.abs(cross) < EPSILON) continue;
		const nextDirection = Math.sign(cross);
		if (direction !== 0 && direction !== nextDirection) return false;
		direction = nextDirection;
	}
	return direction !== 0;
}

function compilePart(prefabId: string, polygon: TerrainPolygon, options: TerrainCompileOptions): CompiledTerrainPart {
	const center = polygonCentroid(polygon.vertices);
	const body = Matter.Bodies.fromVertices(
		center.x,
		center.y,
		[polygon.vertices.map(copyPoint)],
		{
			...options.bodyOptions,
			label: options.bodyOptions?.label ?? `terrain:${prefabId}:${polygon.partId}`,
			isStatic: true
		},
		true
	);
	return { id: polygon.partId, polygon, bounds: boundsForVertices(polygon.vertices), body };
}

function polygonCentroid(vertices: readonly TerrainPoint[]): TerrainPoint {
	let x = 0;
	let y = 0;
	let factorSum = 0;
	for (let index = 0; index < vertices.length; index += 1) {
		const point = vertices[index];
		const next = vertices[(index + 1) % vertices.length];
		const factor = point.x * next.y - next.x * point.y;
		x += (point.x + next.x) * factor;
		y += (point.y + next.y) * factor;
		factorSum += factor;
	}
	return { x: x / (3 * factorSum), y: y / (3 * factorSum) };
}

function boundsForVertices(vertices: readonly TerrainPoint[]): TerrainBounds {
	const xs = vertices.map((point) => point.x);
	const ys = vertices.map((point) => point.y);
	const min = { x: Math.min(...xs), y: Math.min(...ys) };
	const max = { x: Math.max(...xs), y: Math.max(...ys) };
	return { min, max, width: max.x - min.x, height: max.y - min.y };
}

function boundsForPolygons(polygons: readonly TerrainPolygon[]): TerrainBounds {
	return boundsForVertices(polygons.flatMap((polygon) => polygon.vertices));
}

function compileSupportSegments(polygons: readonly TerrainPolygon[]): TerrainSupportSegment[] {
	return polygons.flatMap((polygon) => polygon.vertices.flatMap((from, index) => {
		const to = polygon.vertices[(index + 1) % polygon.vertices.length];
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const length = Math.hypot(dx, dy);
		const normal = { x: dy / length, y: -dx / length };
		if (normal.y > -0.25) return [];

		const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
		const outsideProbe = { x: midpoint.x + normal.x * 0.5, y: midpoint.y + normal.y * 0.5 };
		const covered = polygons.some((other) => other !== polygon && pointInPolygon(outsideProbe, other.vertices));
		return covered ? [] : [{ partId: polygon.partId, from, to, normal, length }];
	}));
}

function compileAutotileCells(
	polygons: readonly TerrainPolygon[],
	bounds: TerrainBounds,
	cellSize: number
): TerrainAutotileCell[] {
	const minColumn = Math.floor(bounds.min.x / cellSize);
	const maxColumn = Math.ceil(bounds.max.x / cellSize) - 1;
	const minRow = Math.floor(bounds.min.y / cellSize);
	const maxRow = Math.ceil(bounds.max.y / cellSize) - 1;
	const occupied = new Set<string>();

	for (let row = minRow; row <= maxRow; row += 1) {
		for (let column = minColumn; column <= maxColumn; column += 1) {
			if (polygons.some((polygon) => polygonIntersectsCell(polygon.vertices, column, row, cellSize))) occupied.add(cellKey(column, row));
		}
	}

	return [...occupied]
		.map((key) => key.split(',').map(Number) as [number, number])
		.sort(([aColumn, aRow], [bColumn, bRow]) => aRow - bRow || aColumn - bColumn)
		.map(([column, row]) => ({
			column,
			row,
			x: (column + 0.5) * cellSize,
			y: (row + 0.5) * cellSize,
			size: cellSize,
			neighbors:
				(occupied.has(cellKey(column, row - 1)) ? 1 : 0) |
				(occupied.has(cellKey(column + 1, row)) ? 2 : 0) |
				(occupied.has(cellKey(column, row + 1)) ? 4 : 0) |
				(occupied.has(cellKey(column - 1, row)) ? 8 : 0)
		}));
}

function polygonIntersectsCell(vertices: readonly TerrainPoint[], column: number, row: number, size: number): boolean {
	const min = { x: column * size, y: row * size };
	const max = { x: min.x + size, y: min.y + size };
	const corners = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
	if (vertices.some((vertex) => pointInRectangle(vertex, min, max))) return true;
	if (corners.some((corner) => pointInPolygon(corner, vertices))) return true;

	return vertices.some((from, index) => {
		const to = vertices[(index + 1) % vertices.length];
		return corners.some((corner, cornerIndex) => segmentsIntersect(from, to, corner, corners[(cornerIndex + 1) % corners.length]));
	});
}

function pointInRectangle(point: TerrainPoint, min: TerrainPoint, max: TerrainPoint): boolean {
	return point.x >= min.x - EPSILON && point.x <= max.x + EPSILON && point.y >= min.y - EPSILON && point.y <= max.y + EPSILON;
}

function pointInPolygon(point: TerrainPoint, vertices: readonly TerrainPoint[]): boolean {
	let inside = false;
	for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
		const a = vertices[index];
		const b = vertices[previous];
		if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
	}
	return inside;
}

function segmentsIntersect(a: TerrainPoint, b: TerrainPoint, c: TerrainPoint, d: TerrainPoint): boolean {
	const orientation = (p: TerrainPoint, q: TerrainPoint, r: TerrainPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
	const o1 = orientation(a, b, c);
	const o2 = orientation(a, b, d);
	const o3 = orientation(c, d, a);
	const o4 = orientation(c, d, b);
	return ((o1 <= EPSILON && o2 >= -EPSILON) || (o1 >= -EPSILON && o2 <= EPSILON)) &&
		((o3 <= EPSILON && o4 >= -EPSILON) || (o3 >= -EPSILON && o4 <= EPSILON));
}

function cellKey(column: number, row: number): string {
	return `${column},${row}`;
}
