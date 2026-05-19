export const PHYSICS = {
	gravityY: 1.5,
	fixedDeltaMs: 1000 / 60,
	dogRadius: 20,
	beeRadius: 6,
	drawingThickness: 16,
	defaultInkLimit: 600,
	defaultSurvivalMs: 5000,
	maxActiveBees: 25,
	maxDrawingSegments: 24,
	beeMaxSpeed: 8
} as const;

export const COLLISION_CATEGORY = {
	ground: 0x0001,
	dog: 0x0002,
	bee: 0x0004,
	drawing: 0x0008,
	spike: 0x0010,
	deadzone: 0x0020,
	hive: 0x0040,
	wall: 0x0080
} as const;

export const STORAGE_KEY = 'save_the_dog_progress';
export const SKIN_STORAGE_KEY = 'save_the_dog_skin';
export const HAPTIC_STORAGE_KEY = 'save_the_dog_haptics';
