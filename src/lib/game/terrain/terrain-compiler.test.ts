import { describe, expect, it } from 'vitest';
import { compileTerrain, compileTerrainPrefab } from './terrain-compiler.js';
import { TERRAIN_PREFABS } from './terrain-prefabs.js';

describe('compileTerrain', () => {
	it('rectangle, polygon, compound source를 정적 physics part로 컴파일한다', () => {
		const rectangle = compileTerrain({
			prefabId: 'rectangle-test',
			shape: { kind: 'rectangle', x: 10, y: 20, width: 40, height: 20 }
		});
		const polygon = compileTerrain({
			prefabId: 'polygon-test',
			shape: { kind: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }] }
		});
		const compound = compileTerrain({
			prefabId: 'compound-test',
			shape: {
				kind: 'compound',
				parts: [
					{ kind: 'rectangle', id: 'left', x: 0, y: 0, width: 20, height: 40 },
					{ kind: 'rectangle', id: 'right', x: 30, y: 0, width: 20, height: 40 }
				]
			}
		});

		expect(rectangle.parts).toHaveLength(1);
		expect(polygon.parts).toHaveLength(1);
		expect(compound.parts.map((part) => part.id)).toEqual(['left', 'right']);
		expect([...rectangle.parts, ...polygon.parts, ...compound.parts].every((part) => part.body.isStatic)).toBe(true);
	});

	it('한 polygon source에서 physics, no-draw, render metadata를 함께 파생한다', () => {
		const compiled = compileTerrainPrefab('cave-pocket');

		expect(compiled.parts).toHaveLength(3);
		expect(compiled.physics.bodies).toEqual(compiled.parts.map((part) => part.body));
		expect(compiled.noDraw.polygons).toBe(compiled.polygons);
		expect(compiled.render.polygons).toBe(compiled.polygons);
		expect(compiled.render.autotileCells).toBe(compiled.autotileCells);
		expect(compiled.bounds).toEqual({ min: { x: -90, y: -60 }, max: { x: 90, y: 90 }, width: 180, height: 150 });
		expect(compiled.supportSegments.length).toBeGreaterThan(0);
		expect(compiled.autotileCells.length).toBeGreaterThan(0);
	});

	it('translation, rotation, non-uniform scale을 모든 출력 좌표에 적용한다', () => {
		const compiled = compileTerrain(
			{ prefabId: 'transform-test', shape: { kind: 'rectangle', x: 0, y: 0, width: 20, height: 10 } },
			{ position: { x: 100, y: 50 }, rotation: Math.PI / 2, scale: { x: 2, y: 1 }, autotileCellSize: 10 }
		);

		expect(compiled.bounds.min.x).toBeCloseTo(95);
		expect(compiled.bounds.max.x).toBeCloseTo(105);
		expect(compiled.bounds.min.y).toBeCloseTo(30);
		expect(compiled.bounds.max.y).toBeCloseTo(70);
		expect(compiled.parts[0].body.position.x).toBeCloseTo(100);
		expect(compiled.parts[0].body.position.y).toBeCloseTo(50);
	});

	it('autotile cell에 사방 인접 bitmask를 기록한다', () => {
		const compiled = compileTerrain(
			{ prefabId: 'tile-test', shape: { kind: 'rectangle', x: 10, y: 10, width: 20, height: 20 } },
			{ autotileCellSize: 10 }
		);

		expect(compiled.autotileCells).toHaveLength(4);
		expect(compiled.autotileCells.map((cell) => cell.neighbors).sort((a, b) => a - b)).toEqual([3, 6, 9, 12]);
	});

	it('잘못된 polygon과 concave 단일 part는 명시적으로 거부한다', () => {
		expect(() => compileTerrain({
			prefabId: 'line',
			shape: { kind: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }
		})).toThrow('at least three vertices');
		expect(() => compileTerrain({
			prefabId: 'concave',
			shape: { kind: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 0, y: 20 }] }
		})).toThrow('use a compound');
	});
});

describe('terrain prefabs', () => {
	it('등록된 prefab을 모두 독립적으로 컴파일한다', () => {
		expect(Object.keys(TERRAIN_PREFABS)).toEqual([
			'cave-pocket',
			'slope-left',
			'slope-right',
			'bomb-niche',
			'u-shelter',
			'cliff-pocket-left',
			'cliff-pocket-right',
			'arch-shelter',
			'split-pillars',
			'stepped-basin'
		]);

		for (const prefabId of Object.keys(TERRAIN_PREFABS) as Array<keyof typeof TERRAIN_PREFABS>) {
			const compiled = compileTerrainPrefab(prefabId);
			expect(compiled.prefabId).toBe(prefabId);
			expect(compiled.polygons.length).toBeGreaterThan(0);
			expect(compiled.physics.bodies.every((body) => body.isStatic)).toBe(true);
			expect(compiled.supportSegments.length).toBeGreaterThan(0);
		}
	});

	it.each([
		['cliff-pocket-left', 4, { min: { x: -120, y: -100 }, max: { x: 80, y: 100 }, width: 200, height: 200 }, { x: 0, y: 30 }],
		['cliff-pocket-right', 4, { min: { x: -80, y: -100 }, max: { x: 120, y: 100 }, width: 200, height: 200 }, { x: 0, y: 30 }],
		['arch-shelter', 5, { min: { x: -110, y: -100 }, max: { x: 110, y: 65 }, width: 220, height: 165 }, { x: 0, y: 0 }],
		['split-pillars', 4, { min: { x: -125, y: -120 }, max: { x: 125, y: 100 }, width: 250, height: 220 }, { x: 0, y: 0 }],
		['stepped-basin', 5, { min: { x: -120, y: -60 }, max: { x: 120, y: 100 }, width: 240, height: 160 }, { x: 0, y: 20 }]
	] as const)('%s의 큰 실루엣과 실제 빈 공략 공간을 함께 컴파일한다', (prefabId, partCount, bounds, openPoint) => {
		const compiled = compileTerrainPrefab(prefabId);

		expect(compiled.parts).toHaveLength(partCount);
		expect(compiled.noDraw.bounds).toEqual(bounds);
		expect(compiled.noDraw.polygons).toHaveLength(partCount);
		expect(compiled.noDraw.polygons.some((polygon) => pointInPolygon(openPoint, polygon.vertices))).toBe(false);
		expect(compiled.supportSegments.some((segment) => segment.length >= 60)).toBe(true);
	});
});

function pointInPolygon(
	point: { x: number; y: number },
	vertices: readonly { x: number; y: number }[]
): boolean {
	let inside = false;
	for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
		const current = vertices[index];
		const prior = vertices[previous];
		if (
			(current.y > point.y) !== (prior.y > point.y) &&
			point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x
		) inside = !inside;
	}
	return inside;
}
