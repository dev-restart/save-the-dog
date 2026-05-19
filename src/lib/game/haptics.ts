type HapticPattern = 'light' | 'success' | 'attack';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
	light: 18,
	success: [35, 35, 55],
	attack: [90, 35, 140]
};

export function triggerHaptic(pattern: HapticPattern, enabled = true): boolean {
	if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
	return navigator.vibrate(HAPTIC_PATTERNS[pattern]);
}

export function stopHaptic(): void {
	if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
	navigator.vibrate(0);
}
