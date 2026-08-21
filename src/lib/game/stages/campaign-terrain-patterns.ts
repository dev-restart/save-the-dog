import type { HiveData, ObstacleData, StageData } from '../types.js';

type CampaignPattern = Partial<Omit<StageData, 'id'>>;
const ground: ObstacleData = { type: 'ground', x: 195, y: 660, width: 390, height: 20 };
const terrain = (x: number, y: number, width: number, height: number, angle?: number): ObstacleData => ({ type: 'terrain-block', x, y, width, height, angle });
const wood = (x: number, y: number, width: number, angle = 0): ObstacleData => ({ type: 'wood', x, y, width, height: 16, angle });
const prefab = (prefabId: NonNullable<ObstacleData['prefabId']>, x: number, y: number, width: number, height: number, type: ObstacleData['type'] = 'terrain-block'): ObstacleData => ({
	type, prefabId, x, y, width, height
});
const hive = (x: number, y: number, beeCount: number, attackStyle: HiveData['attackStyle'] = 'direct'): HiveData => ({
	x, y, beeCount, attackStyle, spawnIntervalMs: Math.max(200, 340 - beeCount * 7), beeForce: 0.0017 + beeCount * 0.000025
});

const CAMPAIGN_PATTERNS: Record<number, CampaignPattern> = {
	1: {
		dog: { x: 195, y: 552 }, hives: [hive(195, 118, 8)],
		obstacles: [ground, prefab('u-shelter', 195, 550, 250, 190), terrain(195, 638, 330, 34)],
		inkLimit: 300, designType: 'basic-cover', objectiveLabel: 'ㄷ자 방의 열린 천장 닫기',
		objectiveHint: '두 잔디 턱 사이만 짧게 이어 강아지 방의 천장을 완성하세요.', dangerLabel: '위쪽 직선 벌',
		designerNote: '큰 ㄷ자 실루엣 안에서 정답 anchor 두 곳이 즉시 읽히는 입문 퀴즈입니다.'
	},
	2: {
		dog: { x: 182, y: 540 }, hives: [hive(312, 145, 10)],
		obstacles: [ground, prefab('stepped-basin', 195, 542, 300, 235), { type: 'water', x: 195, y: 638, width: 120, height: 28 }],
		inkLimit: 285, designType: 'bridge-gap', objectiveLabel: '높이가 다른 턱 잇기',
		objectiveHint: '왼쪽 높은 턱에서 오른쪽 안쪽 턱으로 한 번 꺾어 벌의 대각선 길을 닫으세요.', dangerLabel: '대각선 진입 벌 + 물',
		designerNote: '계단형 분지의 서로 다른 높이를 읽어 짧은 꺾은선으로 막는 퀴즈입니다.'
	},
	3: {
		dog: { x: 132, y: 430 }, hives: [hive(325, 235, 11, 'flank-left')],
		obstacles: [ground, prefab('cliff-pocket-left', 148, 390, 290, 400), terrain(320, 340, 70, 200), wood(302, 410, 118, -0.24), { type: 'water', x: 205, y: 638, width: 250, height: 30 }],
		inkLimit: 310, designType: 'fall-catch', objectiveLabel: '떨어지기 전 받침',
		objectiveHint: '동굴 절벽의 위 턱과 안쪽 바닥을 사선으로 이어 낙하와 벌을 함께 막으세요.', dangerLabel: '낙하 + 물웅덩이',
		designerNote: '샘플처럼 큰 절벽 아래 빈 동굴이 하나의 실루엣으로 읽히는 낙하 퀴즈입니다.'
	},
	4: {
		dog: { x: 250, y: 535 }, hives: [hive(66, 160, 13, 'flank-right')],
		obstacles: [ground, prefab('cliff-pocket-right', 235, 405, 300, 390), terrain(116, 535, 90, 220), { type: 'lava', x: 55, y: 638, width: 92, height: 30 }],
		inkLimit: 300, designType: 'anchor-wall', objectiveLabel: '뒤집힌 진입 방향 읽기',
		objectiveHint: '왼쪽 벌의 각도를 보고 절벽 입구를 짧은 비대칭 선으로 잠그세요.', dangerLabel: '왼쪽 우회 벌 + 용암',
		designerNote: '3단계 절벽을 좌우 반전해 실루엣보다 공격 방향을 먼저 읽도록 만듭니다.'
	},
	5: {
		dog: { x: 195, y: 530 }, hives: [hive(195, 105, 15)],
		obstacles: [ground, prefab('arch-shelter', 195, 438, 310, 290, 'stone'), prefab('u-shelter', 195, 555, 175, 155), prefab('bomb-niche', 305, 570, 110, 118, 'stone')],
		inkLimit: 275, designType: 'hive-box', objectiveLabel: '돌 아치 안쪽 방 닫기',
		objectiveHint: '안쪽 잔디 턱만 짧게 닫고 오른쪽 돌 홈의 폭탄과 선을 떨어뜨리세요.', dangerLabel: '상단 벌 + 폭탄 반경',
		designerNote: '큰 돌 아치 안에 작은 흙 안전실을 중첩해 정답과 폭탄 회피가 한눈에 보입니다.'
	},
	6: {
		dog: { x: 286, y: 565 }, hives: [hive(65, 112, 16, 'flank-right')],
		obstacles: [ground, prefab('slope-left', 132, 365, 260, 190), prefab('u-shelter', 286, 555, 170, 160), wood(132, 310, 190, 0.24), terrain(208, 510, 62, 170), { type: 'water', x: 75, y: 638, width: 135, height: 30 }],
		inkLimit: 290, designType: 'slope-slide', objectiveLabel: '돌이 닿기 전 통로 잠그기',
		objectiveHint: '큰 흙 경사 끝과 안전실 왼쪽 턱을 이어 굴림돌과 벌의 길을 함께 끊으세요.', dangerLabel: '실제 굴림 경사 + 물',
		designerNote: '굴림돌이 장식이 아니라 정답 anchor를 향해 내려오는 첫 동적 물리 퀴즈입니다.'
	},
	7: {
		dog: { x: 195, y: 550 }, hives: [hive(55, 125, 10, 'flank-left'), hive(335, 125, 10, 'flank-right')],
		obstacles: [ground, prefab('split-pillars', 195, 485, 300, 300, 'stone'), prefab('stepped-basin', 195, 570, 220, 155), { type: 'spike', x: 195, y: 640, width: 88, height: 20 }],
		inkLimit: 310, designType: 'split-hive', objectiveLabel: '엇갈린 두 기둥 사이 닫기',
		objectiveHint: '높이가 다른 돌기둥 안쪽 턱을 한 번 꺾어 이어 양쪽 벌을 나누세요.', dangerLabel: '양측 협동 벌 + 중앙 가시',
		designerNote: '단순 대칭 ㄷ자 대신 높이가 다른 돌기둥과 분지를 하나의 큰 괄호형 퀴즈로 구성합니다.'
	},
	8: {
		dog: { x: 195, y: 550 },
		hives: [{ ...hive(325, 105, 20, 'breaker'), spawnIntervalMs: 260 }],
		obstacles: [
			ground,
			prefab('u-shelter', 195, 550, 200, 200),
			prefab('slope-right', 300, 330, 190, 150),
			wood(280, 330, 150, -0.28),
			{ type: 'water', x: 45, y: 638, width: 70, height: 30 },
			{ type: 'lava', x: 350, y: 638, width: 60, height: 30 }
		],
		inkLimit: 260, survivalMs: 5400, designType: 'terrain-pocket', objectiveLabel: '굴림돌이 들어오는 안전실 닫기',
		objectiveHint: '강아지 위 두 잔디 턱을 짧은 가로선으로 이어 벌과 굴림돌을 함께 막으세요.', dangerLabel: '파괴 벌 + 오른쪽 굴림돌 + 외곽 물·용암',
		designerNote: '중앙 ㄷ자 안전실의 열린 천장이 명확한 정답 anchor가 되고, 오른쪽 경사의 굴림돌은 방어선이 없으면 강아지에게 닿습니다.'
	},
	9: {
		dog: { x: 286, y: 510 }, hives: [hive(72, 108, 22, 'flank-right')],
		obstacles: [ground, prefab('cliff-pocket-right', 248, 390, 290, 400), prefab('bomb-niche', 145, 555, 112, 120, 'stone'), wood(108, 405, 140, 0.2), { type: 'spike', x: 205, y: 640, width: 80, height: 20 }, { type: 'lava', x: 55, y: 638, width: 90, height: 30 }],
		inkLimit: 275, designType: 'terrain-pocket', objectiveLabel: '옆 포켓을 폭탄과 분리하기',
		objectiveHint: '돌 홈 위 턱과 오른쪽 절벽 어깨를 이어 벌을 막고 폭탄 반경은 비워 두세요.', dangerLabel: '측면 벌 + 폭탄 + 가시',
		designerNote: '하나의 오른쪽 절벽 실루엣과 왼쪽 폭탄 홈 사이에 정답 통로가 선명하게 남습니다.'
	},
	10: {
		dog: { x: 195, y: 552 }, hives: [hive(62, 120, 13, 'flank-left'), hive(328, 126, 13, 'breaker')],
		obstacles: [ground, prefab('u-shelter', 195, 510, 260, 180, 'stone'), wood(160, 260, 150, -0.45)],
		inkLimit: 315, survivalMs: 7000, designType: 'pressure-cage', objectiveLabel: '중앙 돌방의 열린 천장 닫기',
		objectiveHint: '돌방 위의 넓은 입구를 가운데가 살짝 높은 얕은 ∧선으로 덮으세요.', dangerLabel: '양측 협동 벌 + 중앙 굴림돌',
		designerNote: '열린 U자 돌방 위에 얕은 지붕을 걸어 양쪽 벌과 중앙으로 떨어지는 굴림돌을 함께 막는 종합 퀴즈입니다.'
	}
};

