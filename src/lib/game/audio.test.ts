import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import { DEFAULT_AUDIO_PREFERENCES, GameAudioManager } from './audio.js';

class FakeAudio {
	loop = false;
	volume = 1;
	preload = '';
	currentTime = 0;
	play = vi.fn(async () => undefined);
	pause = vi.fn();

	constructor(public src: string) {}
}

describe('GameAudioManager lifecycle', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('hidden/pagehide에서 오디오를 멈추고 복귀 시 unlock 상태면 다시 재생한다', () => {
		const documentListeners = new Map<string, EventListener>();
		const windowListeners = new Map<string, EventListener>();
		let hidden = false;

		vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
		vi.stubGlobal('document', {
			get hidden() {
				return hidden;
			},
			addEventListener: vi.fn((type: string, listener: EventListener) => documentListeners.set(type, listener)),
			removeEventListener: vi.fn((type: string) => documentListeners.delete(type))
		});
		vi.stubGlobal('window', {
			addEventListener: vi.fn((type: string, listener: EventListener) => windowListeners.set(type, listener)),
			removeEventListener: vi.fn((type: string) => windowListeners.delete(type))
		});
		vi.stubGlobal('performance', { now: () => 1000 });

		const audio = new GameAudioManager(DEFAULT_AUDIO_PREFERENCES);
		audio.setSkin('classic');
		audio.unlock();
		audio.setBeeBuzzing(true);

		const manager = audio as unknown as {
			bgm: FakeAudio | null;
			beeBuzz: FakeAudio | null;
		};

		expect(manager.bgm?.play).toHaveBeenCalled();
		expect(manager.beeBuzz?.play).toHaveBeenCalled();

		hidden = true;
		documentListeners.get('visibilitychange')?.(new Event('visibilitychange'));
		expect(manager.bgm?.pause).toHaveBeenCalled();
		expect(manager.beeBuzz?.pause).toHaveBeenCalled();

		windowListeners.get('pagehide')?.(new Event('pagehide'));
		expect(manager.bgm?.pause).toHaveBeenCalledTimes(2);

		hidden = false;
		documentListeners.get('visibilitychange')?.(new Event('visibilitychange'));
		expect(manager.bgm?.play).toHaveBeenCalledTimes(2);

		windowListeners.get('pageshow')?.(new Event('pageshow'));
		expect(manager.bgm?.play).toHaveBeenCalledTimes(3);

		audio.destroy();
	});
});
