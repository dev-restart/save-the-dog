import Matter from 'matter-js';

import { PHYSICS } from '../constants.js';
import { distance, normalizeVector } from '../geometry.js';
import type { Point } from '../types.js';
import type { BeeDifficultyProfile } from './BeeDifficulty.js';
import { closestPointOnBody } from './BeeObstacleGeometry.js';
import type { FindLineBlocker } from './BeeSteering.js';

// 공격 집중점: 한 벌이 방어선을 움직이면 주변 벌이 같은 곳을 공격한다.
interface AttackFocus {
	drawingId: number;
	point: Point;
	registeredAtMs: number;
	beeCount: number;
}

// 방어선 변위 추적: 집단 공격 등록에 사용한다.
interface DrawingSnapshot {
	position: Point;
	angle: number;
}

const FOCUS_EXPIRY_MS = 2000;
const DISPLACEMENT_THRESHOLD = 1.5;
const EDGE_PROXIMITY_RATIO = 0.25;

export class BeeCombat {
	private attackFocusMap = new Map<number, AttackFocus>();
	private drawingSnapshots = new Map<number, DrawingSnapshot>();
	private clockMs = 0;
	private findLineBlocker: FindLineBlocker | null = null;
	private allBees: Matter.Body[] = [];

	constructor(
		private world: Matter.World,
		private profile: BeeDifficultyProfile
	) {}

	// BeeSystem에서 호출해 경로 차단 판정 함수와 전체 벌 목록을 주입한다.
	setContext(findLineBlocker: FindLineBlocker, allBees: Matter.Body[]): void {
		this.findLineBlocker = findLineBlocker;
		this.allBees = allBees;
	}

	beginStep(drawings: Matter.Body[], deltaMs: number): void {
		if (drawings.length === 0) return;
		if (this.profile.combatPushForce <= 0) return;
		this.clockMs += deltaMs;
		this.cleanupExpiredFocus();
		this.trackDrawingDisplacements(drawings);
	}

	attackDrawings(
		bee: Matter.Body,
		dogBody: Matter.Body,
		drawings: Matter.Body[]
	): boolean {
		if (drawings.length === 0) return false;
		if (this.profile.combatPushForce <= 0) return false;

		const collisions = Matter.Query.collides(bee, drawings);
		let attacked = false;

		for (const collision of collisions) {
			const drawing = this.resolveDrawing(collision, bee);
			if (!drawing) continue;

			// 강아지까지 직선 경로가 막혀 있는지 확인한다.
			if (!this.isPathBlocked(bee, dogBody, drawing)) continue;

			// 집단 공격: 이미 다른 벌이 공격 중인 방어선이면 같은 지점을 공격한다.
			const focus = this.attackFocusMap.get(drawing.id);
			const contactPoint = closestPointOnBody(bee.position, drawing);
			const attackPoint = focus && this.isFocusValid(focus)
				? focus.point
				: contactPoint;

			// Stage 4+: 밀기/들기
			this.applyPushForce(bee, drawing, dogBody, attackPoint);

			// Stage 6+: 끌기 (가장자리/끝점에서 더 강하게)
			if (this.profile.combatPullForce > 0) {
				this.applyPullForce(bee, drawing, dogBody, contactPoint);
			}

			// Stage 12+: 회전 (중심에서 벗어난 접촉 시 토크)
			if (this.profile.combatRotateTorque > 0) {
				this.applyRotateTorque(bee, drawing, contactPoint);
			}

			// 변위가 감지되면 집단 공격에 등록한다.
			this.registerAttackFocus(drawing, attackPoint);
			attacked = true;
		}

		return attacked;
	}

	clear(): void {
		this.attackFocusMap.clear();
		this.drawingSnapshots.clear();
		this.clockMs = 0;
		this.findLineBlocker = null;
		this.allBees = [];
	}

	private resolveDrawing(collision: Matter.Collision, bee: Matter.Body): Matter.Body | null {
		const bodyA = collision.bodyA;
		const bodyB = collision.bodyB;
		// compound body의 part가 충돌에 잡히면 부모를 찾는다.
		const drawing = bodyA.label === 'drawing' ? bodyA : bodyB.label === 'drawing' ? bodyB : null;
		if (!drawing || drawing === bee) return null;
		// part인 경우 부모 compound body를 반환한다.
		return drawing.parent !== drawing ? drawing.parent : drawing;
	}

	private isPathBlocked(bee: Matter.Body, dogBody: Matter.Body, drawing: Matter.Body): boolean {
		if (!this.findLineBlocker) return true; // 함수가 없으면 보수적으로 차단된 것으로 간주
		const blocker = this.findLineBlocker(bee.position, dogBody.position, [drawing], PHYSICS.beeRadius + 2);
		return blocker !== null;
	}

	// 밀기/들기: 방어선을 위/옆으로 밀어 빈틈을 만든다.
	private applyPushForce(bee: Matter.Body, drawing: Matter.Body, dogBody: Matter.Body, contactPoint: Point): void {
		const baseForce = this.profile.combatPushForce * this.profile.intelligence;
		if (baseForce <= 0) return;

		// 집단 공격 중이면 참여 벌 수만큼 힘이 증폭된다.
		const focus = this.attackFocusMap.get(drawing.id);
		const collectiveBoost = focus ? Math.min(focus.beeCount, 4) * 0.3 : 0;
		const force = baseForce * (1 + collectiveBoost);

		// 방어선을 위로 들어올리는 힘과 강아지 반대 방향으로 미는 힘을 합성한다.
		const awayFromDog = normalizeVector(
			drawing.position.x - dogBody.position.x,
			drawing.position.y - dogBody.position.y
		);

		Matter.Body.applyForce(drawing, contactPoint, {
			x: awayFromDog.x * force * 0.6,
			y: -Math.abs(force) * 0.8 + awayFromDog.y * force * 0.3
		});
	}

