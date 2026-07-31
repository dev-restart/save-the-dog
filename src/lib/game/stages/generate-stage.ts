import { PHYSICS } from '../constants.js';
import type { BeeAttackStyle, HiveData, ObstacleData, Point, StageData, StageDesignType } from '../types.js';

interface LoopLayout {
	designType: StageDesignType;
	dog: Point;
	hives: Array<Point & { attackStyle: BeeAttackStyle }>;
	obstacles: ObstacleData[];
	objectiveLabel: string;
	objectiveHint: string;
	dangerLabel: string;
}

const LOOP_DESIGN_TYPES: StageDesignType[] = [
	'fall-catch',
	'anchor-wall',
	'split-hive',
	'terrain-pocket',
	'slope-slide',
	'pressure-cage'
];

const DESIGN_LABELS: Record<StageDesignType, string> = {
	'basic-cover': '기본 보호막',
	'fall-catch': '낙하 받침',
	'bridge-gap': '틈 가로막기',
	'anchor-wall': '벽 앵커',
	'trap-basin': '하단 함정',
	'split-hive': '복수 벌집',
	'terrain-pocket': '지형 포켓',
	'hive-box': '벌집 상자',
	'slope-slide': '경사 잠금',
	'pressure-cage': '압박 지지대',
	'final-composite': '복합 최종형'
};

function getDifficultyFactor(stageId: number): number {
	return Math.min(4.6, 1.15 + (stageId - 20) * 0.12);
}

function ground(): ObstacleData {
	return { type: 'ground', x: 195, y: 660, width: 390, height: 20 };
}

function createLoopLayout(stageId: number): LoopLayout {
	const designType = LOOP_DESIGN_TYPES[(stageId - 21) % LOOP_DESIGN_TYPES.length];
	const mirrored = Math.floor((stageId - 21) / LOOP_DESIGN_TYPES.length) % 2 === 1;
	const layout = createBaseLayout(designType);
	return mirrored ? mirrorLayout(layout) : layout;
}

function createBaseLayout(designType: StageDesignType): LoopLayout {
	switch (designType) {
		case 'fall-catch':
			return {
				designType,
				dog: { x: 195, y: 250 },
				hives: [{ x: 306, y: 96, attackStyle: 'flank-left' }],
				obstacles: [
					ground(),
					{ type: 'water', x: 195, y: 632, width: 236, height: 36 },
					{ type: 'wood', x: 78, y: 558, width: 96, height: 16, angle: 0.08 },
					{ type: 'wood', x: 312, y: 558, width: 96, height: 16, angle: -0.08 },
					{ type: 'brick', x: 38, y: 558, width: 34, height: 142 },
					{ type: 'brick', x: 352, y: 558, width: 34, height: 142 }
				],
				objectiveLabel: '낙하 전에 받침 연결',
				objectiveHint: '공중 강아지 아래 받침을 양쪽 낮은 발판 중 하나까지 이어 그리고, 남은 선으로 위쪽을 덮으세요.',
				dangerLabel: '낙하 + 물웅덩이'
			};
		case 'anchor-wall':
			return {
				designType,
				dog: { x: 98, y: 480 },
				hives: [{ x: 316, y: 100, attackStyle: 'direct' }],
				obstacles: [
					ground(),
					{ type: 'wood', x: 100, y: 520, width: 108, height: 16 },
					{ type: 'brick', x: 44, y: 548, width: 36, height: 164 },
					{ type: 'brick', x: 238, y: 532, width: 34, height: 198 },
					{ type: 'wood', x: 310, y: 500, width: 92, height: 16, angle: -0.14 },
					{ type: 'water', x: 98, y: 632, width: 126, height: 36 },
					{ type: 'lava', x: 290, y: 632, width: 154, height: 36 },
					{ type: 'boulder', x: 154, y: 620, width: 58, height: 58 }
				],
				objectiveLabel: '벽과 발판에 고정',
				objectiveHint: '왼쪽 벽과 중앙 기둥 사이에 짧은 덮개를 고정해, 아래 물과 용암으로 떨어지지 않게 하세요.',
				dangerLabel: '양쪽 함정 + 우회 벌'
			};
		case 'split-hive':
			return {
				designType,
				dog: { x: 195, y: 490 },
				hives: [
					{ x: 58, y: 100, attackStyle: 'flank-left' },
					{ x: 332, y: 100, attackStyle: 'flank-right' }
				],
				obstacles: [
					ground(),
					{ type: 'wood', x: 195, y: 530, width: 108, height: 16 },
					{ type: 'brick', x: 84, y: 558, width: 36, height: 142 },
					{ type: 'brick', x: 306, y: 558, width: 36, height: 142 },
					{ type: 'water', x: 78, y: 632, width: 96, height: 36 },
					{ type: 'lava', x: 312, y: 632, width: 96, height: 36 },
					{ type: 'spike', x: 195, y: 638, width: 78, height: 24 }
				],
				objectiveLabel: '양쪽 벌집 교차 차단',
				objectiveHint: '두 벌집이 서로 다른 측면을 노립니다. 중앙 발판 위에 양쪽 모서리가 닫힌 지붕을 만드세요.',
				dangerLabel: '협동 측면 공격'
			};
		case 'terrain-pocket':
			return {
				designType,
				dog: { x: 100, y: 420 },
				hives: [{ x: 322, y: 92, attackStyle: 'flank-left' }],
				obstacles: [
					ground(),
					{ type: 'wood', x: 102, y: 460, width: 106, height: 16 },
					{ type: 'brick', x: 200, y: 490, width: 34, height: 222 },
					{ type: 'brick', x: 354, y: 552, width: 34, height: 154 },
					{ type: 'wood', x: 286, y: 518, width: 100, height: 16, angle: -0.12 },
					{ type: 'water', x: 82, y: 632, width: 112, height: 36 },
					{ type: 'spike', x: 284, y: 638, width: 96, height: 24 },
					{ type: 'crate', x: 286, y: 478, width: 52, height: 52 }
				],
				objectiveLabel: '포켓의 열린 면 찾기',
				objectiveHint: '중앙 기둥과 왼쪽 경계가 만든 포켓의 열린 위쪽만 막고, 벌의 우회 경로는 기둥 반대편에서 끊으세요.',
				dangerLabel: '포켓 우회 + 가시'
			};
		case 'slope-slide':
			return {
				designType,
				dog: { x: 84, y: 285 },
				hives: [{ x: 330, y: 84, attackStyle: 'flank-left' }],
				obstacles: [
					ground(),
					{ type: 'wood', x: 84, y: 326, width: 96, height: 16, angle: 0.13 },
					{ type: 'wood', x: 192, y: 426, width: 94, height: 16, angle: 0.18 },
					{ type: 'wood', x: 304, y: 528, width: 100, height: 16, angle: 0.1 },
					{ type: 'brick', x: 40, y: 540, width: 34, height: 186 },
					{ type: 'water', x: 76, y: 632, width: 100, height: 36 },
					{ type: 'spike', x: 222, y: 638, width: 114, height: 24 },
					{ type: 'lava', x: 352, y: 632, width: 42, height: 36 },
					{ type: 'boulder', x: 280, y: 580, width: 54, height: 54 }
				],
				objectiveLabel: '계단 경사 잠그기',
				objectiveHint: '첫 발판에서 두 번째 계단까지 선을 걸고, 마지막 모서리를 덮어 미끄럼과 벌 진입을 함께 막으세요.',
				dangerLabel: '경사 + 가시 + 물'
			};
		case 'pressure-cage':
			return {
				designType,
				dog: { x: 195, y: 290 },
				hives: [
					{ x: 70, y: 96, attackStyle: 'flank-left' },
					{ x: 320, y: 96, attackStyle: 'breaker' }
				],
				obstacles: [
					ground(),
					{ type: 'wood', x: 195, y: 330, width: 106, height: 16 },
					{ type: 'brick', x: 72, y: 516, width: 36, height: 224 },
					{ type: 'brick', x: 318, y: 516, width: 36, height: 224 },
					{ type: 'wood', x: 116, y: 468, width: 88, height: 16, angle: 0.14 },
					{ type: 'wood', x: 274, y: 468, width: 88, height: 16, angle: -0.14 },
					{ type: 'lava', x: 195, y: 632, width: 230, height: 36 },
					{ type: 'bomb', x: 195, y: 430, width: 40, height: 40 }
				],
				objectiveLabel: '상단 덮개와 하단 받침',
				objectiveHint: '공중 발판 아래에 받침을 내리고 양쪽 벽까지 덮개를 이어, 두 역할의 벌이 만나는 틈을 없애세요.',
				dangerLabel: '복수 벌집 + 용암'
			};
		default:
			return createBaseLayout('fall-catch');
	}
}

