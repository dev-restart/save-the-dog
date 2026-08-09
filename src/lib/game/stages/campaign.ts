import type { StageDesignType, StageEnvironment } from '../types.js';

export const CAMPAIGN_STAGE_COUNT = 100;

export interface CampaignChapter {
	id: number;
	startStage: number;
	endStage: number;
	title: string;
	subtitle: string;
	mechanic: string;
	designType: StageDesignType;
	environment: StageEnvironment;
}

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = [
	{ id: 1, startStage: 1, endStage: 10, title: '풀빛 초원', subtitle: '보호막의 기본', mechanic: '지형에 선을 걸어 첫 방어선을 만듭니다.', designType: 'basic-cover', environment: 'meadow' },
	{ id: 2, startStage: 11, endStage: 20, title: '지형 실험실', subtitle: '낙하와 지지', mechanic: '물·용암·가시를 피하며 받침을 설계합니다.', designType: 'fall-catch', environment: 'volcanic' },
	{ id: 3, startStage: 21, endStage: 30, title: '물리 놀이터', subtitle: '굴림돌과 경사', mechanic: '중력과 경사면의 방향을 읽습니다.', designType: 'slope-slide', environment: 'forest' },
	{ id: 4, startStage: 31, endStage: 40, title: '째깍이는 작업장', subtitle: '폭탄과 시간차', mechanic: '폭탄의 퓨즈를 피해 안전한 지지점을 만듭니다.', designType: 'anchor-wall', environment: 'volcanic' },
	{ id: 5, startStage: 41, endStage: 50, title: '바람 계곡', subtitle: '경사와 굴림돌', mechanic: '굴림돌의 낙하 경로를 바꾸고 강아지를 받칩니다.', designType: 'slope-slide', environment: 'forest' },
	{ id: 6, startStage: 51, endStage: 60, title: '용암 수로', subtitle: '끊어진 발판', mechanic: '고정 지형을 이어 위험한 바닥을 건너뜁니다.', designType: 'bridge-gap', environment: 'volcanic' },
	{ id: 7, startStage: 61, endStage: 70, title: '두 벌집 숲', subtitle: '양쪽 진입축', mechanic: '서로 다른 방향의 벌을 동시에 분산시킵니다.', designType: 'split-hive', environment: 'forest' },
	{ id: 8, startStage: 71, endStage: 80, title: '금지된 정원', subtitle: '그릴 수 없는 지형', mechanic: '금지 지형을 피해 열린 면만 정확히 닫습니다.', designType: 'terrain-pocket', environment: 'forest' },
	{ id: 9, startStage: 81, endStage: 90, title: '연쇄 관문', subtitle: '복합 물리 퍼즐', mechanic: '폭발과 굴림의 순서를 바꾸어 탈출로를 만듭니다.', designType: 'pressure-cage', environment: 'volcanic' },
	{ id: 10, startStage: 91, endStage: 100, title: '마지막 설계도', subtitle: 'IQ 챌린지', mechanic: '복수 벌집과 지형의 모든 규칙을 조합합니다.', designType: 'final-composite', environment: 'volcanic' }
] as const;

export function getCampaignChapter(stageId: number): CampaignChapter {
	return CAMPAIGN_CHAPTERS.find((chapter) => stageId >= chapter.startStage && stageId <= chapter.endStage) ?? CAMPAIGN_CHAPTERS[CAMPAIGN_CHAPTERS.length - 1];
}

export function getCampaignSlot(stageId: number): number {
	const chapter = getCampaignChapter(stageId);
	return Math.max(1, Math.min(10, stageId - chapter.startStage + 1));
}