	// 끌기: 방어선 가장자리/끝점에서 강아지 반대 방향으로 끌어당긴다.
	private applyPullForce(bee: Matter.Body, drawing: Matter.Body, dogBody: Matter.Body, contactPoint: Point): void {
		const baseForce = this.profile.combatPullForce * this.profile.intelligence;
		if (baseForce <= 0) return;

		// 가장자리 근접도를 계산한다 (bounds 기준).
		const edgeProximity = this.computeEdgeProximity(drawing, contactPoint);
		// 가장자리에서 더 강하게 끌기
		const force = baseForce * (1 + edgeProximity * 1.5);

		// 강아지에서 방어선 방향으로 끌어당긴다.
		const awayFromDog = normalizeVector(
			contactPoint.x - dogBody.position.x,
			contactPoint.y - dogBody.position.y
		);

		Matter.Body.applyForce(drawing, contactPoint, {
			x: awayFromDog.x * force,
			y: awayFromDog.y * force
		});
	}

	// 회전: 중심에서 벗어난 접촉점에 힘을 가해 토크를 생성한다.
	private applyRotateTorque(bee: Matter.Body, drawing: Matter.Body, contactPoint: Point): void {
		const baseTorque = this.profile.combatRotateTorque * this.profile.intelligence;
		if (baseTorque <= 0) return;

		// 중심에서 접촉점까지의 오프셋이 클수록 회전 효과가 커진다.
		const offsetX = contactPoint.x - drawing.position.x;
		const offsetY = contactPoint.y - drawing.position.y;
		const offsetLength = Math.hypot(offsetX, offsetY);
		if (offsetLength < 2) return; // 중심에 너무 가까우면 회전 효과 없음

		// 수직 방향으로 힘을 가해 회전을 유도한다.
		const perpX = -offsetY / offsetLength;
		const perpY = offsetX / offsetLength;

		// 벌의 위치에 따라 회전 방향을 결정한다.
		const beeSide = (bee.position.x - drawing.position.x) * perpY - (bee.position.y - drawing.position.y) * perpX;
		const direction = beeSide > 0 ? 1 : -1;

		Matter.Body.applyForce(drawing, contactPoint, {
			x: perpX * baseTorque * direction * offsetLength,
			y: perpY * baseTorque * direction * offsetLength
		});
	}

	// 가장자리 근접도: 0(중심)~1(가장자리)
	private computeEdgeProximity(drawing: Matter.Body, point: Point): number {
		const { min, max } = drawing.bounds;
		const centerX = (min.x + max.x) / 2;
		const centerY = (min.y + max.y) / 2;
		const halfWidth = (max.x - min.x) / 2;
		const halfHeight = (max.y - min.y) / 2;
		const maxDist = Math.hypot(halfWidth, halfHeight);
		if (maxDist === 0) return 0;

		const dist = distance(point, { x: centerX, y: centerY });
		return Math.min(1, dist / maxDist);
	}

	// 방어선 변위를 추적해 움직임이 감지되면 집단 공격을 등록한다.
	private trackDrawingDisplacements(drawings: Matter.Body[]): void {
		for (const drawing of drawings) {
			const prev = this.drawingSnapshots.get(drawing.id);
			const current: DrawingSnapshot = {
				position: { x: drawing.position.x, y: drawing.position.y },
				angle: drawing.angle
			};

			if (prev) {
				const displacement = distance(prev.position, current.position);
				const rotation = Math.abs(current.angle - prev.angle);
				if (displacement > DISPLACEMENT_THRESHOLD || rotation > 0.02) {
					// 변위가 감지되면 해당 방어선에 대한 집단 공격을 갱신한다.
					const focus = this.attackFocusMap.get(drawing.id);
					if (focus) {
						focus.registeredAtMs = this.clockMs;
					}
				}
			}

			this.drawingSnapshots.set(drawing.id, current);
		}
	}

	// 집단 공격 등록: 주변 벌이 같은 방어선의 같은 지점을 공격하도록 한다.
	private registerAttackFocus(drawing: Matter.Body, point: Point): void {
		const existing = this.attackFocusMap.get(drawing.id);
		if (existing && this.isFocusValid(existing)) {
			existing.beeCount = Math.min(existing.beeCount + 1, 8);
			existing.registeredAtMs = this.clockMs;
			return;
		}

		this.attackFocusMap.set(drawing.id, {
			drawingId: drawing.id,
			point: { x: point.x, y: point.y },
			registeredAtMs: this.clockMs,
			beeCount: 1
		});
	}

	private isFocusValid(focus: AttackFocus): boolean {
		return this.clockMs - focus.registeredAtMs < FOCUS_EXPIRY_MS;
	}

	private cleanupExpiredFocus(): void {
		for (const [id, focus] of this.attackFocusMap) {
			if (!this.isFocusValid(focus)) {
				this.attackFocusMap.delete(id);
			}
		}
	}
}
