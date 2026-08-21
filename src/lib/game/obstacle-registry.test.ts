import { describe, expect, it } from 'vitest';

import {
	EDITOR_OBSTACLE_TOOL_ITEMS,
	OBSTACLE_TYPES,
	getObstacleSpec,
	isObstacleType
} from './obstacle-registry.js';

describe('obstacle registry', () => {
	it('각 장애물 spec은 editor와 schema가 공유하는 기본 메타데이터를 가진다', () => {
		for (const kind of OBSTACLE_TYPES) {
			const spec = getObstacleSpec(kind);
			expect(spec.label.length).toBeGreaterThan(0);
			expect(spec.defaultSize.width).toBeGreaterThan(0);
			expect(spec.defaultSize.height).toBeGreaterThan(0);
			expect(typeof spec.blocksDrawing).toBe('boolean');
			expect(isObstacleType(kind)).toBe(true);
		}
	});

	it('동적 위험물은 Drawing을 사전 차단하지 않고 지형은 차단한다', () => {
		expect(getObstacleSpec('bomb').blocksDrawing).toBe(false);
		expect(getObstacleSpec('rolling-boulder').blocksDrawing).toBe(false);
		expect(getObstacleSpec('terrain-block').blocksDrawing).toBe(true);
		expect(getObstacleSpec('no-draw-zone').blocksDrawing).toBe(true);
	});

	it('editor tool 목록은 registry에서 허용된 장애물만 정의 순서대로 파생한다', () => {
		const expectedKinds = OBSTACLE_TYPES.filter((kind) => getObstacleSpec(kind).editor.available);
		expect(EDITOR_OBSTACLE_TOOL_ITEMS.map((item) => item.kind)).toEqual(expectedKinds);
		expect(EDITOR_OBSTACLE_TOOL_ITEMS.map((item) => item.label)).toEqual(
			expectedKinds.map((kind) => getObstacleSpec(kind).label)
		);
	});
});
