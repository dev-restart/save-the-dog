import { PHYSICS } from '../constants.js';
import type { HiveData, ObstacleData, Point, StageData, StageDesignType, StageEnvironment } from '../types.js';
import { applyCampaignTerrainPattern } from './campaign-terrain-patterns.js';
import stageOverrides from './stage-overrides.json';

const ground = { type: 'ground' as const, x: 195, y: 660, width: 390, height: 20 };

interface StageOverride {
	dog?: Point;
	hives?: HiveData[];
	obstacles?: ObstacleData[];
	extraObstacles?: ObstacleData[];
	inkLimit?: number;
	survivalMs?: number;
	environment?: StageEnvironment;
	difficultyLabel?: string;
	designType?: StageDesignType;
	objectiveLabel?: string;
	objectiveHint?: string;
	dangerLabel?: string;
	designerNote?: string;
}

const STAGE_OVERRIDES = stageOverrides as Record<string, StageOverride>;

// 지형 기반 퍼즐 구조로 재설계된 정적 스테이지 블루프린트
// 원작 Save The Dog의 핵심 아키타입을 반영:
// - 지형이 퍼즐의 일부 (배경이 아닌 게임플레이 요소)
// - 지하/구덩이 구조 활용
// - 두 점 고정(앵커) 기술 요구
// - 비선형 난이도 (어려운 레벨 후 쉬운 레벨)
export const STATIC_STAGE_BLUEPRINTS: StageData[] = [
	// Stage 1: 평지 위 강아지 (튜토리얼) - 기본 그리기 학습
	{
		id: 1,
		dog: { x: 195, y: 570 },
		hives: [{ x: 195, y: 110, beeCount: 8, spawnIntervalMs: 320, beeForce: 0.0018 }],
		obstacles: [ground],
		inkLimit: 620,
		survivalMs: 3000,
		difficultyLabel: 'Tutorial',
		designType: 'basic-cover',
		objectiveLabel: '돔으로 벌 막기',
		objectiveHint: '강아지 위에 지붕을 그리고 양쪽 끝을 바닥에 닿게 하세요.',
		dangerLabel: '벌 직선 공격',
		designerNote: '한 번의 선으로 덮개를 만드는 기본 규칙만 학습하는 단계입니다.'
	},
	// Stage 2: 구덩이 속 강아지 (지형 활용 입문) - 지형이 3면을 막아줌
	{
		id: 2,
		dog: { x: 195, y: 610 },
		hives: [{ x: 195, y: 100, beeCount: 10, spawnIntervalMs: 300, beeForce: 0.0019 }],
		obstacles: [
			// 왼쪽 지면
			{ type: 'ground', x: 60, y: 660, width: 120, height: 20 },
			// 오른쪽 지면
			{ type: 'ground', x: 330, y: 660, width: 120, height: 20 },
			// 구덩이 왼쪽 벽
			{ type: 'brick', x: 120, y: 580, width: 30, height: 180 },
			// 구덩이 오른쪽 벽
			{ type: 'brick', x: 270, y: 580, width: 30, height: 180 },
			// 구덩이 바닥
			{ type: 'brick', x: 195, y: 650, width: 180, height: 20 }
		],
		inkLimit: 400,
		survivalMs: 5000,
		difficultyLabel: 'Pit',
		designType: 'terrain-pocket',
		objectiveLabel: '구덩이 위쪽만 막기',
		objectiveHint: '땅 속 구덩이의 양쪽 벽과 바닥이 이미 보호합니다. 위쪽 입구만 짧게 막으세요.',
		dangerLabel: '벌 직선 공격',
		designerNote: '지형이 이미 3면을 막아주는 첫 지형 활용 레벨입니다. 잉크를 아끼는 방법을 배웁니다.'
	},
	// Stage 3: 공중 플랫폼 위 강아지 (받침+보호 이중 목적)
	{
		id: 3,
		dog: { x: 195, y: 255 },
		hives: [{ x: 302, y: 100, beeCount: 12, spawnIntervalMs: 280, beeForce: 0.00195, attackStyle: 'flank-left' }],
		obstacles: [
			ground,
			{ type: 'water', x: 195, y: 632, width: 238, height: 36 },
			{ type: 'wood', x: 80, y: 558, width: 96, height: 16, angle: 0.08 },
			{ type: 'wood', x: 310, y: 558, width: 96, height: 16, angle: -0.08 },
			{ type: 'brick', x: 35, y: 570, width: 36, height: 120 },
			{ type: 'brick', x: 355, y: 570, width: 36, height: 120 }
		],
		inkLimit: 555,
		survivalMs: 5000,
		difficultyLabel: 'Fall Catch',
		designType: 'fall-catch',
		objectiveLabel: '떨어지기 전 받침',
		objectiveHint: '강아지 아래에 먼저 받침을 만든 뒤, 오른쪽에서 돌아오는 벌을 막는 덮개를 이어 그리세요.',
		dangerLabel: '낙하 + 물웅덩이',
		designerNote: '강아지가 공중에서 시작합니다. 닫힌 원보다 받침과 지붕을 이어 그리는 공략이 필요합니다.'
	},
	// Stage 4: 벌집 격리 (규칙 뒤집기) - 강아지가 아닌 벌집을 가둠
	{
		id: 4,
		dog: { x: 195, y: 570 },
		hives: [{ x: 195, y: 200, beeCount: 10, spawnIntervalMs: 300, beeForce: 0.0018 }],
		obstacles: [
			ground,
			// 벌집 주변을 둘러싼 벽 (왼쪽)
			{ type: 'brick', x: 140, y: 200, width: 20, height: 120 },
			// 벌집 주변을 둘러싼 벽 (오른쪽)
			{ type: 'brick', x: 250, y: 200, width: 20, height: 120 },
			// 벌집 위쪽 천장
			{ type: 'brick', x: 195, y: 140, width: 130, height: 20 }
		],
		inkLimit: 350,
		survivalMs: 5000,
		difficultyLabel: 'Hive Trap',
		designType: 'hive-box',
		objectiveLabel: '벌집 가두기',
		objectiveHint: '벌집 아래쪽이 열여 있습니다. 벌이 나오지 못하게 아래쪽 입구를 막으세요.',
		dangerLabel: '벌 탈출',
		designerNote: '강아지를 보호하는 대신 벌집을 가두는 역발상 레벨입니다. 지형이 이미 벌집을 3면 둘러싸고 있습니다.'
	},
	// Stage 5: 경사면 위 강아지 (앵커 기술)
	{
		id: 5,
		dog: { x: 102, y: 470 },
		hives: [{ x: 310, y: 92, beeCount: 15, spawnIntervalMs: 240, beeForce: 0.002, attackStyle: 'flank-left' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 105, y: 510, width: 104, height: 16 },
			{ type: 'brick', x: 206, y: 510, width: 32, height: 190 },
			{ type: 'brick', x: 352, y: 568, width: 36, height: 124 },
			{ type: 'water', x: 76, y: 632, width: 96, height: 36 },
			{ type: 'lava', x: 286, y: 632, width: 166, height: 36 },
			{ type: 'wood', x: 284, y: 475, width: 102, height: 16, angle: -0.12 },
			{ type: 'stone', x: 153, y: 620, width: 60, height: 60 }
		],
		inkLimit: 520,
		survivalMs: 5200,
		difficultyLabel: 'Pocket',
		designType: 'terrain-pocket',
		objectiveLabel: '기둥 옆 통로 봉쇄',
		objectiveHint: '중앙 벽 왼쪽 포켓을 덮고, 벌이 기둥 위로 우회하지 못하게 끝을 발판에 닿게 하세요.',
		dangerLabel: '우회 벌 + 양쪽 함정',
		designerNote: '기둥과 고정 바위는 선을 걸 수 있는 지지점입니다. 벌의 우회 경로와 하단 함정을 함께 고려하게 합니다.'
	},
	// Stage 6: 쉬운 레벨 (비선형 난이도 - 긴장 완화)
	{
		id: 6,
		dog: { x: 195, y: 570 },
		hives: [{ x: 195, y: 110, beeCount: 10, spawnIntervalMs: 300, beeForce: 0.0019 }],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 540, width: 140, height: 16 }
		],
		inkLimit: 550,
		survivalMs: 5000,
		difficultyLabel: 'Easy',
		designType: 'basic-cover',
		objectiveLabel: '넓은 지붕',
		objectiveHint: '발판 위에 넓은 지붕을 만들어 벌을 막으세요. 여유로운 잉크로 연습하세요.',
		dangerLabel: '벌 직선 공격',
		designerNote: '어려운 레벨 후의 휴식 레벨입니다. 넉넉한 잉크로 자신있게 그리세요.'
	},
	// Stage 7: 복수 벌집 (분산 방어)
	{
		id: 7,
		dog: { x: 195, y: 495 },
		hives: [
			{ x: 58, y: 105, beeCount: 10, spawnIntervalMs: 220, beeForce: 0.00205, attackStyle: 'flank-left' },
			{ x: 332, y: 120, beeCount: 10, spawnIntervalMs: 225, beeForce: 0.00205, attackStyle: 'flank-right' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 530, width: 110, height: 16 },
			{ type: 'brick', x: 82, y: 555, width: 36, height: 150 },
			{ type: 'brick', x: 308, y: 555, width: 36, height: 150 },
			{ type: 'water', x: 74, y: 632, width: 96, height: 36 },
			{ type: 'water', x: 316, y: 632, width: 96, height: 36 },
			{ type: 'spike', x: 195, y: 638, width: 84, height: 24 }
		],
		inkLimit: 500,
		survivalMs: 5350,
		difficultyLabel: 'Two Hives',
		designType: 'split-hive',
		objectiveLabel: '양쪽 벌집을 분리',
		objectiveHint: '두 벌집은 서로 반대 측면을 노립니다. 중앙 발판 위에 양쪽 모서리가 닫힌 지붕을 만드세요.',
		dangerLabel: '협동 측면 공격',
		designerNote: '벌집마다 left/right 역할을 지정해, 한 방향만 막는 선으로는 안전하지 않은 첫 복수 벌집 단계입니다.'
	},
	// Stage 8: 벽 앵커 (지형 고정)
	{
		id: 8,
		dog: { x: 95, y: 360 },
		hives: [{ x: 315, y: 92, beeCount: 19, spawnIntervalMs: 215, beeForce: 0.0021, attackStyle: 'breaker' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 95, y: 400, width: 104, height: 16 },
			{ type: 'wood', x: 245, y: 505, width: 100, height: 16, angle: -0.14 },
			{ type: 'brick', x: 354, y: 455, width: 36, height: 240 },
			{ type: 'brick', x: 44, y: 550, width: 34, height: 150 },
			{ type: 'water', x: 104, y: 632, width: 164, height: 36 },
			{ type: 'lava', x: 304, y: 632, width: 92, height: 36 },
			{ type: 'crate', x: 294, y: 570, width: 40, height: 40 }
		],
		inkLimit: 460,
		survivalMs: 5400,
		difficultyLabel: 'Wall Anchor',
		designType: 'anchor-wall',
		objectiveLabel: '벽에 기대기',
		objectiveHint: '오른쪽 긴 벽과 낮은 발판을 연결한 덮개를 그려, 아래 물길과 용암을 동시에 피하세요.',
		dangerLabel: '벽 우회 + 낙하',
		designerNote: 'breaker 역할의 벌은 방어선 가까운 지점을 압박합니다. 선은 강체로 형태를 유지하지만 중력과 충돌에는 반응합니다.'
	},
	// Stage 9: 측면 포켓 (우회 경로 차단)
	{
		id: 9,
		dog: { x: 285, y: 430 },
		hives: [{ x: 76, y: 95, beeCount: 19, spawnIntervalMs: 210, beeForce: 0.0021, attackStyle: 'flank-right' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 285, y: 470, width: 112, height: 16 },
			{ type: 'brick', x: 220, y: 505, width: 34, height: 182 },
			{ type: 'brick', x: 350, y: 560, width: 36, height: 136 },
			{ type: 'wood', x: 118, y: 530, width: 106, height: 16, angle: 0.12 },
			{ type: 'water', x: 96, y: 632, width: 136, height: 36 },
			{ type: 'spike', x: 262, y: 638, width: 92, height: 24 }
		],
		inkLimit: 455,
		survivalMs: 5450,
		difficultyLabel: 'Side Pocket',
		designType: 'terrain-pocket',
		objectiveLabel: '포켓 입구 닫기',
		objectiveHint: '중앙 기둥과 오른쪽 벽 사이의 포켓을 짧게 닫아, 왼쪽 측면 벌이 안쪽으로 파고들지 못하게 하세요.',
		dangerLabel: '측면 우회 + 가시',
		designerNote: '지형이 이미 세 면을 막아 주므로 긴 원보다 포켓의 열린 한 면을 찾는 것이 핵심입니다.'
	},
	// Stage 10: 압박 지지대 (복합 방어)
	{
		id: 10,
		dog: { x: 195, y: 295 },
		hives: [
			{ x: 78, y: 100, beeCount: 11, spawnIntervalMs: 205, beeForce: 0.00215, attackStyle: 'flank-left' },
			{ x: 312, y: 100, beeCount: 11, spawnIntervalMs: 205, beeForce: 0.00215, attackStyle: 'breaker' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 335, width: 104, height: 16 },
			{ type: 'brick', x: 72, y: 520, width: 36, height: 220 },
			{ type: 'brick', x: 318, y: 520, width: 36, height: 220 },
			{ type: 'wood', x: 116, y: 470, width: 88, height: 16, angle: 0.14 },
			{ type: 'wood', x: 274, y: 470, width: 88, height: 16, angle: -0.14 },
			{ type: 'lava', x: 195, y: 632, width: 234, height: 36 }
		],
		inkLimit: 440,
		survivalMs: 5600,
		difficultyLabel: 'Pressure Cage',
		designType: 'pressure-cage',
		objectiveLabel: '위쪽 덮개와 하단 받침',
		objectiveHint: '공중 발판 위의 강아지 아래를 받치고, 양쪽 벽을 잇는 덮개로 협동 벌의 진입각을 나누세요.',
		dangerLabel: '복수 벌집 + 용암',
		designerNote: '선은 깨지지 않지만, 고정할 지형을 잘못 고륵하면 벌의 여러 진입각을 모두 막을 수 없습니다.'
	},
	// Stage 11: 좁은 통로 (정밀 그리기)
	{
		id: 11,
		dog: { x: 76, y: 495 },
		hives: [{ x: 332, y: 104, beeCount: 20, spawnIntervalMs: 200, beeForce: 0.00215, attackStyle: 'direct' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 76, y: 535, width: 110, height: 16 },
			{ type: 'brick', x: 194, y: 475, width: 34, height: 205 },
			{ type: 'wood', x: 302, y: 530, width: 100, height: 16, angle: -0.1 },
			{ type: 'water', x: 195, y: 632, width: 154, height: 36 },
			{ type: 'lava', x: 332, y: 632, width: 70, height: 36 },
			{ type: 'brick', x: 38, y: 572, width: 34, height: 124 },
			{ type: 'crate', x: 302, y: 496, width: 52, height: 52 }
		],
		inkLimit: 435,
		survivalMs: 5650,
		difficultyLabel: 'Bridge Lock',
		designType: 'bridge-gap',
		objectiveLabel: '물길 위 통로 막기',
		objectiveHint: '중앙 기둥과 왼쪽 발판 사이의 틈을 덮어, 물길로 밀리지 않는 작은 방을 만드세요.',
		dangerLabel: '좁은 통로 + 물 + 상자',
		designerNote: '상자는 짧은 선을 걸 수 있는 지지점입니다. 지형으로 이미 가려진 면을 활용하면 적은 잉크로도 완성됩니다.'
	},
	// Stage 12: 함정 분지 (이중 보호)
	{
		id: 12,
		dog: { x: 314, y: 470 },
		hives: [
			{ x: 62, y: 108, beeCount: 12, spawnIntervalMs: 195, beeForce: 0.0022, attackStyle: 'flank-left' },
			{ x: 276, y: 100, beeCount: 10, spawnIntervalMs: 215, beeForce: 0.0022, attackStyle: 'flank-right' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 314, y: 510, width: 108, height: 16 },
			{ type: 'brick', x: 350, y: 532, width: 34, height: 184 },
			{ type: 'wood', x: 210, y: 500, width: 92, height: 16, angle: 0.18 },
			{ type: 'lava', x: 118, y: 632, width: 142, height: 36 },
			{ type: 'water', x: 282, y: 632, width: 112, height: 36 }
		],
		inkLimit: 420,
		survivalMs: 5750,
		difficultyLabel: 'Basin',
		designType: 'trap-basin',
		objectiveLabel: '함정 위 이중 보호',
		objectiveHint: '오른쪽 벽에 기대는 덮개와 발판 아래 받침을 한 선으로 이어, 물과 용암 사이로 떨어지지 않게 하세요.',
		dangerLabel: '분산 벌 + 양쪽 함정',
		designerNote: '벌의 진입각과 강아지 낙하 방향이 서로 달라, 원형보다 L자형 보호선이 유리한 단계입니다.'
	},
	// Stage 13: 경사 지붕 (기울기 활용)
	{
		id: 13,
		dog: { x: 195, y: 435 },
		hives: [
			{ x: 58, y: 92, beeCount: 12, spawnIntervalMs: 190, beeForce: 0.0022, attackStyle: 'flank-left' },
			{ x: 332, y: 92, beeCount: 12, spawnIntervalMs: 190, beeForce: 0.0022, attackStyle: 'flank-right' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 475, width: 112, height: 16 },
			{ type: 'brick', x: 195, y: 290, width: 168, height: 24, angle: -0.2 },
			{ type: 'wood', x: 90, y: 540, width: 102, height: 16, angle: 0.15 },
			{ type: 'wood', x: 300, y: 540, width: 102, height: 16, angle: -0.15 },
			{ type: 'lava', x: 195, y: 632, width: 186, height: 36 },
			{ type: 'water', x: 52, y: 632, width: 54, height: 36 },
			{ type: 'water', x: 338, y: 632, width: 54, height: 36 }
		],
		inkLimit: 410,
		survivalMs: 5800,
		difficultyLabel: 'Sloped Roof',
		designType: 'slope-slide',
		objectiveLabel: '기울어진 지붕 고정',
		objectiveHint: '상단 경사와 양쪽 낮은 발판을 이용해, 양쪽 벌을 튕겨 내는 기울어진 덮개를 만드세요.',
		dangerLabel: '양측 공격 + 용암',
		designerNote: '상단 구조는 출발점, 양쪽 발판은 끝점을 잡아 주는 시각적 힌트입니다.'
	},
	// Stage 14: 낙하 관문 (공중 받침)
	{
		id: 14,
		dog: { x: 108, y: 285 },
		hives: [{ x: 300, y: 84, beeCount: 23, spawnIntervalMs: 185, beeForce: 0.00225, attackStyle: 'breaker' }],
		obstacles: [
			ground,
			{ type: 'water', x: 112, y: 632, width: 148, height: 36 },
			{ type: 'lava', x: 298, y: 632, width: 118, height: 36 },
			{ type: 'brick', x: 42, y: 535, width: 34, height: 190 },
			{ type: 'brick', x: 240, y: 520, width: 34, height: 210 },
			{ type: 'wood', x: 174, y: 542, width: 114, height: 16, angle: 0.1 },
			{ type: 'wood', x: 320, y: 505, width: 82, height: 16, angle: -0.18 },
			{ type: 'crate', x: 320, y: 470, width: 40, height: 40 }
		],
		inkLimit: 400,
		survivalMs: 5900,
		difficultyLabel: 'Falling Gate',
		designType: 'fall-catch',
		objectiveLabel: '공중에서 받침 만들기',
		objectiveHint: '공중의 강아지 아래에서 중앙 기둥까지 선을 내리고, 위쪽을 덮어 낙하와 벌을 함께 막으세요.',
		dangerLabel: '낙하 + breaker 벌',
		designerNote: '낙하를 막는 선이 그대로 측면 차단벽도 되도록 설계한 복합 공략입니다.'
	},
	// Stage 15: 반대 경사 (미러 퍼즐)
	{
		id: 15,
		dog: { x: 280, y: 300 },
		hives: [{ x: 70, y: 84, beeCount: 23, spawnIntervalMs: 185, beeForce: 0.00225, attackStyle: 'flank-right' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 280, y: 340, width: 102, height: 16, angle: -0.18 },
			{ type: 'brick', x: 42, y: 520, width: 34, height: 210 },
			{ type: 'brick', x: 290, y: 505, width: 34, height: 220 },
			{ type: 'wood', x: 110, y: 520, width: 106, height: 16, angle: 0.16 },
			{ type: 'water', x: 86, y: 632, width: 120, height: 36 },
			{ type: 'spike', x: 250, y: 638, width: 86, height: 24 },
			{ type: 'lava', x: 348, y: 632, width: 52, height: 36 }
		],
		inkLimit: 390,
		survivalMs: 6000,
		difficultyLabel: 'Mirror Slide',
		designType: 'slope-slide',
		objectiveLabel: '반대 경사 잠그기',
		objectiveHint: '오른쪽 경사 위 강아지를 중앙 기둥에 연결해, 왼쪽에서 오는 벌과 아래 가시를 동시에 피하세요.',
		dangerLabel: '고속 측면 벌 + 가시',
		designerNote: '14단계의 낙하 논리를 반대 방향 경사와 좁은 잉크 제한으로 변형한 단계입니다.'
	},
	// Stage 16: 벌집 상자 (격리 심화)
	{
		id: 16,
		dog: { x: 195, y: 495 },
		hives: [
			{ x: 68, y: 100, beeCount: 13, spawnIntervalMs: 180, beeForce: 0.0023, attackStyle: 'flank-left' },
			{ x: 322, y: 100, beeCount: 13, spawnIntervalMs: 180, beeForce: 0.0023, attackStyle: 'flank-right' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 530, width: 106, height: 16 },
			{ type: 'brick', x: 112, y: 470, width: 34, height: 180 },
			{ type: 'brick', x: 278, y: 470, width: 34, height: 180 },
			{ type: 'water', x: 70, y: 632, width: 88, height: 36 },
			{ type: 'lava', x: 195, y: 632, width: 126, height: 36 },
			{ type: 'water', x: 320, y: 632, width: 88, height: 36 },
			{ type: 'wood', x: 195, y: 388, width: 112, height: 16 }
		],
		inkLimit: 375,
		survivalMs: 6100,
		difficultyLabel: 'Hive Box',
		designType: 'hive-box',
		objectiveLabel: '감옥형 지지대',
		objectiveHint: '양쪽 기둥 사이에서 아래 받침과 위 덮개를 한 번에 이어, 벌이 위와 옆으로 새지 않게 하세요.',
		dangerLabel: '양쪽 벌집 + 세 갈래 함정',
		designerNote: '지형으로 만든 상자 안에 강아지를 두되, 완전히 닫힌 원보다 구조물에 연결되는 안정적인 선을 유도합니다.'
	},
	// Stage 17: 계단 낙하 (다층 지형)
	{
		id: 17,
		dog: { x: 84, y: 285 },
		hives: [{ x: 330, y: 85, beeCount: 25, spawnIntervalMs: 175, beeForce: 0.00235, attackStyle: 'flank-left' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 84, y: 325, width: 94, height: 16, angle: 0.12 },
			{ type: 'wood', x: 190, y: 425, width: 92, height: 16, angle: 0.18 },
			{ type: 'wood', x: 302, y: 525, width: 98, height: 16, angle: 0.12 },
			{ type: 'brick', x: 44, y: 535, width: 34, height: 190 },
			{ type: 'water', x: 78, y: 632, width: 102, height: 36 },
			{ type: 'spike', x: 232, y: 638, width: 116, height: 24 },
			{ type: 'lava', x: 350, y: 632, width: 46, height: 36 },
			{ type: 'stone', x: 280, y: 580, width: 54, height: 54 }
		],
		inkLimit: 365,
		survivalMs: 6200,
		difficultyLabel: 'Stair Drop',
		designType: 'slope-slide',
		objectiveLabel: '계단형 낙하 방지',
		objectiveHint: '왼쪽 상단에서 시작해 계단 발판에 걸치는 선을 만들고, 중앙 가시 위로 미끄러지지 않게 덮으세요.',
		dangerLabel: '계단 + 가시 + 물',
		designerNote: '선의 끝이 비어 있으면 낙하 방지선이지만, 계단 두 점을 잇으면 벌 차단벽까지 겸합니다.'
	},
	// Stage 18: 역방향 계단 (미러)
	{
		id: 18,
		dog: { x: 306, y: 285 },
		hives: [{ x: 60, y: 85, beeCount: 25, spawnIntervalMs: 175, beeForce: 0.00235, attackStyle: 'flank-right' }],
		obstacles: [
			ground,
			{ type: 'wood', x: 306, y: 325, width: 94, height: 16, angle: -0.12 },
			{ type: 'wood', x: 200, y: 425, width: 92, height: 16, angle: -0.18 },
			{ type: 'wood', x: 88, y: 525, width: 98, height: 16, angle: -0.12 },
			{ type: 'brick', x: 346, y: 535, width: 34, height: 190 },
			{ type: 'lava', x: 312, y: 632, width: 102, height: 36 },
			{ type: 'spike', x: 158, y: 638, width: 116, height: 24 },
			{ type: 'water', x: 40, y: 632, width: 48, height: 36 }
		],
		inkLimit: 360,
		survivalMs: 6250,
		difficultyLabel: 'Mirror Stair',
		designType: 'slope-slide',
		objectiveLabel: '역방향 계단 봉쇄',
		objectiveHint: '오른쪽 상단에서 중앙 발판까지 받침을 내리고, 왼쪽에서 오는 벌을 막는 L자 보호선을 그리세요.',
		dangerLabel: '역방향 계단 + 용암',
		designerNote: '17단계와 지형을 반전해 같은 그림을 반복하는 대신 방향을 읽게 만듭니다.'
	},
	// Stage 19: 교차 화력 포켓 (복합 방어)
	{
		id: 19,
		dog: { x: 195, y: 405 },
		hives: [
			{ x: 195, y: 78, beeCount: 15, spawnIntervalMs: 170, beeForce: 0.0024, attackStyle: 'breaker' },
			{ x: 56, y: 142, beeCount: 11, spawnIntervalMs: 210, beeForce: 0.0023, attackStyle: 'flank-left' }
		],
		obstacles: [
			ground,
			{ type: 'wood', x: 195, y: 445, width: 102, height: 16 },
			{ type: 'brick', x: 122, y: 505, width: 34, height: 184 },
			{ type: 'brick', x: 268, y: 505, width: 34, height: 184 },
			{ type: 'wood', x: 78, y: 540, width: 84, height: 16, angle: 0.12 },
			{ type: 'wood', x: 312, y: 540, width: 84, height: 16, angle: -0.12 },
			{ type: 'water', x: 80, y: 632, width: 106, height: 36 },
			{ type: 'lava', x: 310, y: 632, width: 106, height: 36 },
			{ type: 'spike', x: 195, y: 638, width: 74, height: 24 }
		],
		inkLimit: 350,
		survivalMs: 6500,
		difficultyLabel: 'Crossfire Pocket',
		designType: 'terrain-pocket',
		objectiveLabel: '상단과 측면 동시 차단',
		objectiveHint: '두 기둥 사이의 포켓에서 위쪽과 왼쪽을 같이 닫고, 아래 가시로 밀리지 않을 받침을 남기세요.',
		dangerLabel: '상단 breaker + 측면 벌',
		designerNote: '벌집 위치와 역할이 다릅니다. 하나의 직선으로는 두 접근로를 모두 막을 수 없도록 구성했습니다.'
	},
	// Stage 20: 최종 복합 (모든 규칙 종합)
	{
		id: 20,
		dog: { x: 195, y: 255 },
		hives: [
			{ x: 62, y: 86, beeCount: 15, spawnIntervalMs: 165, beeForce: 0.00245, attackStyle: 'flank-left' },
			{ x: 328, y: 86, beeCount: 15, spawnIntervalMs: 165, beeForce: 0.00245, attackStyle: 'flank-right' }
		],
		obstacles: [
			ground,
			{ type: 'brick', x: 62, y: 495, width: 40, height: 260 },
			{ type: 'brick', x: 328, y: 495, width: 40, height: 260 },
			{ type: 'wood', x: 108, y: 498, width: 86, height: 16, angle: 0.14 },
			{ type: 'wood', x: 282, y: 498, width: 86, height: 16, angle: -0.14 },
			{ type: 'brick', x: 195, y: 555, width: 34, height: 142 },
			{ type: 'water', x: 84, y: 632, width: 112, height: 36 },
			{ type: 'lava', x: 195, y: 632, width: 98, height: 36 },
			{ type: 'lava', x: 306, y: 632, width: 112, height: 36 },
			{ type: 'spike', x: 195, y: 500, width: 70, height: 24 },
			{ type: 'crate', x: 270, y: 460, width: 54, height: 54 }
		],
		inkLimit: 335,
		survivalMs: 6900,
		difficultyLabel: 'Final Composite',
		designType: 'final-composite',
		objectiveLabel: '낙하, 덮개, 양쪽 통로',
		objectiveHint: '공중의 강아지 아래 받침을 중앙 기둥에 연결하고, 양쪽 벽까지 이어지는 덮개로 두 벌집의 진입로를 모두 닫으세요.',
		dangerLabel: '협동 벌 + 세 갈래 함정 + 상자',
		designerNote: '최종 단계는 공중 시작, 복수 벌집, 역할 분담, 물·용암·가시·상자를 함께 배치한 완성형 맵입니다.'
	}
];

