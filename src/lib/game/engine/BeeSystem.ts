import Matter from 'matter-js';

// BeeSystem은 Matter.js 월드와 벌 엔티티 생명주기만 조율한다.
// 경로 탐색은 BeeNavigation, steering은 BeeSteering, 방어선 압박은 BeeCombat으로 분리해 유지보수 범위를 줄인다.
import { PHYSICS } from '../constants.js';
import type { CanvasSize, HiveData, Point } from '../types.js';
import { ObjectFactory } from './ObjectFactory.js';
import { BeeAiScheduler } from './BeeAiScheduler.js';
import { BeeCombat } from './BeeCombat.js';
import { createBeeDifficultyProfile, type BeeDifficultyProfile } from './BeeDifficulty.js';
import { BeeNavigation } from './BeeNavigation.js';
import { BeeSpawner } from './BeeSpawner.js';
import { chooseBeeSteeringDirection } from './BeeSteering.js';

const NAVIGATION_LABELS = new Set(['drawing', 'ground', 'platform', 'wall']);
const BEE_AI_UPDATE_INTERVAL_MS = 50;

interface WorldBodyCache {
	navigationBodies: Matter.Body[];
	drawings: Matter.Body[];
}

export class BeeSystem {
	private spawner: BeeSpawner;
	private bees: Matter.Body[] = [];
	private beeForceById = new Map<number, number>();
	private combat: BeeCombat;
	private navigation: BeeNavigation;
	private profile: BeeDifficultyProfile;
	private aiScheduler = new BeeAiScheduler(BEE_AI_UPDATE_INTERVAL_MS);
	private beeDirectionById = new Map<number, Point>();
	private bodyCache: WorldBodyCache = { navigationBodies: [], drawings: [] };
	private running = false;
	private routeClockMs = 0;

	constructor(
		hives: HiveData[],
		private world: Matter.World,
		private size: CanvasSize,
		private stageId = 1
	) {
		this.spawner = new BeeSpawner(hives);
		this.profile = createBeeDifficultyProfile(stageId);
		this.combat = new BeeCombat(world, this.profile);
		this.navigation = new BeeNavigation(size, this.profile, stageId);
	}

	start(): void {
		this.running = true;
	}

	update(deltaMs: number, dogBody: Matter.Body): void {
		if (!this.running) return;
		this.routeClockMs += deltaMs;

		for (const hive of this.spawner.collectDueSpawns(deltaMs, this.bees.length)) {
			this.spawnBee(hive);
		}

		const hasBeeWithoutDirection = this.bees.some((bee) => !this.beeDirectionById.has(bee.id));
		const shouldRefreshAi = this.aiScheduler.tick(deltaMs, hasBeeWithoutDirection);
		if (shouldRefreshAi) {
			this.refreshBodyCache();
		}

		for (const bee of this.bees) {
			if (shouldRefreshAi || !this.beeDirectionById.has(bee.id)) {
				this.refreshBeeDirection(bee, dogBody);
			}

			const direction = this.beeDirectionById.get(bee.id) ?? { x: 0, y: 0 };
			const force = hiveForce(direction, this.beeForceById.get(bee.id) ?? 0.002, this.profile.forceMultiplier);
			Matter.Body.applyForce(bee, bee.position, force);
			this.combat.attackDrawings(bee, dogBody, this.bodyCache.drawings, deltaMs);
			capVelocity(bee, this.profile.maxSpeed);
		}

		this.removeOutOfBounds();
	}

	destroy(): void {
		this.running = false;
		for (const bee of this.bees) {
			Matter.Composite.remove(this.world, bee);
		}
		this.bees = [];
		this.navigation.clearCache();
		this.aiScheduler.reset();
		this.beeDirectionById.clear();
		this.bodyCache = { navigationBodies: [], drawings: [] };
		this.beeForceById.clear();
		this.combat.clear();
	}

	getBees(): Matter.Body[] {
		return this.bees;
	}

	private spawnBee(hive: HiveData): void {
		const bee = ObjectFactory.createBee({ x: hive.x, y: hive.y }, this.size);
		Matter.Body.setVelocity(bee, {
			x: (Math.random() - 0.5) * 2,
			y: Math.random() * 2
		});
		Matter.Composite.add(this.world, bee);
		this.beeForceById.set(bee.id, hive.beeForce ?? 0.002);
		this.bees.push(bee);
	}

	private refreshBodyCache(): void {
		const bodies = Matter.Composite.allBodies(this.world);
		const drawings = bodies.filter((body) => body.label === 'drawing');
		this.bodyCache = {
			drawings,
			// 경로 탐색은 compound 부모의 볼록 hull이 아니라 실제 잉크 조각 기준으로 빈틈을 판단한다.
			navigationBodies: bodies.flatMap((body) => navigationBodyParts(body))
		};
	}

	private refreshBeeDirection(bee: Matter.Body, dogBody: Matter.Body): void {
		// A*와 blocker 탐지는 CPU 비용이 커서 fixed-step마다 돌리지 않고 짧은 AI tick마다 방향만 갱신한다.
		const target = this.navigation.chooseTarget(bee, dogBody.position, this.bodyCache.navigationBodies, this.routeClockMs);
		const direction = chooseBeeSteeringDirection(
			bee.position,
			target,
			this.bodyCache.navigationBodies,
			this.profile,
			this.navigation.findLineBlocker.bind(this.navigation)
		);
		this.beeDirectionById.set(bee.id, direction);
	}

	private removeOutOfBounds(): void {
		const margin = 120;
		const active: Matter.Body[] = [];
		for (const bee of this.bees) {
			const outside =
				bee.position.x < -margin ||
				bee.position.x > this.size.width + margin ||
				bee.position.y < -margin ||
				bee.position.y > this.size.height + margin;

			if (outside) {
				Matter.Composite.remove(this.world, bee);
				this.navigation.clearCache(bee.id);
				this.beeDirectionById.delete(bee.id);
				this.beeForceById.delete(bee.id);
			} else {
				active.push(bee);
			}
		}
		this.bees = active;
	}
}

function navigationBodyParts(body: Matter.Body): Matter.Body[] {
	if (!NAVIGATION_LABELS.has(body.label)) return [];
	if (body.label !== 'drawing' || body.parts.length <= 1) return [body];
	return body.parts.slice(1);
}

function hiveForce(direction: Point, beeForce: number, forceMultiplier: number): Matter.Vector {
	const force = beeForce * forceMultiplier;
	return {
		x: direction.x * force,
		y: direction.y * force
	};
}

function capVelocity(body: Matter.Body, maxSpeed: number): void {
	const speed = Math.hypot(body.velocity.x, body.velocity.y);
	if (speed <= maxSpeed) return;

	const ratio = maxSpeed / speed;
	Matter.Body.setVelocity(body, {
		x: body.velocity.x * ratio,
		y: body.velocity.y * ratio
	});
}
