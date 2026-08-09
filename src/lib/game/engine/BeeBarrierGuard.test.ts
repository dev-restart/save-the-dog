import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { COLLISION_CATEGORY, PHYSICS } from '../constants.js';
import { ObjectFactory } from './ObjectFactory.js';
import {
	enforceBeeDrawingBarriers,
	enforceDogDrawingContainment,
	isBeeSeparatedFromDogByDrawing,
	movePointOutsideClosedDrawing,
	rememberBeePositions
} from './BeeBarrierGuard.js';

function createBee(x: number, y: number): Matter.Body {
	return Matter.Bodies.circle(x, y, PHYSICS.beeRadius, {
		label: 'bee',
		collisionFilter: {
			category: COLLISION_CATEGORY.bee,
			mask: COLLISION_CATEGORY.drawing
		}
	});
}

function createDog(x: number, y: number): Matter.Body {
	return Matter.Bodies.circle(x, y, PHYSICS.dogRadius, {
		label: 'dog',
		collisionFilter: {
			category: COLLISION_CATEGORY.dog,
			mask: COLLISION_CATEGORY.bee
		}
	});
}

function createDrawingWall(): Matter.Body {
	return Matter.Bodies.rectangle(100, 100, 16, 120, {
		label: 'drawing',
		collisionFilter: {
			category: COLLISION_CATEGORY.drawing,
			mask: COLLISION_CATEGORY.bee
		}
	});
}

function createClosedDrawing(): Matter.Body {
	const [drawing] = ObjectFactory.createDrawingSegments([
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 200, y: 200 },
		{ x: 100, y: 200 },
		{ x: 104, y: 104 }
	]);
	return drawing;
}

describe('BeeBarrierGuard', () => {
	it('빠른 벌이 한 프레임 사이에 그린 방어선을 통과하지 못하게 되돌린다', () => {
		const bee = createBee(70, 100);
		const drawing = createDrawingWall();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		Matter.Body.setPosition(bee, { x: 130, y: 100 });
		Matter.Body.setVelocity(bee, { x: 20, y: 0 });
		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x).toBeLessThan(100 - PHYSICS.beeRadius);
		expect(bee.velocity.x).toBeLessThanOrEqual(0);
	});

	it('방어선과 만나지 않는 벌은 위치를 바꾸지 않는다', () => {
		const bee = createBee(70, 40);
		const drawing = createDrawingWall();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		Matter.Body.setPosition(bee, { x: 85, y: 40 });
		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x).toBeCloseTo(85);
		expect(bee.position.y).toBeCloseTo(40);
	});

	it('강아지와 벌 사이에 방어선이 있으면 벌 충돌 실패를 보호 판정으로 본다', () => {
		const bee = createBee(70, 100);
		const dog = createDog(130, 100);
		const drawing = createDrawingWall();

		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [drawing])).toBe(true);
		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [])).toBe(false);
	});

	it('벌이 방어선을 통과한 뒤 강아지와 겹친 프레임도 이전 위치로 보호 판정한다', () => {
		const bee = createBee(128, 100);
		const dog = createDog(130, 100);
		const drawing = createDrawingWall();

		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [drawing])).toBe(false);
		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [drawing], PHYSICS.beeRadius, { x: 70, y: 100 })).toBe(true);
	});

	it('닫힌 방어선 안으로 통과한 벌은 이전 위치 기준으로 강아지를 보호한다', () => {
		const bee = createBee(150, 150);
		const dog = createDog(150, 150);
		const drawing = createClosedDrawing();

		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [drawing])).toBe(false);
		expect(isBeeSeparatedFromDogByDrawing(bee, dog, [drawing], PHYSICS.beeRadius, { x: 240, y: 150 })).toBe(true);
	});

	it('닫힌 방어선으로 들어온 벌을 선 밖으로 되돌린다', () => {
		const bee = createBee(240, 150);
		const drawing = createClosedDrawing();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		Matter.Body.setPosition(bee, { x: 150, y: 150 });
		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x < 100 || bee.position.x > 200 || bee.position.y < 100 || bee.position.y > 200).toBe(true);
	});

	it('벌이 이미 닫힌 방어선 안에 있어도 선 밖으로 꺼낸다', () => {
		const bee = createBee(150, 150);
		const drawing = createClosedDrawing();
		const previous = new Map<number, { x: number; y: number }>();
		rememberBeePositions([bee], previous);

		enforceBeeDrawingBarriers([bee], [drawing], previous);

		expect(bee.position.x < 100 || bee.position.x > 200 || bee.position.y < 100 || bee.position.y > 200).toBe(true);
	});

	it('닫힌 방어선 안에서 생성된 벌도 선 밖으로 배치한다', () => {
		const drawing = createClosedDrawing();
		const point = movePointOutsideClosedDrawing({ x: 150, y: 150 }, drawing);

		expect(point.x < 100 || point.x > 200 || point.y < 100 || point.y > 200).toBe(true);
	});

	it('닫힌 방어선 밖으로 튕겨진 강아지를 다시 안쪽으로 보정한다', () => {
		const dog = createDog(150, 150);
		const drawing = createClosedDrawing();
		Matter.Body.setPosition(dog, { x: 240, y: 150 });

		const corrected = enforceDogDrawingContainment(dog, [drawing], { x: 150, y: 150 });

		expect(corrected).toBe(true);
		expect(dog.position.x < 200 && dog.position.x > 100).toBe(true);
		expect(dog.position.y < 200 && dog.position.y > 100).toBe(true);
	});

	it('움직이는 닫힌 방어선도 강아지를 내부에 유지한다', () => {
		const dog = createDog(150, 150);
		const drawing = createClosedDrawing();
		Matter.Body.setPosition(dog, { x: 240, y: 150 });

		const corrected = enforceDogDrawingContainment(dog, [drawing], { x: 240, y: 150 }, undefined, new Set([drawing.id]));

		expect(corrected).toBe(true);
		expect(dog.position.x < 200 && dog.position.x > 100).toBe(true);
		expect(dog.position.y < 200 && dog.position.y > 100).toBe(true);
	});
});
