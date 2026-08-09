import { PHYSICS } from '../constants.js';
import type { BeeAttackStyle, HiveData, ObstacleData, Point, StageData, StageDesignType } from '../types.js';
import { getCampaignChapter, getCampaignSlot } from './campaign.js';

interface LoopLayout {
	designType: StageDesignType;
	dog: Point;
	hives: Array<Point & { attackStyle: BeeAttackStyle }>;
	obstacles: ObstacleData[];
	objectiveLabel: string;
	objectiveHint: string;
	dangerLabel: string;
	environment?: StageData['environment'];
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
	if (stageId <= 30) return Math.min(4.6, 1.15 + (stageId - 20) * 0.12);
	return Math.min(4.25, 1.9 + (stageId - 31) * 0.035);
}

function ground(): ObstacleData {
	return { type: 'ground', x: 195, y: 660, width: 390, height: 20 };
}

function createLoopLayout(stageId: number): LoopLayout {
	if (stageId >= 31) return createCampaignLayout(stageId);
	const designType = LOOP_DESIGN_TYPES[(stageId - 21) % LOOP_DESIGN_TYPES.length];
	const mirrored = Math.floor((stageId - 21) / LOOP_DESIGN_TYPES.length) % 2 === 1;
	const layout = createBaseLayout(designType);
	return mirrored ? mirrorLayout(layout) : layout;
}

function createCampaignLayout(stageId: number): LoopLayout {
	const chapter = getCampaignChapter(stageId);
	const slot = getCampaignSlot(stageId);
	const mirrored = slot % 2 === 0;
	const layout = createCampaignBaseLayout(chapter.id, slot);
	const varied = addCampaignVariant(layout, chapter.id, slot);
	return mirrored ? mirrorLayout(varied) : varied;
}

function campaignGround(): ObstacleData {
	return { type: 'ground', x: 195, y: 660, width: 390, height: 20 };
}

function campaignBlock(type: ObstacleData['type'], x: number, y: number, width: number, height: number, angle?: number): ObstacleData {
	return { type, x, y, width, height, ...(angle === undefined ? {} : { angle }) };
}