const DYNAMIC_HAZARDS: Record<number, ObstacleData[]> = {
	5: [{ type: 'bomb', x: 305, y: 590, width: 42, height: 42 }],
	6: [{ type: 'rolling-boulder', x: 150, y: 270, width: 54, height: 54 }],
	8: [{ type: 'rolling-boulder', x: 300, y: 200, width: 54, height: 54 }],
	9: [{ type: 'bomb', x: 145, y: 575, width: 42, height: 42 }],
	10: [{ type: 'rolling-boulder', x: 230, y: 180, width: 54, height: 54 }],
	11: [{ type: 'bomb', x: 302, y: 575, width: 42, height: 42 }],
	13: [{ type: 'rolling-boulder', x: 246, y: 230, width: 54, height: 54 }],
	16: [{ type: 'bomb', x: 195, y: 590, width: 42, height: 42 }],
	18: [{ type: 'rolling-boulder', x: 236, y: 382, width: 54, height: 54 }],
	20: [{ type: 'rolling-boulder', x: 286, y: 448, width: 54, height: 54 }, { type: 'bomb', x: 104, y: 570, width: 42, height: 42 }]
};

export function applyCampaignTerrainPattern(stage: StageData): StageData {
	const pattern = CAMPAIGN_PATTERNS[stage.id];
	const patterned: StageData = pattern ? { ...stage, ...pattern, id: stage.id } : stage;
	const hazards = DYNAMIC_HAZARDS[stage.id];
	if (!hazards) return patterned;
	const dangerLabel = patterned.dangerLabel ?? '벌 공격';
	const missingHazardLabels = [...new Set(hazards.map((hazard) => hazard.type === 'bomb' ? '폭탄' : '굴림돌'))]
		.filter((label) => !dangerLabel.includes(label));
	return {
		...patterned,
		obstacles: [...patterned.obstacles, ...hazards],
		dangerLabel: missingHazardLabels.length > 0 ? `${dangerLabel} + ${missingHazardLabels.join('·')}` : dangerLabel,
		designerNote: `${patterned.designerNote ?? ''} 동적 위험물의 이동 경로와 벌의 진입로를 한 선에서 분리해야 합니다.`.trim()
	};
}