function mirrorLayout(layout: LoopLayout): LoopLayout {
	return {
		...layout,
		dog: mirrorPoint(layout.dog),
		hives: layout.hives.map((hive) => ({
			...mirrorPoint(hive),
			attackStyle: mirrorAttackStyle(hive.attackStyle)
		})),
		obstacles: layout.obstacles.map(mirrorObstacle)
	};
}

function mirrorPoint(point: Point): Point {
	return { x: 390 - point.x, y: point.y };
}

function mirrorObstacle(obstacle: ObstacleData): ObstacleData {
	return {
		...obstacle,
		x: 390 - obstacle.x,
		angle: obstacle.angle === undefined ? undefined : -obstacle.angle
	};
}

function mirrorAttackStyle(style: BeeAttackStyle): BeeAttackStyle {
	if (style === 'flank-left') return 'flank-right';
	if (style === 'flank-right') return 'flank-left';
	return style;
}

export function generateStage(stageId: number): StageData {
	const difficulty = getDifficultyFactor(stageId);
	const layout = createLoopLayout(stageId);
	const totalBeeCount = Math.min(PHYSICS.maxActiveBees, Math.floor(13 + difficulty * 4.3));
	const spawnIntervalMs = Math.max(115, Math.floor(235 - difficulty * 27));
	const beeForce = Math.min(0.0032, 0.0019 + difficulty * 0.0002);

	return {
		id: stageId,
		dog: layout.dog,
		hives: layout.hives.map((hive) => ({
			x: hive.x,
			y: hive.y,
			beeCount: Math.max(8, Math.ceil(totalBeeCount / layout.hives.length)),
			spawnIntervalMs,
			beeForce,
			attackStyle: hive.attackStyle
		} satisfies HiveData)),
		obstacles: layout.obstacles,
		inkLimit: Math.max(280, Math.floor(550 - (stageId - 20) * 9)),
		survivalMs: PHYSICS.defaultSurvivalMs,
		environment: layout.obstacles.some((obstacle) => obstacle.type === 'lava' || obstacle.type === 'bomb') ? 'volcanic' : 'meadow',
		difficultyLabel: `Loop ${stageId - 20} · ${DESIGN_LABELS[layout.designType]}`,
		designType: layout.designType,
		objectiveLabel: layout.objectiveLabel,
		objectiveHint: layout.objectiveHint,
		dangerLabel: layout.dangerLabel,
		designerNote: '반복 단계도 무작위 장애물 조합이 아니라, 지정된 지형 퍼즐 archetype을 좌우 반전·압박 보정해 생성합니다.'
	};
}