function createCampaignBaseLayout(chapterId: number, slot: number): LoopLayout {
	const tilt = slot % 3 === 0 ? 0.12 : slot % 3 === 1 ? -0.14 : 0.08;

	switch (chapterId) {
		case 4:
			return {
				designType: 'anchor-wall', dog: { x: 104, y: 430 },
				hives: [{ x: 316, y: 92, attackStyle: slot % 2 === 0 ? 'direct' : 'breaker' }],
				obstacles: [campaignGround(), campaignBlock('brick', 42, 540, 36, 220), campaignBlock('brick', 348, 520, 36, 260), campaignBlock('wood', 106, 474, 112, 16, tilt), campaignBlock('wood', 258, 390, 112, 16, -tilt), campaignBlock('bomb', 270, 500, 40, 40), campaignBlock(slot % 2 === 0 ? 'water' : 'lava', 195, 632, 190, 36)],
				objectiveLabel: '퓨즈보다 먼저 고정', objectiveHint: '폭탄에 선을 직접 기대지 말고, 왼쪽 발판과 중앙 지형에 짧은 받침을 걸어 폭발 뒤에도 강아지를 지키세요.', dangerLabel: '폭탄 + 양쪽 벽', environment: 'volcanic'
			};
		case 5:
			return {
				designType: 'slope-slide', dog: { x: 286, y: 300 },
				hives: [{ x: 72, y: 92, attackStyle: slot % 2 === 0 ? 'flank-right' : 'direct' }],
				obstacles: [campaignGround(), campaignBlock('brick', 48, 530, 36, 260), campaignBlock('wood', 286, 350, 116, 16, -tilt), campaignBlock('wood', 194, 438, 112, 16, tilt), campaignBlock('wood', 104, 530, 106, 16, tilt), campaignBlock('rolling-boulder', 220, 250, 56, 56), campaignBlock('stone', 312, 520, 52, 52), campaignBlock(slot % 2 === 0 ? 'water' : 'spike', 195, 632, 168, 36)],
				objectiveLabel: '굴림돌의 길 바꾸기', objectiveHint: '높은 경사 아래에 먼저 받침을 만들고 낮은 발판을 연결하세요. 굴림돌이 강아지 쪽으로 곧장 떨어지지 않아야 합니다.', dangerLabel: '중력 + 경사 + 굴림돌', environment: 'forest'
			};
		case 6:
			return {
				designType: 'bridge-gap', dog: { x: 92, y: 470 },
				hives: [{ x: 320, y: 88, attackStyle: slot % 2 === 0 ? 'flank-left' : 'breaker' }],
				obstacles: [campaignGround(), campaignBlock('brick', 42, 560, 38, 200), campaignBlock('brick', 348, 560, 38, 200), campaignBlock('wood', 92, 512, 118, 16), campaignBlock('wood', 286, 474, 112, 16, -tilt), campaignBlock('stone', 194, 500, 52, 52), campaignBlock(slot % 3 === 0 ? 'lava' : 'acid', 195, 632, 228, 36)],
				objectiveLabel: '끊어진 발판 잇기', objectiveHint: '양쪽 벽과 중앙 돌을 지지점으로 사용해 한쪽으로 기울어진 다리를 만들고, 위험한 바닥 위에 선을 오래 두지 마세요.', dangerLabel: '용암 수로 + 틈', environment: 'volcanic'
			};
		case 7:
			return {
				designType: 'split-hive', dog: { x: 195, y: 470 },
				hives: [{ x: 58, y: 94, attackStyle: 'flank-left' }, { x: 332, y: 112, attackStyle: 'flank-right' }],
				obstacles: [campaignGround(), campaignBlock('brick', 76, 530, 36, 260), campaignBlock('brick', 314, 530, 36, 260), campaignBlock('wood', 195, 500, 116, 16, tilt), campaignBlock('no-draw-tree', 195, 320, 68, 130), campaignBlock(slot % 2 === 0 ? 'water' : 'lava', 92, 632, 92, 36), campaignBlock('spike', 284, 638, 84, 24)],
				objectiveLabel: '두 진입축 분리', objectiveHint: '왼쪽과 오른쪽 벌집의 진입 방향이 다릅니다. 양쪽 벽을 앵커로 삼아 중앙의 열린 면을 나누어 막으세요.', dangerLabel: '복수 벌집 + 금지 나무', environment: 'forest'
			};
		case 8:
			return {
				designType: 'terrain-pocket', dog: { x: 102, y: 410 },
				hives: [{ x: 314, y: 92, attackStyle: 'flank-left' }, { x: 70, y: 128, attackStyle: 'breaker' }],
				obstacles: [campaignGround(), campaignBlock('no-draw-zone', 220, 310, 126, 112), campaignBlock('no-draw-rock', 304, 470, 68, 92, -tilt), campaignBlock('brick', 208, 530, 36, 260), campaignBlock('wood', 104, 458, 112, 16), campaignBlock('ice', 300, 548, 112, 16, -tilt), campaignBlock('water', 94, 632, 136, 36)],
				objectiveLabel: '금지된 면 피하기', objectiveHint: '붉은 금지 지형에는 선을 그을 수 없습니다. 왼쪽 발판과 중앙 기둥 사이의 열린 면만 짧게 닫으세요.', dangerLabel: '그리기 금지 + 얼음', environment: 'forest'
			};
		case 9:
			return {
				designType: 'pressure-cage', dog: { x: 195, y: 285 },
				hives: [{ x: 68, y: 94, attackStyle: 'flank-left' }, { x: 322, y: 94, attackStyle: 'breaker' }],
				obstacles: [campaignGround(), campaignBlock('brick', 72, 520, 36, 260), campaignBlock('brick', 318, 520, 36, 260), campaignBlock('wood', 195, 330, 112, 16), campaignBlock('wood', 122, 470, 92, 16, tilt), campaignBlock('wood', 268, 470, 92, 16, -tilt), campaignBlock('bomb', 195, 420, 40, 40), campaignBlock('rolling-boulder', 300, 250, 54, 54), campaignBlock(slot % 2 === 0 ? 'lava' : 'water', 195, 632, 228, 36)],
				objectiveLabel: '연쇄 위험 순서 바꾸기', objectiveHint: '폭탄과 굴림돌을 강아지 위에 가두지 마세요. 양쪽 벽에 받침을 고정한 뒤, 위험물의 경로가 바깥으로 빠지게 하세요.', dangerLabel: '폭탄 + 굴림돌 + 양측 공격', environment: 'volcanic'
			};
		default:
			return {
				designType: 'final-composite', dog: { x: 195, y: 350 },
				hives: [{ x: 52, y: 88, attackStyle: 'flank-left' }, { x: 195, y: 82, attackStyle: 'direct' }, { x: 338, y: 102, attackStyle: 'breaker' }],
				obstacles: [campaignGround(), campaignBlock('brick', 52, 540, 36, 260), campaignBlock('brick', 338, 540, 36, 260), campaignBlock('brick', 195, 550, 34, 220), campaignBlock('wood', 195, 400, 112, 16, tilt), campaignBlock('wood', 110, 470, 92, 16, 0.16), campaignBlock('wood', 280, 470, 92, 16, -0.16), campaignBlock('rolling-boulder', 130, 275, 56, 56), campaignBlock('bomb', 270, 300, 40, 40), campaignBlock('no-draw-zone', 195, 190, 120, 72), campaignBlock('water', 82, 632, 90, 36), campaignBlock('lava', 195, 632, 112, 36), campaignBlock('spike', 314, 638, 80, 24)],
				objectiveLabel: '마지막 설계도 완성', objectiveHint: '먼저 낙하를 받을 지점을 만들고, 세 벌집의 서로 다른 진입축을 벽과 발판에 나누어 고정하세요. 금지 영역과 위험물은 마지막에 피합니다.', dangerLabel: '복수 벌집 + 복합 물리', environment: 'volcanic'
			};
	}
}

