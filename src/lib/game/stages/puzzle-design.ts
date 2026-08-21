import { BASE_WORLD, type ObstacleData, type Point, type StageData } from '../types.js';
import { getTerrainPrefab } from '../terrain/terrain-prefabs.js';
import type { TerrainShapeSource } from '../terrain/terrain-schema.js';

export type PuzzleDesignIssueCode =
	| 'DOG_ISOLATED_FROM_PUZZLE'
	| 'DRAWING_ANCHOR_GAP_MISSING'
	| 'DRAWING_ANCHOR_GAP_TOO_NARROW'
	| 'DRAWING_ANCHOR_GAP_TOO_WIDE'
	| 'HAZARD_OFF_APPROACH_ROUTE'
	| 'TERRAIN_COVERAGE_TOO_SPARSE'
	| 'TERRAIN_SILHOUETTE_TOO_SIMPLE';

export type PuzzleDesignSeverity = 'none' | 'warning' | 'error';

export interface PuzzleDesignIssue {
	code: PuzzleDesignIssueCode;
	severity: Exclude<PuzzleDesignSeverity, 'none'>;
	obstacleIndex?: number;
	measuredValue?: number;
}

export interface PuzzleDesignMetrics {
	drawingAnchorGap?: number;
	terrainCoverageRatio: number;
	silhouetteSpanRatio: number;
	silhouetteHeightBands: number;
}

export interface PuzzleDesignAudit {
	issues: PuzzleDesignIssue[];
	issueCodes: PuzzleDesignIssueCode[];
	severity: PuzzleDesignSeverity;
	metrics: PuzzleDesignMetrics;
}

const MIN_DRAWING_ANCHOR_GAP = 45;
const MAX_DRAWING_ANCHOR_GAP = 220;
const MAX_ANCHOR_MIDPOINT_DISTANCE = 230;
const DOG_PUZZLE_PROXIMITY = 150;
const HAZARD_ROUTE_HALF_WIDTH = 96;
const HAZARD_DOG_PROXIMITY = 180;
const MIN_TERRAIN_COVERAGE_RATIO = 0.04;
const MIN_SILHOUETTE_SPAN_RATIO = 0.45;
const SILHOUETTE_BAND_SIZE = 40;

const TERRAIN_TYPES = new Set<ObstacleData['type']>([
	'platform', 'wall', 'brick', 'terrain-block', 'wood', 'crate', 'ice', 'stone'
]);
const ANCHOR_TYPES = new Set<ObstacleData['type']>([
	'ground', ...TERRAIN_TYPES
]);
const HAZARD_TYPES = new Set<ObstacleData['type']>([
	'spike', 'water', 'lava', 'bomb', 'boulder', 'crate', 'acid', 'rolling-boulder'
]);

