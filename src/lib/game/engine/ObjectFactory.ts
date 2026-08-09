import Matter from 'matter-js';
import { COLLISION_CATEGORY, PHYSICS } from '../constants.js';
import { distance, scaleLengthX, scaleLengthY, scalePoint } from '../geometry.js';
import type { CanvasSize, ObstacleData, Point } from '../types.js';

export interface DrawingBodyPlugin {
	drawingPath?: Point[];
	drawingThickness?: number;
}

const DRAWING_CLOSURE_DISTANCE = PHYSICS.drawingThickness * 3;

function bodyOptions(label: string, category: number, mask: number) {
	return {
		label,
		collisionFilter: { category, mask }
	} satisfies Matter.IChamferableBodyDefinition;
}

// 오브젝트별 물리 속성 정의
// isStatic: true = 고정된 지형/장애물 (움직이지 않음)
// isStatic: false = 동적 오브젝트 (중력/충돌에 반응)
// isSensor: true = 물리적 충돌 없이 감지만 (함정, 금지구역)
interface ObstaclePhysics {
	isStatic: boolean;
	isSensor: boolean;
	friction: number;
	frictionStatic: number;
	frictionAir?: number;
	restitution: number;
	density?: number;
}

const PHYSICAL_TERRAIN_MASK =
	COLLISION_CATEGORY.dog |
	COLLISION_CATEGORY.bee |
	COLLISION_CATEGORY.drawing |
	COLLISION_CATEGORY.hazard;

const DYNAMIC_OBJECT_MASK =
	COLLISION_CATEGORY.dog |
	COLLISION_CATEGORY.bee |
	COLLISION_CATEGORY.drawing |
	COLLISION_CATEGORY.ground |
	COLLISION_CATEGORY.wall |
	COLLISION_CATEGORY.hazard;

