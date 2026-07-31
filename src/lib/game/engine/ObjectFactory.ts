import Matter from 'matter-js';
import { COLLISION_CATEGORY, PHYSICS } from '../constants.js';
import { distance, scaleLengthX, scaleLengthY, scalePoint } from '../geometry.js';
import type { CanvasSize, ObstacleData, Point } from '../types.js';

export interface DrawingBodyPlugin {
	drawingPath?: Point[];
	drawingThickness?: number;
}

function bodyOptions(label: string, category: number, mask: number) {
	return {
		label,
		collisionFilter: { category, mask }
	} satisfies Matter.IChamferableBodyDefinition;
}

export class ObjectFactory {
	static createDog(point: Point, size: CanvasSize): Matter.Body {
		const pos = scalePoint(point, size);
		return Matter.Bodies.circle(pos.x, pos.y, scaleLengthX(PHYSICS.dogRadius, size), {
			...bodyOptions(
				'dog',
				COLLISION_CATEGORY.dog,
				COLLISION_CATEGORY.ground |
					COLLISION_CATEGORY.drawing |
					COLLISION_CATEGORY.spike |
					COLLISION_CATEGORY.deadzone |
					COLLISION_CATEGORY.bee |
					COLLISION_CATEGORY.wall |
					COLLISION_CATEGORY.hazard
			),
			friction: 0.5,
			restitution: 0.18,
			density: 0.004
		});
	}

	static createHive(point: Point, size: CanvasSize): Matter.Body {
		const pos = scalePoint(point, size);
		return Matter.Bodies.rectangle(pos.x, pos.y, scaleLengthX(52, size), scaleLengthY(40, size), {
			...bodyOptions('hive', COLLISION_CATEGORY.hive, 0),
			isStatic: true,
			isSensor: true
		});
	}

	static createBee(point: Point, size: CanvasSize): Matter.Body {
		const pos = scalePoint(point, size);
		return Matter.Bodies.circle(pos.x, pos.y, scaleLengthX(PHYSICS.beeRadius, size), {
			...bodyOptions(
				'bee',
				COLLISION_CATEGORY.bee,
				COLLISION_CATEGORY.dog | COLLISION_CATEGORY.drawing | COLLISION_CATEGORY.ground | COLLISION_CATEGORY.wall
			),
			frictionAir: 0.02,
			restitution: 0.12,
			density: 0.0008
		});
	}

	static createObstacle(obstacle: ObstacleData, size: CanvasSize): Matter.Body {
		const pos = scalePoint({ x: obstacle.x, y: obstacle.y }, size);
		const width = scaleLengthX(obstacle.width, size);
		const height = scaleLengthY(obstacle.height, size);
		const label = obstacle.type === 'platform' ? 'platform' : obstacle.type === 'wall' ? 'brick' : obstacle.type;
		const isSensorHazard =
			obstacle.type === 'spike' ||
			obstacle.type === 'water' ||
			obstacle.type === 'lava' ||
			obstacle.type === 'bomb' ||
			obstacle.type === 'acid';
		const isRollingBoulder = obstacle.type === 'rolling-boulder';
		const category =
			obstacle.type === 'spike'
				? COLLISION_CATEGORY.spike
				: obstacle.type === 'water' || obstacle.type === 'lava' || obstacle.type === 'bomb' || obstacle.type === 'acid' || isRollingBoulder
					? COLLISION_CATEGORY.hazard
					: obstacle.type === 'wall'
						? COLLISION_CATEGORY.wall
						: COLLISION_CATEGORY.ground;

		const mask =
			isSensorHazard
				? COLLISION_CATEGORY.dog
				: isRollingBoulder
					? COLLISION_CATEGORY.dog |
						COLLISION_CATEGORY.bee |
						COLLISION_CATEGORY.drawing |
						COLLISION_CATEGORY.ground |
						COLLISION_CATEGORY.wall
				: COLLISION_CATEGORY.dog | COLLISION_CATEGORY.bee | COLLISION_CATEGORY.drawing;

		const body = Matter.Bodies.rectangle(pos.x, pos.y, width, height, {
			...bodyOptions(label, category, mask),
			isStatic: !isRollingBoulder,
			isSensor: isSensorHazard,
			angle: obstacle.angle ?? 0,
			friction: obstacle.type === 'ice' ? 0.03 : isRollingBoulder ? 0.5 : obstacle.type === 'stone' ? 0.9 : 0.72,
			frictionStatic: obstacle.type === 'ice' ? 0.04 : isRollingBoulder ? 0.65 : 0.9,
			restitution: isRollingBoulder ? 0.08 : 0,
			density: isRollingBoulder ? 0.012 : undefined
		});

		// Matter.js는 정적 body를 만들 때 마찰을 1로 덮어쓴다. 얼음은 생성 뒤 값을 복원해야 실제로 미끄럽다.
		if (obstacle.type === 'ice') {
			body.friction = 0.03;
			body.frictionStatic = 0.04;
		}

		return body;
	}