function addCampaignVariant(layout: LoopLayout, chapterId: number, slot: number): LoopLayout {
	const extras: ObstacleData[] = [];
	if (slot % 3 === 1) extras.push(campaignBlock(chapterId >= 8 ? 'crate' : 'stone', 136, 520, 52, 52));
	if (slot % 3 === 2) extras.push(campaignBlock(chapterId >= 7 ? 'no-draw-rock' : 'crate', 250, 560, 54, 54, slot % 2 === 0 ? 0.08 : -0.08));
	return { ...layout, obstacles: [...layout.obstacles, ...extras] };
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
					{ type: 'crate', x: 286, y: 478, width: 52, height: 52 },
					{ type: 'no-draw-zone', x: 250, y: 350, width: 100, height: 70 }
				],
				objectiveLabel: '포켓의 열린 면 찾기',
				objectiveHint: '중앙 기둥과 왼쪽 경계가 만든 포켓의 열린 위쪽만 막고, 벌의 우회 경로는 기둥 반대편에서 끊으세요. 붉은 영역에는 선을 그릴 수 없습니다.',
				dangerLabel: '포켓 우회 + 가시 + 그리기 금지'
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
					{ type: 'bomb', x: 195, y: 430, width: 40, height: 40 },
					{ type: 'no-draw-zone', x: 195, y: 200, width: 120, height: 80 }
				],
				objectiveLabel: '상단 덮개와 하단 받침',
				objectiveHint: '공중 발판 아래에 받침을 내리고 양쪽 벽까지 덮개를 이어, 두 역할의 벌이 만나는 틈을 없애세요. 붉은 영역에는 선을 그릴 수 없습니다.',
				dangerLabel: '복수 벌집 + 용암 + 그리기 금지'
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
	const chapter = stageId >= 31 ? getCampaignChapter(stageId) : undefined;
	const inkLimit = stageId >= 31
		? Math.max(315, Math.floor(520 - (stageId - 31) * 2.1))
		: Math.max(280, Math.floor(550 - (stageId - 20) * 9));

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
		inkLimit,
		survivalMs: PHYSICS.defaultSurvivalMs,
		environment: layout.environment ?? (layout.obstacles.some((obstacle) => obstacle.type === 'lava' || obstacle.type === 'bomb') ? 'volcanic' : 'meadow'),
		difficultyLabel: chapter ? `챕터 ${chapter.id} · ${chapter.title} · ${getCampaignSlot(stageId)}-10` : `Loop ${stageId - 20} · ${DESIGN_LABELS[layout.designType]}`,
		designType: layout.designType,
		objectiveLabel: layout.objectiveLabel,
		objectiveHint: layout.objectiveHint,
		dangerLabel: layout.dangerLabel,
		designerNote: chapter
			? `${chapter.mechanic} 좌우 방향과 보조 오브젝트를 바꿔도 지지점·낙하·위험물 규칙이 유지되는 저작형 변형입니다.`
			: '반복 단계도 무작위 장애물 조합이 아니라, 지정된 지형 퍼즐 archetype을 좌우 반전·압박 보정해 생성합니다.'
	};
}