export function applyStageOverride(stage: StageData): StageData {
	const override = STAGE_OVERRIDES[String(stage.id)];
	if (!override) return applyCampaignTerrainPattern(stage);

	return applyCampaignTerrainPattern({
		...stage,
		dog: override.dog ?? stage.dog,
		hives: override.hives ?? stage.hives,
		obstacles: resolveStageObstacles(stage, override),
		inkLimit: override.inkLimit ?? stage.inkLimit,
		survivalMs: override.survivalMs ?? stage.survivalMs,
		environment: override.environment ?? stage.environment,
		difficultyLabel: override.difficultyLabel ?? stage.difficultyLabel,
		designType: override.designType ?? stage.designType,
		objectiveLabel: override.objectiveLabel ?? stage.objectiveLabel,
		objectiveHint: override.objectiveHint ?? stage.objectiveHint,
		dangerLabel: override.dangerLabel ?? stage.dangerLabel,
		designerNote: override.designerNote ?? stage.designerNote
	});
}

function resolveStageObstacles(stage: StageData, override: StageOverride): ObstacleData[] {
	if (override.obstacles) return override.obstacles;

	const extraObstacles = override.extraObstacles ?? [];
	if (extraObstacles.length === 0) return stage.obstacles;

	const extraHazards = extraObstacles.filter(isPoolHazard);
	const baseObstacles = stage.obstacles.filter((obstacle) => {
		if (obstacle.type !== 'spike') return true;
		return !extraHazards.some((hazard) => overlapsObstacle(obstacle, hazard, 8));
	});

	return [...baseObstacles, ...extraObstacles];
}