interface Rectangle {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

interface AnchorGap {
	length: number;
	midpoint: Point;
}

/**
 * StageData만으로 퍼즐 저작 품질을 검사하는 보수적인 geometric audit입니다.
 * 실제 Matter.js 성공 가능성을 판정하지 않고, 퀴즈가 성립하기 위한 최소 공간 계약만 검사합니다.
 */
export function auditPuzzleDesign(stage: StageData): PuzzleDesignAudit {
	const issues: PuzzleDesignIssue[] = [];
	const geometry = stage.obstacles.map(obstacleRectangles);
	const terrainRectangles = stage.obstacles.flatMap((obstacle, index) =>
		TERRAIN_TYPES.has(obstacle.type) ? geometry[index] : []
	);
	const anchorRectangles = stage.obstacles.flatMap((obstacle, index) =>
		ANCHOR_TYPES.has(obstacle.type) ? geometry[index] : []
	);

	if (!dogParticipatesInPuzzle(stage, geometry)) {
		issues.push({ code: 'DOG_ISOLATED_FROM_PUZZLE', severity: 'error' });
	}

	const anchorGap = auditDrawingAnchorGap(stage.dog, anchorRectangles, issues);
	stage.obstacles.forEach((obstacle, obstacleIndex) => {
		if (!HAZARD_TYPES.has(obstacle.type)) return;
		if (!hazardAffectsApproach(stage, geometry[obstacleIndex])) {
			issues.push({ code: 'HAZARD_OFF_APPROACH_ROUTE', severity: 'warning', obstacleIndex });
		}
	});

	const terrainCoverageRatio = coverageRatio(terrainRectangles);
	if (terrainCoverageRatio < MIN_TERRAIN_COVERAGE_RATIO) {
		issues.push({
			code: 'TERRAIN_COVERAGE_TOO_SPARSE',
			severity: 'error',
			measuredValue: terrainCoverageRatio
		});
	}

	const silhouette = silhouetteMetrics(terrainRectangles);
	if (silhouette.spanRatio < MIN_SILHOUETTE_SPAN_RATIO || silhouette.heightBands < 2) {
		issues.push({
			code: 'TERRAIN_SILHOUETTE_TOO_SIMPLE',
			severity: 'warning',
			measuredValue: silhouette.spanRatio
		});
	}

	return {
		issues,
		issueCodes: issues.map((issue) => issue.code),
		severity: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'none',
		metrics: {
			drawingAnchorGap: anchorGap?.length,
			terrainCoverageRatio,
			silhouetteSpanRatio: silhouette.spanRatio,
			silhouetteHeightBands: silhouette.heightBands
		}
	};
}

function dogParticipatesInPuzzle(stage: StageData, geometry: readonly Rectangle[][]): boolean {
	return stage.obstacles.some((obstacle, index) => {
		// 모든 맵에 깔리는 바닥은 강아지가 퍼즐 구조와 상호작용한다는 증거가 아니다.
		if (obstacle.type === 'ground') return false;
		if (!ANCHOR_TYPES.has(obstacle.type) && !HAZARD_TYPES.has(obstacle.type)) return false;
		const limit = HAZARD_TYPES.has(obstacle.type) ? HAZARD_DOG_PROXIMITY : DOG_PUZZLE_PROXIMITY;
		return geometry[index].some((rectangle) => distancePointToRectangle(stage.dog, rectangle) <= limit);
	});
}

function auditDrawingAnchorGap(dog: Point, rectangles: readonly Rectangle[], issues: PuzzleDesignIssue[]): AnchorGap | undefined {
	const candidates: AnchorGap[] = [];
	for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
			const a = rectangles[leftIndex];
			const b = rectangles[rightIndex];
			const horizontal = horizontalGap(a, b);
			if (horizontal && distance(dog, horizontal.midpoint) <= MAX_ANCHOR_MIDPOINT_DISTANCE) candidates.push(horizontal);
			const vertical = verticalGap(a, b);
			if (vertical && distance(dog, vertical.midpoint) <= MAX_ANCHOR_MIDPOINT_DISTANCE) candidates.push(vertical);
		}
	}

	// 강아지와 가장 가까운 틈이 바닥 아래의 넓은 장식 여백일 수 있다.
	// 실제 공략선으로 쓸 수 있는 간격을 우선하고, 그 안에서 가까운 anchor를 선택한다.
	const viable = candidates.filter((candidate) =>
		candidate.length >= MIN_DRAWING_ANCHOR_GAP && candidate.length <= MAX_DRAWING_ANCHOR_GAP
	);
	const nearest = (viable.length > 0 ? viable : candidates)
		.sort((a, b) => distance(dog, a.midpoint) - distance(dog, b.midpoint))[0];
	if (!nearest) {
		issues.push({ code: 'DRAWING_ANCHOR_GAP_MISSING', severity: 'error' });
		return undefined;
	}
	if (nearest.length < MIN_DRAWING_ANCHOR_GAP) {
		issues.push({ code: 'DRAWING_ANCHOR_GAP_TOO_NARROW', severity: 'warning', measuredValue: nearest.length });
	} else if (nearest.length > MAX_DRAWING_ANCHOR_GAP) {
		issues.push({ code: 'DRAWING_ANCHOR_GAP_TOO_WIDE', severity: 'error', measuredValue: nearest.length });
	}
	return nearest;
}

function horizontalGap(a: Rectangle, b: Rectangle): AnchorGap | undefined {
	const [left, right] = a.minX <= b.minX ? [a, b] : [b, a];
	const length = right.minX - left.maxX;
	const overlapMin = Math.max(left.minY, right.minY);
	const overlapMax = Math.min(left.maxY, right.maxY);
	if (length <= 0 || overlapMax < overlapMin) return undefined;
	return { length, midpoint: { x: (left.maxX + right.minX) / 2, y: (overlapMin + overlapMax) / 2 } };
}

function verticalGap(a: Rectangle, b: Rectangle): AnchorGap | undefined {
	const [top, bottom] = a.minY <= b.minY ? [a, b] : [b, a];
	const length = bottom.minY - top.maxY;
	const overlapMin = Math.max(top.minX, bottom.minX);
	const overlapMax = Math.min(top.maxX, bottom.maxX);
	if (length <= 0 || overlapMax < overlapMin) return undefined;
	return { length, midpoint: { x: (overlapMin + overlapMax) / 2, y: (top.maxY + bottom.minY) / 2 } };
}

function hazardAffectsApproach(stage: StageData, rectangles: readonly Rectangle[]): boolean {
	const center = rectangleGroupCenter(rectangles);
	const radius = Math.max(...rectangles.map((rectangle) => Math.max(rectangle.maxX - rectangle.minX, rectangle.maxY - rectangle.minY))) / 2;
	if (distance(center, stage.dog) <= HAZARD_DOG_PROXIMITY + radius) return true;
	return stage.hives.some((hive) =>
		distancePointToSegment(center, { x: hive.x, y: hive.y }, stage.dog) <= HAZARD_ROUTE_HALF_WIDTH + radius
	);
}

