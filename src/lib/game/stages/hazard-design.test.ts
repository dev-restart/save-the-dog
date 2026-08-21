import { describe, expect, it } from 'vitest';
import type { StageData } from '../types.js';
import { getStage } from './index.js';
import { auditHazardDesign } from './hazard-design.js';

function stage(overrides: Partial<StageData> = {}): StageData {
	return {
		id: 999,
		dog: { x: 195, y: 500 },
		hives: [],
		obstacles: [],
		inkLimit: 300,
		survivalMs: 3000,
		...overrides
	};
}

describe('hazard design contract', () => {
	it('폭탄은 강아지에게 90~170px 떨어져 있거나 필수 anchor를 폭발 반경에 둔다', () => {
		const directThreat = stage({ obstacles: [{ type: 'bomb', x: 195, y: 350, width: 42, height: 42 }] });
		const anchorThreat = stage({
			dog: { x: 195, y: 400 },
			obstacles: [
				{ type: 'terrain-block', x: 195, y: 500, width: 60, height: 60 },
				{ type: 'bomb', x: 195, y: 580, width: 42, height: 42 }
			]
		});
		const irrelevantBomb = stage({ obstacles: [{ type: 'bomb', x: 20, y: 20, width: 42, height: 42 }] });

		expect(auditHazardDesign(directThreat).issueCodes).toEqual([]);
		expect(auditHazardDesign(anchorThreat).issueCodes).toEqual([]);
		expect(auditHazardDesign(irrelevantBomb)).toMatchObject({ issueCodes: ['BOMB_DISTANCE_OUT_OF_RANGE'], severity: 'error' });
	});

	it('굴림돌은 유효 경사와 안전실을 가로지르는 투영 경로를 모두 요구한다', () => {
		const meaningful = stage({
			obstacles: [
				{ type: 'rolling-boulder', x: 150, y: 230, width: 54, height: 54 },
				{ type: 'wood', x: 200, y: 300, width: 180, height: 16, angle: 0.2 }
			]
		});
		const wrongAngle = stage({
			obstacles: [
				{ type: 'rolling-boulder', x: 150, y: 230, width: 54, height: 54 },
				{ type: 'wood', x: 200, y: 300, width: 180, height: 16, angle: 0.1 }
			]
		});
		const tooSteep = stage({
			obstacles: [
				{ type: 'rolling-boulder', x: 150, y: 230, width: 54, height: 54 },
				{ type: 'wood', x: 200, y: 300, width: 180, height: 16, angle: 0.6 }
			]
		});
		const missedPath = stage({
			obstacles: [
				{ type: 'rolling-boulder', x: 50, y: 230, width: 54, height: 54 },
				{ type: 'wood', x: 100, y: 300, width: 180, height: 16, angle: 0.2 }
			]
		});
		const noSlope = stage({ obstacles: [{ type: 'rolling-boulder', x: 150, y: 230, width: 54, height: 54 }] });

		expect(auditHazardDesign(meaningful).issueCodes).toEqual([]);
		expect(auditHazardDesign(wrongAngle).issueCodes).toEqual(['ROLLING_BOULDER_SLOPE_ANGLE_OUT_OF_RANGE']);
		expect(auditHazardDesign(tooSteep).issueCodes).toEqual(['ROLLING_BOULDER_SLOPE_ANGLE_OUT_OF_RANGE']);
		expect(auditHazardDesign(missedPath)).toMatchObject({ issueCodes: ['ROLLING_BOULDER_PATH_MISSES_TARGET'], severity: 'warning' });
		expect(auditHazardDesign(noSlope).issueCodes).toEqual(['ROLLING_BOULDER_MISSING_SLOPE']);
	});

	it('상자는 제거 시 48px 이상 gap을 만들거나 강아지 주변의 필수 anchor여야 한다', () => {
		const bridge = stage({
			obstacles: [
				{ type: 'platform', x: 110, y: 500, width: 100, height: 16 },
				{ type: 'crate', x: 195, y: 500, width: 52, height: 52 },
				{ type: 'platform', x: 280, y: 500, width: 100, height: 16 }
			]
		});
		const decoration = stage({ obstacles: [{ type: 'crate', x: 20, y: 20, width: 52, height: 52 }] });
		const smallGap = stage({
			dog: { x: 320, y: 500 },
			obstacles: [
				{ type: 'platform', x: 150, y: 500, width: 60, height: 16 },
				{ type: 'crate', x: 195, y: 500, width: 52, height: 52 },
				{ type: 'platform', x: 230, y: 500, width: 60, height: 16 }
			]
		});

		expect(auditHazardDesign(bridge).issueCodes).toEqual([]);
		expect(auditHazardDesign(decoration)).toMatchObject({ issueCodes: ['CRATE_NO_GAP_OR_ANCHOR'], severity: 'warning' });
		expect(auditHazardDesign(smallGap).issueCodes).toEqual(['CRATE_GAP_TOO_SMALL']);
	});
});

describe('current campaign hazard audit', () => {
	it('campaign 5/6/8/9/10의 현재 위험물 역할을 명시적으로 기록한다', () => {
		const auditByStage = Object.fromEntries([5, 6, 8, 9, 10].map((id) => [id, auditHazardDesign(getStage(id)).issueCodes]));

		expect(auditByStage).toEqual({
			5: [],
			6: [],
			8: [],
			9: [],
			10: []
		});
	});
});
