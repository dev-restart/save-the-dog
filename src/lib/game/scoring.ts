export interface StageScoreInput {
	inkRatio: number;
	elapsedMs: number;
	survivalMs: number;
}

export interface StageScore {
	stars: number;
	inkStars: number;
	timeStars: number;
	inkRatio: number;
	timeRatio: number;
}

const MAX_INK_STARS = 1.5;
const MAX_TIME_STARS = 1.5;
const MAX_TOTAL_STARS = 3;
const MIN_CLEAR_STARS = 0.5;

// 클리어 별점은 잉크 절약과 목표 생존 시간 달성을 각각 절반씩 반영한다.
export function calculateStageScore(input: StageScoreInput): StageScore {
	const inkRatio = clamp01(input.inkRatio);
	const timeRatio = clamp01(input.elapsedMs / Math.max(1, input.survivalMs));
	const inkStars = ratioToStars(inkRatio, [0.75, 0.45, 0.2]);
	const timeStars = ratioToStars(timeRatio, [0.95, 0.75, 0.5]);

	// 별은 반 개 단위로 채워진다. 클리어 보상은 최소 0.5개, 만점은 3개로 제한한다.
	const stars = clampStarRange(Math.max(MIN_CLEAR_STARS, inkStars + timeStars));

	return {
		stars,
		inkStars,
		timeStars,
		inkRatio,
		timeRatio
	};
}

export function formatStarScore(stars: number): string {
	return clampStarRange(stars).toFixed(1);
}

function ratioToStars(ratio: number, thresholds: [number, number, number]): number {
	if (ratio >= thresholds[0]) return 1.5;
	if (ratio >= thresholds[1]) return 1;
	if (ratio >= thresholds[2]) return 0.5;
	return 0;
}

function clampStarRange(value: number): number {
	return Math.min(MAX_TOTAL_STARS, Math.max(0, value));
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