function isPoolHazard(obstacle: ObstacleData): boolean {
	return obstacle.type === 'water' || obstacle.type === 'lava';
}

function overlapsObstacle(a: ObstacleData, b: ObstacleData, padding = 0): boolean {
	const aBox = obstacleBox(a, padding);
	const bBox = obstacleBox(b, padding);

	return aBox.left < bBox.right && aBox.right > bBox.left && aBox.top < bBox.bottom && aBox.bottom > bBox.top;
}

function obstacleBox(obstacle: ObstacleData, padding: number): { left: number; right: number; top: number; bottom: number } {
	return {
		left: obstacle.x - obstacle.width / 2 - padding,
		right: obstacle.x + obstacle.width / 2 + padding,
		top: obstacle.y - obstacle.height / 2 - padding,
		bottom: obstacle.y + obstacle.height / 2 + padding
	};
}

export const STATIC_STAGES: StageData[] = STATIC_STAGE_BLUEPRINTS.map(applyStageOverride);

export const FIRST_STAGE_ID = 1;
export const MAX_STATIC_STAGE_ID = STATIC_STAGE_BLUEPRINTS.length;
export const MAX_AUTHORED_STAGE_ID = Math.max(
	MAX_STATIC_STAGE_ID,
	...Object.keys(STAGE_OVERRIDES).map((stageId) => Number(stageId)).filter(Number.isFinite)
);
export const FALLBACK_STAGE: StageData = applyStageOverride({
	id: 1,
	dog: { x: 195, y: 530 },
	hives: [{ x: 195, y: 105, beeCount: 8, spawnIntervalMs: 320 }],
	obstacles: [ground],
	inkLimit: PHYSICS.defaultInkLimit,
	survivalMs: PHYSICS.defaultSurvivalMs,
	difficultyLabel: 'Tutorial',
	objectiveLabel: '강아지 보호',
	objectiveHint: '벌과 위험 지형을 동시에 막으세요.',
	dangerLabel: '벌 공격'
});
