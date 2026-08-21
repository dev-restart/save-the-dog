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

const MAX_TOTAL_STARS = 3;
const MIN_CLEAR_STARS = 0.5;

// 생존형 스테이지는 성공 시점의 시간 점수가 변별력이 없으므로 잉크 효율만 별점에 반영한다.
// timeRatio/timeStars는 기존 UI/직렬화 shape 호환을 위해 유지하되, 별점 산정에는 사용하지 않는다.
export function calculateStageScore(input: StageScoreInput): StageScore {
	const inkRatio = clamp01(input.inkRatio);
	const timeRatio = clamp01(input.elapsedMs / Math.max(1, input.survivalMs));
	const inkStars = ratioToStars(inkRatio, [0.75, 0.6, 0.45, 0.3, 0.2, 0.1]);
	const timeStars = 0;

	// 별은 반 개 단위로 채워진다. 클리어 보상은 최소 0.5개, 만점은 3개로 제한한다.
	const stars = clampStarRange(Math.max(MIN_CLEAR_STARS, inkStars));

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

function ratioToStars(ratio: number, thresholds: [number, number, number, number, number, number]): number {
	if (ratio >= thresholds[0]) return 3;
	if (ratio >= thresholds[1]) return 2.5;
	if (ratio >= thresholds[2]) return 2;
	if (ratio >= thresholds[3]) return 1.5;
	if (ratio >= thresholds[4]) return 1;
	if (ratio >= thresholds[5]) return 0.5;
	return 0;
}

function clampStarRange(value: number): number {
	return Math.min(MAX_TOTAL_STARS, Math.max(0, value));
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
