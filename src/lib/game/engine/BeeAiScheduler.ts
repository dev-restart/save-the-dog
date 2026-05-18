export class BeeAiScheduler {
	private elapsedSinceLastRefreshMs = Number.POSITIVE_INFINITY;

	constructor(private intervalMs: number) {}

	tick(deltaMs: number, forceRefresh = false): boolean {
		this.elapsedSinceLastRefreshMs += deltaMs;
		if (!forceRefresh && this.elapsedSinceLastRefreshMs < this.intervalMs) return false;

		// 느린 프레임에서 고정 물리 step이 여러 번 실행되어도 AI/A*는 정해진 간격으로만 갱신한다.
		this.elapsedSinceLastRefreshMs = 0;
		return true;
	}

	reset(): void {
		this.elapsedSinceLastRefreshMs = Number.POSITIVE_INFINITY;
	}
}
