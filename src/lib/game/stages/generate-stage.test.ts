import { describe, expect, it } from 'vitest';
import { getStage } from './index.js';
import { generateStage } from './generate-stage.js';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_STAGE_COUNT, getCampaignChapter } from './campaign.js';

describe('generateStage', () => {
	it('21단계 이후에도 같은 단계는 같은 지형 퍼즐로 생성한다', () => {
		const first = generateStage(24);
		const second = generateStage(24);

		expect(second).toEqual(first);
		expect(first.obstacles[0]?.type).toBe('ground');
		expect(first.designType).toBeTruthy();
		expect(first.obstacles.some((obstacle) => obstacle.type === 'brick' || obstacle.type === 'wood')).toBe(true);
		expect(first.obstacles.some((obstacle) => obstacle.type === 'water' || obstacle.type === 'lava')).toBe(true);
		expect(first.obstacles.some((obstacle) => ['bomb', 'boulder', 'crate'].includes(obstacle.type))).toBe(true);
		expect(first.environment).toBe('meadow');
	});

	it('반복 단계는 여섯 가지 지형 퍼즐 archetype을 순환하고 좌우 반전한다', () => {
		const stages = Array.from({ length: 12 }, (_, index) => generateStage(21 + index));
		const designTypes = new Set(stages.map((stage) => stage.designType));

		expect(designTypes.size).toBe(6);
		expect(generateStage(21).dog.x).toBeCloseTo(195);
		expect(generateStage(27).dog.x).toBeCloseTo(195);
		expect(generateStage(22).dog.x).not.toBe(generateStage(28).dog.x);
		expect(generateStage(22).environment).toBe('volcanic');
	});

	it('단계가 올라갈수록 벌/스폰 압박을 높이고 잉크를 줄인다', () => {
		const early = generateStage(21);
		const late = generateStage(45);
		const earlyBeeCount = early.hives.reduce((total, hive) => total + hive.beeCount, 0);
		const lateBeeCount = late.hives.reduce((total, hive) => total + hive.beeCount, 0);

		expect(lateBeeCount).toBeGreaterThanOrEqual(earlyBeeCount);
		expect(Math.min(...late.hives.map((hive) => hive.spawnIntervalMs))).toBeLessThanOrEqual(
			Math.min(...early.hives.map((hive) => hive.spawnIntervalMs))
		);
		expect(late.inkLimit).toBeLessThan(early.inkLimit);
		expect(late.survivalMs).toBeGreaterThanOrEqual(early.survivalMs);
	});

	it('생성 단계에도 공략 목표와 위험 정보를 붙인다', () => {
		const stage = generateStage(28);

		expect(stage.objectiveLabel).toBeTruthy();
		expect(stage.objectiveHint).toContain('덮개');
		expect(stage.dangerLabel).toContain('벌');
	});

	it('31~100단계는 7개 후반 챕터의 결정적인 퍼즐 변형으로 생성된다', () => {
		const stages = Array.from({ length: CAMPAIGN_STAGE_COUNT - 30 }, (_, index) => getStage(index + 31));
		const fingerprints = new Set(stages.map((stage) => JSON.stringify({ dog: stage.dog, hives: stage.hives, obstacles: stage.obstacles })));
		const obstacleTypes = new Set(stages.flatMap((stage) => stage.obstacles.map((obstacle) => obstacle.type)));

		expect(stages).toHaveLength(70);
		expect(fingerprints).toHaveLength(70);
		expect(new Set(stages.map((stage) => getCampaignChapter(stage.id).id))).toEqual(new Set([4, 5, 6, 7, 8, 9, 10]));
		for (const type of ['bomb', 'rolling-boulder', 'no-draw-zone', 'no-draw-tree', 'no-draw-rock', 'lava', 'acid', 'ice'] as const) {
			expect(obstacleTypes.has(type), `후반 캠페인에 ${type}이(가) 있어야 합니다`).toBe(true);
		}
	});

	it('1~100단계는 플레이 가능한 기본 맵 계약을 모두 만족한다', () => {
		for (let stageId = 1; stageId <= CAMPAIGN_STAGE_COUNT; stageId += 1) {
			const stage = getStage(stageId);
			expect(stage.id, `stage ${stageId} id`).toBe(stageId);
			expect(stage.hives.length, `stage ${stageId} hives`).toBeGreaterThanOrEqual(1);
			expect(stage.hives.length, `stage ${stageId} hives`).toBeLessThanOrEqual(3);
			expect(stage.obstacles.some((obstacle) => obstacle.type === 'ground'), `stage ${stageId} ground`).toBe(true);
			expect(stage.objectiveLabel, `stage ${stageId} objective`).toBeTruthy();
			expect(stage.objectiveHint, `stage ${stageId} hint`).toBeTruthy();
			expect(stage.dangerLabel, `stage ${stageId} danger`).toBeTruthy();
			expect(stage.survivalMs, `stage ${stageId} survival`).toBe(10000);
			for (const obstacle of stage.obstacles) {
				expect(obstacle.x - obstacle.width / 2, `stage ${stageId} obstacle left`).toBeGreaterThanOrEqual(-20);
				expect(obstacle.x + obstacle.width / 2, `stage ${stageId} obstacle right`).toBeLessThanOrEqual(410);
				expect(obstacle.y - obstacle.height / 2, `stage ${stageId} obstacle top`).toBeGreaterThanOrEqual(-20);
				expect(obstacle.y + obstacle.height / 2, `stage ${stageId} obstacle bottom`).toBeLessThanOrEqual(730);
			}
		}
		expect(CAMPAIGN_CHAPTERS).toHaveLength(10);
	});
});