	static createWalls(size: CanvasSize): Matter.Body[] {
		const thickness = 50;
		return [
			Matter.Bodies.rectangle(-thickness / 2, size.height / 2, thickness, size.height * 2, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, COLLISION_CATEGORY.dog | COLLISION_CATEGORY.bee | COLLISION_CATEGORY.drawing),
				isStatic: true
			}),
			Matter.Bodies.rectangle(size.width + thickness / 2, size.height / 2, thickness, size.height * 2, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, COLLISION_CATEGORY.dog | COLLISION_CATEGORY.bee | COLLISION_CATEGORY.drawing),
				isStatic: true
			}),
			Matter.Bodies.rectangle(size.width / 2, -thickness / 2, size.width, thickness, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, COLLISION_CATEGORY.dog | COLLISION_CATEGORY.bee | COLLISION_CATEGORY.drawing),
				isStatic: true
			}),
			Matter.Bodies.rectangle(size.width / 2, size.height + 25, size.width, 50, {
				...bodyOptions('deadzone', COLLISION_CATEGORY.deadzone, COLLISION_CATEGORY.dog),
				isStatic: true,
				isSensor: true
			})
		];
	}

	static createDrawingSegments(points: Point[]): Matter.Body[] {
		if (points.length < 2) return [];

		const stride = Math.max(1, Math.ceil((points.length - 1) / PHYSICS.maxDrawingSegments));
		const sampled = points.filter((_, index) => index % stride === 0);
		const lastPoint = points.at(-1);
		if (lastPoint && sampled.at(-1) !== lastPoint) sampled.push(lastPoint);

		// 잉크는 하나의 강체로 모양을 보존하지만, 실제 Save the Dog처럼 중력과 지형 충돌을 받는다.
		// 따라서 원형을 공중에 만들면 떨어지거나 굴러가고, 벽/발판에 걸쳐 그려야 안정적이다.
		const drawingBodyOptions = {
			...bodyOptions(
				'drawing',
				COLLISION_CATEGORY.drawing,
				COLLISION_CATEGORY.dog | COLLISION_CATEGORY.bee | COLLISION_CATEGORY.ground | COLLISION_CATEGORY.wall
			),
			friction: 0.82,
			frictionStatic: 0.92,
			frictionAir: 0.006,
			restitution: 0.04,
			density: 0.012
		} satisfies Matter.IChamferableBodyDefinition;

		const segments: Matter.Body[] = [];
		for (let index = 1; index < sampled.length; index += 1) {
			const start = sampled[index - 1];
			const end = sampled[index];
			const length = distance(start, end);
			if (length < 4) continue;

			const center = {
				x: (start.x + end.x) / 2,
				y: (start.y + end.y) / 2
			};
			const angle = Math.atan2(end.y - start.y, end.x - start.x);

			segments.push(
				Matter.Bodies.rectangle(center.x, center.y, length + PHYSICS.drawingThickness, PHYSICS.drawingThickness, {
					...drawingBodyOptions,
					angle
				})
			);
		}

		const caps = sampled.map((point) =>
			Matter.Bodies.circle(point.x, point.y, PHYSICS.drawingThickness / 2, drawingBodyOptions)
		);

		const parts = [...segments, ...caps];
		if (parts.length === 0) return [];

		// Matter.js compound body로 묶어야 손그림 전체가 하나의 강체처럼 떨어진다.
		// 조각을 각각 월드에 넣으면 선이 바로 흩어져 방어 구조물이 아니라 낱개 막대가 되어 버린다.
		const compound = Matter.Body.create({
			...drawingBodyOptions,
			parts
		});
		compound.plugin = {
			...(compound.plugin as object),
			drawingPath: sampled.map((point) => ({
				x: point.x - compound.position.x,
				y: point.y - compound.position.y
			})),
			drawingThickness: PHYSICS.drawingThickness
		} satisfies DrawingBodyPlugin;

		return [compound];
	}
}
