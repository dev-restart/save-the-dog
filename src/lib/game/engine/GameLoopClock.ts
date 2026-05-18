export interface FixedStepClockOptions {
	fixedDeltaMs: number;
	maxFrameDeltaMs: number;
	maxStepsPerFrame: number;
}

export interface FixedStepTick {
	frameDeltaMs: number;
	simulationDeltaMs: number;
	steps: number[];
	alpha: number;
}

export class FixedStepClock {
	private lastTimestamp = 0;
	private accumulatorMs = 0;
	private hasTimestamp = false;

	constructor(private options: FixedStepClockOptions) {}

	reset(): void {
		this.lastTimestamp = 0;
		this.accumulatorMs = 0;
		this.hasTimestamp = false;
	}

	tick(timestamp: number): FixedStepTick {
		// 첫 프레임은 실제 브라우저 timestamp 기준 차이가 없으므로 1 tick만 진행해 초기 렌더를 안정화한다.
		const rawFrameDeltaMs = this.hasTimestamp ? timestamp - this.lastTimestamp : this.options.fixedDeltaMs;
		const frameDeltaMs = Math.min(Math.max(rawFrameDeltaMs, 0), this.options.maxFrameDeltaMs);
		this.lastTimestamp = timestamp;
		this.hasTimestamp = true;
		this.accumulatorMs += frameDeltaMs;

		const steps: number[] = [];
		const epsilon = 0.0001;
		while (this.accumulatorMs + epsilon >= this.options.fixedDeltaMs && steps.length < this.options.maxStepsPerFrame) {
			steps.push(this.options.fixedDeltaMs);
			this.accumulatorMs = Math.max(0, this.accumulatorMs - this.options.fixedDeltaMs);
		}

		// 오래 멈춘 탭이 다시 켜질 때 남은 누적 시간을 버려 한 프레임 물리 폭주를 막는다.
		if (steps.length === this.options.maxStepsPerFrame && this.accumulatorMs >= this.options.fixedDeltaMs) {
			this.accumulatorMs = 0;
		}

		return {
			frameDeltaMs,
			simulationDeltaMs: steps.reduce((total, step) => total + step, 0),
			steps,
			alpha: this.accumulatorMs / this.options.fixedDeltaMs
		};
	}
}