const OBSTACLE_PHYSICS: Record<string, ObstaclePhysics> = {
	// 고정 지형 (움직이지 않음)
	ground: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	platform: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	brick: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	'terrain-block': { isStatic: true, isSensor: false, friction: 0.78, frictionStatic: 0.94, restitution: 0 },
	stone: { isStatic: true, isSensor: false, friction: 0.9, frictionStatic: 0.9, restitution: 0 },
	wood: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	wall: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	crate: { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },

	// 미끄러운 지형
	ice: { isStatic: true, isSensor: false, friction: 0.03, frictionStatic: 0.04, restitution: 0 },

	// 함정 (감지만, 물리 충돌 없음)
	spike: { isStatic: true, isSensor: true, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	water: { isStatic: true, isSensor: true, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	lava: { isStatic: true, isSensor: true, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	acid: { isStatic: true, isSensor: true, friction: 0.72, frictionStatic: 0.9, restitution: 0 },

	// 폭탄은 퓨즈를 읽을 수 있게 천천히 낙하한다. 지형/선/강아지에 닿으면 퓨즈와 관계없이 즉시 기폭한다.
	bomb: { isStatic: false, isSensor: false, friction: 0.5, frictionStatic: 0.6, frictionAir: 0.18, restitution: 0.1, density: 0.008 },

	// 동적 오브젝트 (중력/충돌에 반응)
	'rolling-boulder': { isStatic: false, isSensor: false, friction: 0.9, frictionStatic: 1.0, frictionAir: 0.001, restitution: 0.05, density: 0.015 },
	boulder: { isStatic: false, isSensor: false, friction: 0.9, frictionStatic: 1.0, frictionAir: 0.001, restitution: 0.05, density: 0.015 },

	// 금지 아이콘 대신 연결 가능한 고정 지형으로 쓴다. DrawingSystem이 선 입력만 별도로 막는다.
	'no-draw-zone': { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	'no-draw-ground': { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	'no-draw-tree': { isStatic: true, isSensor: false, friction: 0.72, frictionStatic: 0.9, restitution: 0 },
	'no-draw-rock': { isStatic: true, isSensor: false, friction: 0.9, frictionStatic: 0.9, restitution: 0 }
};

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
		const physics = OBSTACLE_PHYSICS[obstacle.type] ?? OBSTACLE_PHYSICS.ground;

		const category =
			obstacle.type === 'spike'
				? COLLISION_CATEGORY.spike
				: obstacle.type === 'water' || obstacle.type === 'lava' || obstacle.type === 'bomb' || obstacle.type === 'acid' || obstacle.type === 'rolling-boulder' || obstacle.type === 'boulder'
					? COLLISION_CATEGORY.hazard
					: obstacle.type === 'wall'
						? COLLISION_CATEGORY.wall
						: COLLISION_CATEGORY.ground;

		const isDynamicObject = obstacle.type === 'rolling-boulder' || obstacle.type === 'boulder' || obstacle.type === 'bomb';
		const mask = physics.isSensor ? COLLISION_CATEGORY.dog : isDynamicObject ? DYNAMIC_OBJECT_MASK : PHYSICAL_TERRAIN_MASK;

		// 동적 원형 오브젝트 (굴림돌, 바위, 폭탄)
		if (isDynamicObject && !physics.isStatic) {
			const radius = Math.max(width, height) / 2;
			const body = Matter.Bodies.circle(pos.x, pos.y, radius, {
				...bodyOptions(label, category, mask),
				isStatic: false,
				isSensor: false,
				angle: obstacle.angle ?? 0,
				friction: physics.friction,
				frictionStatic: physics.frictionStatic,
				frictionAir: physics.frictionAir ?? 0.001,
				restitution: physics.restitution,
				density: physics.density ?? 0.012
			});
			return body;
		}

		// 고정 또는 센서 바디 (사각형)
		const body = Matter.Bodies.rectangle(pos.x, pos.y, width, height, {
			...bodyOptions(label, category, mask),
			isStatic: physics.isStatic,
			isSensor: physics.isSensor,
			angle: obstacle.angle ?? 0,
			friction: physics.friction,
			frictionStatic: physics.frictionStatic,
			restitution: physics.restitution,
			density: physics.density
		});

		// Matter.js는 정적 body를 만들 때 마찰을 1로 덮어쓴다. 얼음은 생성 뒤 값을 복원해야 실제로 미끄럽다.
		if (obstacle.type === 'ice') {
			body.friction = physics.friction;
			body.frictionStatic = physics.frictionStatic;
		}

		return body;
	}

	static createWalls(size: CanvasSize): Matter.Body[] {
		const thickness = 50;
		return [
			Matter.Bodies.rectangle(-thickness / 2, size.height / 2, thickness, size.height * 2, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, PHYSICAL_TERRAIN_MASK),
				isStatic: true
			}),
			Matter.Bodies.rectangle(size.width + thickness / 2, size.height / 2, thickness, size.height * 2, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, PHYSICAL_TERRAIN_MASK),
				isStatic: true
			}),
			Matter.Bodies.rectangle(size.width / 2, -thickness / 2, size.width, thickness, {
				...bodyOptions('wall', COLLISION_CATEGORY.wall, PHYSICAL_TERRAIN_MASK),
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
		const firstPoint = sampled[0];
		const sampledLastPoint = sampled.at(-1);
		const path =
			firstPoint && sampledLastPoint && sampled.length >= 3 && distance(firstPoint, sampledLastPoint) <= DRAWING_CLOSURE_DISTANCE
				? [...sampled.slice(0, -1), firstPoint]
				: sampled;

		// 잉크는 하나의 강체로 모양을 보존하지만, 실제 Save the Dog처럼 중력과 지형 충돌을 받는다.
		// 따라서 원형을 공중에 만들면 떨어지거나 굴리고, 벽/발판에 걸쳐 그려야 안정적이다.
		const drawingBodyOptions = {
			...bodyOptions(
				'drawing',
				COLLISION_CATEGORY.drawing,
				COLLISION_CATEGORY.dog |
					COLLISION_CATEGORY.bee |
					COLLISION_CATEGORY.ground |
					COLLISION_CATEGORY.wall |
					COLLISION_CATEGORY.hazard
			),
			friction: 0.82,
			frictionStatic: 0.92,
			frictionAir: 0.006,
			restitution: 0.04,
			density: 0.012
		} satisfies Matter.IChamferableBodyDefinition;

		const segments: Matter.Body[] = [];
		for (let index = 1; index < path.length; index += 1) {
			const start = path[index - 1];
			const end = path[index];
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

		const caps = path.map((point) =>
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
			drawingPath: path.map((point) => ({
				x: point.x - compound.position.x,
				y: point.y - compound.position.y
			})),
			drawingThickness: PHYSICS.drawingThickness
		} satisfies DrawingBodyPlugin;

		return [compound];
	}
}