describe('static stage puzzle maps', () => {
	it('1~20단계는 단계별 지형 퍼즐 오브젝트를 명시적으로 가진다', () => {
		for (let stageId = 2; stageId <= 20; stageId += 1) {
			const stage = getStage(stageId);
			expect(stage.designType, `stage ${stageId} design type`).toBeTruthy();
			expect(
				stage.obstacles.some((obstacle) => ['brick', 'wood', 'water', 'lava'].includes(obstacle.type)),
				`stage ${stageId} needs terrain`
			).toBe(true);
		}
	});

	it('3단계는 물 위 공중 시작으로 낙하 받침을 요구한다', () => {
		const stage = getStage(3);
		const hasNearSupport = stage.obstacles.some(
			(obstacle) =>
				!['ground', 'water', 'lava', 'spike'].includes(obstacle.type) &&
				Math.abs(obstacle.x - stage.dog.x) < obstacle.width / 2 + 20 &&
				obstacle.y > stage.dog.y &&
				obstacle.y < 610
		);

		expect(stage.objectiveLabel).toBe('떨어지기 전 받침');
		expect(stage.dangerLabel).toBe('낙하 + 물웅덩이');
		expect(hasNearSupport).toBe(false);
	});

	it('7단계는 두 벌집이 서로 다른 측면 공격 역할을 갖는다', () => {
		const stage = getStage(7);

		expect(stage.hives).toHaveLength(2);
		expect(stage.hives.map((hive) => hive.attackStyle)).toEqual(['flank-left', 'flank-right']);
	});

	it('20단계는 공중 시작과 복합 지형을 함께 사용한다', () => {
		const stage = getStage(20);
		const types = new Set(stage.obstacles.map((obstacle) => obstacle.type));

		expect(stage.dog.y).toBeLessThan(300);
		expect(stage.hives).toHaveLength(2);
		for (const type of ['water', 'lava', 'brick', 'wood', 'spike', 'crate'] as const) {
			expect(types.has(type), `stage 20 should include ${type}`).toBe(true);
		}
		expect(stage.environment).toBe('volcanic');
	});

	it('실제 게임과 같은 10초 방어 시간을 모든 고정 단계에 적용한다', () => {
		for (let stageId = 1; stageId <= 20; stageId += 1) {
			expect(getStage(stageId).survivalMs, `stage ${stageId} survival time`).toBe(10000);
		}
	});

	it('21~30단계는 반복 생성이 아닌 JSON 저작 챌린지 맵과 신규 물리 함정을 사용한다', () => {
		const types = new Set<string>();

		for (let stageId = 21; stageId <= 30; stageId += 1) {
			const stage = getStage(stageId);
			expect(stage.survivalMs, `stage ${stageId} survival time`).toBe(10000);
			expect(stage.designerNote, `stage ${stageId} designer note`).toBeTruthy();
			expect(stage.objectiveHint, `stage ${stageId} hint`).toBeTruthy();
			for (const obstacle of stage.obstacles) types.add(obstacle.type);
		}

		for (const type of ['acid', 'ice', 'stone', 'rolling-boulder'] as const) {
			expect(types.has(type), `authored campaign should include ${type}`).toBe(true);
		}
		expect(getStage(21).environment).toBe('forest');
		expect(getStage(30).hives).toHaveLength(3);
	});

	it('24단계는 강아지보다 높은 왼쪽 경사에서 굴림돌이 안전실 방향으로 내려온다', () => {
		const stage = getStage(24);
		const boulder = stage.obstacles.find((obstacle) => obstacle.type === 'rolling-boulder');
		const slope = stage.obstacles.find((obstacle) => obstacle.type === 'wood' && obstacle.angle !== undefined);

		expect(boulder).toMatchObject({ x: 186, y: 304 });
		expect(slope).toMatchObject({ x: 150, y: 370, angle: -0.24 });
		expect(boulder?.y).toBeLessThan(stage.dog.y);
		expect(boulder?.x).toBeGreaterThan(stage.dog.x);
	});

	it('물이나 용암이 가시와 겹쳐 보이지 않는다', () => {
		for (let stageId = 1; stageId <= 20; stageId += 1) {
			const stage = getStage(stageId);
			const spikes = stage.obstacles.filter((obstacle) => obstacle.type === 'spike');
			const pools = stage.obstacles.filter((obstacle) => obstacle.type === 'water' || obstacle.type === 'lava');

			for (const spike of spikes) {
				for (const pool of pools) {
					expect(obstaclesOverlap(spike, pool), `stage ${stageId} has overlapping ${spike.type} and ${pool.type}`).toBe(false);
				}
			}
		}
	});
});

function obstaclesOverlap(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number }
): boolean {
	return (
		a.x - a.width / 2 < b.x + b.width / 2 &&
		a.x + a.width / 2 > b.x - b.width / 2 &&
		a.y - a.height / 2 < b.y + b.height / 2 &&
		a.y + a.height / 2 > b.y - b.height / 2
	);
}