function coverageRatio(rectangles: readonly Rectangle[]): number {
	const area = rectangles.reduce((sum, rectangle) => {
		const width = Math.max(0, Math.min(BASE_WORLD.width, rectangle.maxX) - Math.max(0, rectangle.minX));
		const height = Math.max(0, Math.min(BASE_WORLD.height, rectangle.maxY) - Math.max(0, rectangle.minY));
		return sum + width * height;
	}, 0);
	return Math.min(1, area / (BASE_WORLD.width * BASE_WORLD.height));
}

function silhouetteMetrics(rectangles: readonly Rectangle[]): { spanRatio: number; heightBands: number } {
	if (rectangles.length === 0) return { spanRatio: 0, heightBands: 0 };
	const minX = Math.max(0, Math.min(...rectangles.map((rectangle) => rectangle.minX)));
	const maxX = Math.min(BASE_WORLD.width, Math.max(...rectangles.map((rectangle) => rectangle.maxX)));
	const heightBands = new Set(rectangles.map((rectangle) => Math.round(rectangle.minY / SILHOUETTE_BAND_SIZE))).size;
	return { spanRatio: Math.max(0, maxX - minX) / BASE_WORLD.width, heightBands };
}

function obstacleRectangles(obstacle: ObstacleData): Rectangle[] {
	if (!obstacle.prefabId) return [rotatedRectangleBounds(obstacle.x, obstacle.y, obstacle.width, obstacle.height, obstacle.angle ?? 0)];

	const raw = flattenTerrainShape(getTerrainPrefab(obstacle.prefabId).shape);
	const sourceBounds = bounds(raw.flat());
	const scaleX = obstacle.width / (sourceBounds.maxX - sourceBounds.minX);
	const scaleY = obstacle.height / (sourceBounds.maxY - sourceBounds.minY);
	const sourceCenter = { x: (sourceBounds.minX + sourceBounds.maxX) / 2, y: (sourceBounds.minY + sourceBounds.maxY) / 2 };
	return raw.map((vertices) => bounds(vertices.map((point) => {
		const local = { x: (point.x - sourceCenter.x) * scaleX, y: (point.y - sourceCenter.y) * scaleY };
		const rotated = rotate(local, obstacle.angle ?? 0);
		return { x: obstacle.x + rotated.x, y: obstacle.y + rotated.y };
	})));
}

function flattenTerrainShape(shape: TerrainShapeSource): Point[][] {
	if (shape.kind === 'compound') return shape.parts.flatMap(flattenTerrainShape);
	if (shape.kind === 'polygon') return [shape.vertices.map((point) => ({ ...point }))];
	const halfWidth = shape.width / 2;
	const halfHeight = shape.height / 2;
	return [[
		{ x: -halfWidth, y: -halfHeight },
		{ x: halfWidth, y: -halfHeight },
		{ x: halfWidth, y: halfHeight },
		{ x: -halfWidth, y: halfHeight }
	].map((point) => {
		const rotated = rotate(point, shape.angle ?? 0);
		return { x: shape.x + rotated.x, y: shape.y + rotated.y };
	})];
}

function rotatedRectangleBounds(x: number, y: number, width: number, height: number, angle: number): Rectangle {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	return bounds([
		{ x: -halfWidth, y: -halfHeight },
		{ x: halfWidth, y: -halfHeight },
		{ x: halfWidth, y: halfHeight },
		{ x: -halfWidth, y: halfHeight }
	].map((point) => {
		const rotated = rotate(point, angle);
		return { x: x + rotated.x, y: y + rotated.y };
	}));
}

function bounds(points: readonly Point[]): Rectangle {
	return {
		minX: Math.min(...points.map((point) => point.x)),
		minY: Math.min(...points.map((point) => point.y)),
		maxX: Math.max(...points.map((point) => point.x)),
		maxY: Math.max(...points.map((point) => point.y))
	};
}

function rotate(point: Point, angle: number): Point {
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
}

function rectangleGroupCenter(rectangles: readonly Rectangle[]): Point {
	return {
		x: (Math.min(...rectangles.map((rectangle) => rectangle.minX)) + Math.max(...rectangles.map((rectangle) => rectangle.maxX))) / 2,
		y: (Math.min(...rectangles.map((rectangle) => rectangle.minY)) + Math.max(...rectangles.map((rectangle) => rectangle.maxY))) / 2
	};
}

function distancePointToRectangle(point: Point, rectangle: Rectangle): number {
	const dx = Math.max(rectangle.minX - point.x, 0, point.x - rectangle.maxX);
	const dy = Math.max(rectangle.minY - point.y, 0, point.y - rectangle.maxY);
	return Math.hypot(dx, dy);
}

function distancePointToSegment(point: Point, start: Point, end: Point): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return distance(point, start);
	const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
	return distance(point, { x: start.x + ratio * dx, y: start.y + ratio * dy });
}

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}
