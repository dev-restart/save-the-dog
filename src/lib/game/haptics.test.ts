import { describe, expect, it, vi } from 'vitest';
import { stopHaptic, triggerHaptic } from './haptics.js';

describe('haptics', () => {
	it('지원 브라우저에서는 패턴별 진동을 요청한다', () => {
		const vibrate = vi.fn(() => true);
		vi.stubGlobal('navigator', { vibrate });

		expect(triggerHaptic('attack')).toBe(true);
		expect(vibrate).toHaveBeenCalledWith([90, 35, 140]);

		expect(triggerHaptic('light', false)).toBe(false);
		expect(vibrate).toHaveBeenCalledTimes(1);

		stopHaptic();
		expect(vibrate).toHaveBeenCalledWith(0);
		vi.unstubAllGlobals();
	});

	it('Vibration API가 없는 브라우저에서는 조용히 무시한다', () => {
		vi.stubGlobal('navigator', {});

		expect(triggerHaptic('light')).toBe(false);
		expect(() => stopHaptic()).not.toThrow();
		vi.unstubAllGlobals();
	});
});
