export function createSeededRandom(seed: string): () => number {
	let state = hashSeed(seed);
	return () => {
		state += 0x6d2b79f5;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function hashSeed(seed: string): number {
	let value = 2166136261;
	for (const character of seed) {
		value ^= character.charCodeAt(0);
		value = Math.imul(value, 16777619);
	}
	return value | 0;
}
