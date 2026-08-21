import Matter from 'matter-js';
import { PHYSICS } from '../constants.js';
import { getSkinDefinition, type SkinAsset, type SkinDefinition } from '../skins.js';
import type { BodyLabel, CanvasSize, GamePhase, Point, SkinId, StageEnvironment } from '../types.js';
import type { DrawingBodyPlugin } from './ObjectFactory.js';

type CircleBody = Matter.Body & { circleRadius?: number };

interface ExplosionEffect {
	point: Point;
	startedAt: number;
	durationMs: number;
}

function now(): number {
	return globalThis.performance?.now?.() ?? Date.now();
}

const BODY_COLORS: Record<string, string> = {
	ground: '#3f8f52',
	platform: '#4f9f62',
	drawing: '#8b5a2b',
	water: '#38bdf8',
	lava: '#f97316',
	brick: '#b96b38',
	'terrain-block': '#b96b38',
	wood: '#9a6a35',
	bomb: '#1f2937',
	boulder: '#6b7280',
	crate: '#a16207',
	acid: '#84cc16',
	ice: '#93c5fd',
	stone: '#64748b',
	'rolling-boulder': '#475569',
	wall: 'transparent',
	deadzone: 'transparent'
};

export class CanvasRenderer {
	private skin: SkinDefinition;
	private images = new Map<SkinAsset, HTMLImageElement>();
	private backgroundCache: HTMLCanvasElement | null = null;
	private backgroundCacheKey = '';
	private explosions: ExplosionEffect[] = [];

	constructor(skin: SkinId = 'classic', private backgroundEnvironment: StageEnvironment = 'meadow') {
		this.skin = getSkinDefinition(skin);
		this.loadImages();
	}

	draw(
		ctx: CanvasRenderingContext2D,
		world: Matter.World,
		phase: GamePhase,
		drawingPoints: Point[],
		inkRatio: number,
		timestamp = now(),
		viewport?: CanvasSize
	): void {
		const width = viewport?.width ?? (ctx.canvas.clientWidth || ctx.canvas.width);
		const height = viewport?.height ?? (ctx.canvas.clientHeight || ctx.canvas.height);
		this.drawBackground(ctx, phase, { width, height });

		// 지형 바디를 먼저 그려 배경과 통합된 느낌을 준다.
		const bodies = Matter.Composite.allBodies(world);
		const terrainBodies = bodies.filter((body) => this.isTerrainBody(body.label as BodyLabel));
		const otherBodies = bodies.filter((body) => !this.isTerrainBody(body.label as BodyLabel));

		for (const body of terrainBodies) {
			this.drawBody(ctx, body, phase, terrainBodies);
		}
		for (const body of otherBodies) {
			this.drawBody(ctx, body, phase);
		}

		if (drawingPoints.length > 1) {
			this.drawDrawingPreview(ctx, drawingPoints, inkRatio);
		}
		this.drawExplosions(ctx, timestamp);
	}

	triggerExplosion(point: Point): void {
		this.explosions.push({ point: { ...point }, startedAt: now(), durationMs: PHYSICS.bombExplosionDurationMs });
	}

	private isTerrainBody(label: BodyLabel): boolean {
		return (
			label === 'ground' ||
			label === 'brick' ||
			label === 'terrain-block' ||
			label === 'stone' ||
			label === 'wood' ||
			label === 'platform' ||
			label === 'ice' ||
			label === 'water' ||
			label === 'lava' ||
			label === 'acid' ||
			label === 'no-draw-zone' ||
			label === 'no-draw-ground' ||
			label === 'no-draw-tree' ||
			label === 'no-draw-rock'
		);
	}

	private drawBackground(ctx: CanvasRenderingContext2D, phase: GamePhase, viewport?: CanvasSize): void {
		const width = viewport?.width ?? (ctx.canvas.clientWidth || ctx.canvas.width);
		const height = viewport?.height ?? (ctx.canvas.clientHeight || ctx.canvas.height);
		const environmentBackground =
			this.backgroundEnvironment === 'volcanic'
				? this.getImage('volcanoBackground')
				: this.backgroundEnvironment === 'forest'
					? this.getImage('forestBackground')
					: null;
		const background = environmentBackground ?? this.getImage('background');
		if (background) {
			const cachedBackground = this.getScaledBackground(background, width, height);
			ctx.drawImage(cachedBackground ?? background, 0, 0, width, height);
			if (phase === 'failed') {
				ctx.fillStyle = 'rgba(190, 18, 60, 0.2)';
				ctx.fillRect(0, 0, width, height);
			}
			return;
		}

		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, '#96d8ff');
		gradient.addColorStop(0.58, '#d7f7ff');
		gradient.addColorStop(1, '#b8efb8');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = 'rgba(255,255,255,0.45)';
		this.drawCloud(ctx, width * 0.2, height * 0.13, 36);
		this.drawCloud(ctx, width * 0.76, height * 0.2, 28);

		if (phase === 'failed') {
			ctx.fillStyle = 'rgba(190, 18, 60, 0.2)';
			ctx.fillRect(0, 0, width, height);
		}
	}

	private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
		ctx.beginPath();
		ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
		ctx.arc(x + size * 0.36, y - size * 0.1, size * 0.34, 0, Math.PI * 2);
		ctx.arc(x + size * 0.72, y, size * 0.42, 0, Math.PI * 2);
		ctx.fill();
	}

	private drawBody(ctx: CanvasRenderingContext2D, body: Matter.Body, phase: GamePhase, terrainBodies: Matter.Body[] = []): void {
		const label = body.label as BodyLabel;
		if (label === 'wall' || label === 'deadzone') return;

		if (label === 'dog') {
			const dogAsset: SkinAsset = phase === 'failed' ? 'dogHurt' : 'dog';
			if (!this.drawCircleImage(ctx, body as CircleBody, dogAsset, 2.55)) {
				this.drawDog(ctx, body as CircleBody);
			}
			return;
		}
		if (label === 'bee') {
			if (!this.drawCircleImage(ctx, body as CircleBody, 'bee', 3.2, Math.atan2(body.velocity.y, body.velocity.x))) {
				this.drawBee(ctx, body as CircleBody);
			}
			return;
		}
		if (label === 'hive') {
			if (!this.drawBodyImage(ctx, body, 'hive')) {
				this.drawHive(ctx, body);
			}
			return;
		}
		if (label === 'spike') {
			if (!this.drawRepeatedBodyImage(ctx, body, 'spike', 'x')) {
				this.drawSpike(ctx, body);
			}
			return;
		}
		if (label === 'water') {
			this.drawWater(ctx, body);
			return;
		}
		if (label === 'lava') {
			this.drawLava(ctx, body);
			return;
		}
		if (label === 'acid') {
			this.drawAcid(ctx, body);
			return;
		}
		if (label === 'ice') {
			if (this.drawBodyImage(ctx, body, 'ice')) return;
		}
		if (label === 'stone') {
			if (!this.drawTextureBody(ctx, body, 'terrainStone', 92)) this.drawBodyImage(ctx, body, 'stonePillar');
			return;
		}
		if (label === 'brick') {
			this.drawBrick(ctx, body);
			return;
		}
		if (label === 'terrain-block') {
			if (!this.drawTiledTerrainImage(ctx, body, isTerrainTopExposed(body, terrainBodies))) this.drawGrassBlockTerrain(ctx, body);
			return;
		}
		if (label === 'wood') {
			if (!this.drawRepeatedBodyImage(ctx, body, 'wood', 'x')) {
				this.drawWood(ctx, body);
			}
			return;
		}
		if (label === 'bomb' || label === 'boulder' || label === 'crate') {
			if (this.drawBodyImage(ctx, body, label)) return;
		}
		if (label === 'rolling-boulder') {
			if (this.drawBodyImage(ctx, body, 'rollingBoulder')) return;
		}
		if (label === 'ground') {
			if (!this.drawTiledTerrainImage(ctx, body, isTerrainTopExposed(body, terrainBodies))) this.drawGrassBlockTerrain(ctx, body);
			return;
		}
		if (label === 'platform') {
			if (this.drawRepeatedBodyImage(ctx, body, label, 'x')) return;
		}
		if (label === 'no-draw-zone') {
			if (!this.drawTiledTerrainImage(ctx, body, isTerrainTopExposed(body, terrainBodies))) this.drawNoDrawZone(ctx, body);
			return;
		}
		if (label === 'no-draw-ground') {
			if (!this.drawTiledTerrainImage(ctx, body, isTerrainTopExposed(body, terrainBodies))) this.drawGrassBlockTerrain(ctx, body);
			return;
		}
		if (label === 'no-draw-tree') {
			if (!this.drawBodyImage(ctx, body, 'noDrawTree')) this.drawTree(ctx, body);
			return;
		}
		if (label === 'no-draw-rock') {
			if (!this.drawBodyImage(ctx, body, 'noDrawRock')) this.drawPolygon(ctx, body, '#64748b', '#334155', 2);
			return;
		}
		if (label === 'drawing') {
			this.drawDrawingBody(ctx, body);
			return;
		}

		this.drawPolygon(ctx, body, BODY_COLORS[label] ?? '#64748b', '#1f2937', 2);
	}

	private loadImages(): void {
		if (typeof Image === 'undefined') return;

		for (const [key, src] of Object.entries(this.skin.assets) as [SkinAsset, string][]) {
			const image = new Image();
			image.decoding = 'async';
			image.src = src;
			this.images.set(key, image);
		}
	}

	private getImage(asset: SkinAsset): HTMLImageElement | null {
		const image = this.images.get(asset);
		if (!image?.complete || image.naturalWidth === 0) return null;
		return image;
	}

	private getScaledBackground(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement | null {
		if (typeof document === 'undefined') return null;

		const cacheKey = `${image.currentSrc || image.src}:${Math.round(width)}x${Math.round(height)}`;
		if (this.backgroundCache && this.backgroundCacheKey === cacheKey) return this.backgroundCache;

		// 큰 배경 이미지를 매 프레임 다시 스케일링하면 고해상도 브라우저에서 GPU/메모리 대역폭이 커진다.
		// 크기가 바뀔 때만 한 번 축소해 두고, 프레임에서는 이미 맞춰진 캔버스를 빠르게 복사한다.
		const cache = document.createElement('canvas');
		cache.width = Math.max(1, Math.round(width));
		cache.height = Math.max(1, Math.round(height));
		const cacheContext = cache.getContext('2d');
		if (!cacheContext) return null;

		cacheContext.drawImage(image, 0, 0, cache.width, cache.height);
		this.backgroundCache = cache;
		this.backgroundCacheKey = cacheKey;
		return cache;
	}

	private drawCircleImage(
		ctx: CanvasRenderingContext2D,
		body: CircleBody,
		asset: SkinAsset,
		scale: number,
		angle = body.angle
	): boolean {
		const image = this.getImage(asset);
		if (!image) return false;

		const radius = body.circleRadius ?? PHYSICS.dogRadius;
		const size = radius * scale;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(angle);
		ctx.drawImage(image, -size / 2, -size / 2, size, size);
		ctx.restore();
		return true;
	}

	private drawBodyImage(ctx: CanvasRenderingContext2D, body: Matter.Body, asset: SkinAsset): boolean {
		const image = this.getImage(asset);
		if (!image) return false;

		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		if (
			((asset === 'noDrawZone' || asset === 'noDrawTree' || asset === 'noDrawRock') && this.skin.id !== 'classic') ||
			(asset === 'rollingBoulder' && this.skin.id !== 'classic')
		) {
			// 이미지젠 시트는 흰 배경으로 분리했다. multiply를 사용하면 흰 여백이 게임 배경을 덮지 않는다.
			ctx.globalCompositeOperation = 'multiply';
		}
		ctx.drawImage(image, -width / 2, -height / 2, width, height);
		ctx.restore();
		return true;
	}

	private drawRepeatedBodyImage(ctx: CanvasRenderingContext2D, body: Matter.Body, asset: SkinAsset, axis: 'x' | 'y'): boolean {
		const image = this.getImage(asset);
		if (!image) return false;

		const { width, height } = getBodySize(body);
		const left = -width / 2;
		const top = -height / 2;
		const tileWidth = axis === 'x' ? height * (image.naturalWidth / image.naturalHeight) : width;
		const tileHeight = axis === 'y' ? width * (image.naturalHeight / image.naturalWidth) : height;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		this.clipBodyShape(ctx, body);
		for (let x = left, y = top; x < left + width - 0.1 && y < top + height - 0.1; x += axis === 'x' ? tileWidth : 0, y += axis === 'y' ? tileHeight : 0) {
			ctx.drawImage(image, x, y, tileWidth, tileHeight);
		}
		ctx.restore();
		return true;
	}

	private drawGridBodyImage(ctx: CanvasRenderingContext2D, body: Matter.Body, asset: SkinAsset): boolean {
		const image = this.getImage(asset);
		if (!image) return false;

		const { width, height } = getBodySize(body);
		const left = -width / 2;
		const top = -height / 2;
		const sourceInsetX = image.naturalWidth * 0.024;
		const sourceInsetY = image.naturalHeight * 0.066;
		const sourceWidth = image.naturalWidth - sourceInsetX * 2;
		const sourceHeight = image.naturalHeight - sourceInsetY * 2;
		const tileHeight = Math.min(42, Math.max(28, height));
		const tileWidth = tileHeight * (sourceWidth / sourceHeight);

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.beginPath();
		ctx.rect(left, top, width, height);
		ctx.clip();
		for (let y = top; y < top + height - 0.1; y += tileHeight) {
			for (let x = left; x < left + width - 0.1; x += tileWidth) {
				ctx.drawImage(image, sourceInsetX, sourceInsetY, sourceWidth, sourceHeight, x, y, tileWidth, tileHeight);
			}
		}
		ctx.restore();
		return true;
	}

	private drawTiledTerrainImage(ctx: CanvasRenderingContext2D, body: Matter.Body, drawGrassCap = true): boolean {
		const dirt = this.getImage('terrainDirt');
		const grass = this.getImage('terrainGrassCap');
		if (!dirt) return false;

		const bounds = getBodyLocalBounds(body);
		const height = bounds.maxY - bounds.minY;
		const tileSize = 224;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		// Compound Prefab의 빈 동굴·ㄷ자 내부까지 바운딩 사각형으로 칠하지 않는다.
		// 물리와 Drawing 금지에 쓰는 실제 part polygon을 그대로 시각 clipping에 사용한다.
		this.clipBodyShape(ctx, body);

		for (let y = bounds.minY; y < bounds.maxY - 0.1; y += tileSize) {
			for (let x = bounds.minX; x < bounds.maxX - 0.1; x += tileSize) {
				ctx.drawImage(dirt, x, y, tileSize, tileSize);
			}
		}

		const supportSegments = (body.plugin as { terrainSupportSegments?: Array<{ from: Point; to: Point }> }).terrainSupportSegments;
		if (drawGrassCap && grass && supportSegments?.length) {
			ctx.restore();
			for (const segment of supportSegments) {
				const length = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
				const angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x);
				const capHeight = 14;
				ctx.save();
				ctx.translate((segment.from.x + segment.to.x) / 2, (segment.from.y + segment.to.y) / 2);
				ctx.rotate(angle);
				ctx.drawImage(grass, -length / 2, -capHeight * 0.58, length, capHeight);
				ctx.restore();
			}
			return true;
		}
		if (drawGrassCap && grass) {
			const capHeight = Math.min(15, Math.max(9, height * 0.22));
			const stripWidth = Math.max(100, capHeight * (grass.naturalWidth / grass.naturalHeight));
			for (let x = bounds.minX; x < bounds.maxX - 0.1; x += stripWidth) {
				ctx.drawImage(grass, x, bounds.minY - 1, stripWidth, capHeight);
			}
		}
		ctx.restore();
		return true;
	}

	private drawTextureBody(ctx: CanvasRenderingContext2D, body: Matter.Body, asset: SkinAsset, tileSize: number): boolean {
		const image = this.getImage(asset);
		if (!image) return false;
		const bounds = getBodyLocalBounds(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		this.clipBodyShape(ctx, body);
		for (let y = bounds.minY; y < bounds.maxY - 0.1; y += tileSize) {
			for (let x = bounds.minX; x < bounds.maxX - 0.1; x += tileSize) ctx.drawImage(image, x, y, tileSize, tileSize);
		}
		ctx.restore();
		return true;
	}

	private clipBodyShape(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
		const cosine = Math.cos(-body.angle);
		const sine = Math.sin(-body.angle);
		ctx.beginPath();
		for (const part of parts) {
			part.vertices.forEach((vertex, index) => {
				const dx = vertex.x - body.position.x;
				const dy = vertex.y - body.position.y;
				const x = dx * cosine - dy * sine;
				const y = dx * sine + dy * cosine;
				if (index === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.closePath();
		}
		ctx.clip();
	}

	private drawExplosions(ctx: CanvasRenderingContext2D, timestamp: number): void {
		this.explosions = this.explosions.filter((effect) => timestamp - effect.startedAt < effect.durationMs);
		for (const effect of this.explosions) {
			const progress = Math.max(0, Math.min(1, (timestamp - effect.startedAt) / effect.durationMs));
			const size = 54 + progress * 106;
			ctx.save();
			ctx.globalAlpha = Math.max(0, 1 - progress * progress);
			ctx.translate(effect.point.x, effect.point.y);
			ctx.rotate(progress * 0.22);
			const image = this.getImage('explosion');
			if (image) {
				ctx.drawImage(image, -size / 2, -size / 2, size, size);
			} else {
				const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, size / 2);
				gradient.addColorStop(0, '#fff7cc');
				gradient.addColorStop(0.4, '#fbbf24');
				gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}
	}

	private drawDrawingBody(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const drawingPath = (body.plugin as DrawingBodyPlugin | undefined)?.drawingPath;
		if (drawingPath && drawingPath.length > 1) {
			this.drawOriginalDrawingPath(ctx, body, drawingPath);
			return;
		}

		// 잉크는 compound body의 실제 조각들을 각각 그려야 한다.
		// 부모 body의 꼭짓점만 칠하면 빈틈이 막힌 큰 볼록 다각형처럼 보여 플레이 감각이 달라진다.
		const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
		for (const part of parts) {
			this.drawBarrierPart(ctx, part);
		}
	}

	private drawOriginalDrawingPath(ctx: CanvasRenderingContext2D, body: Matter.Body, path: Point[]): void {
		const thickness = (body.plugin as DrawingBodyPlugin | undefined)?.drawingThickness ?? PHYSICS.drawingThickness;
		const [first, ...rest] = path;
		if (!first) return;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.shadowColor = 'rgba(2, 6, 23, 0.16)';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetY = 1;

		ctx.beginPath();
		ctx.moveTo(first.x, first.y);
		for (const point of rest) ctx.lineTo(point.x, point.y);
		ctx.strokeStyle = 'rgba(2, 6, 23, 0.2)';
		ctx.lineWidth = thickness + 3;
		ctx.stroke();

		ctx.shadowColor = 'transparent';
		ctx.beginPath();
		ctx.moveTo(first.x, first.y);
		for (const point of rest) ctx.lineTo(point.x, point.y);
		ctx.strokeStyle = this.skin.drawingFill;
		ctx.lineWidth = thickness;
		ctx.stroke();
		ctx.restore();
	}

	private drawBarrierPart(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const { width, height } = getBodySize(body);
		const radius = body.circleRadius ?? Math.min(width, height) / 2;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.shadowColor = 'rgba(2, 6, 23, 0.18)';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetY = 1;
		ctx.fillStyle = this.skin.drawingFill;
		ctx.strokeStyle = this.skin.drawingStroke;
		ctx.lineWidth = 1;

		ctx.beginPath();
		if (body.circleRadius) {
			ctx.shadowBlur = 0;
			ctx.arc(0, 0, radius, 0, Math.PI * 2);
		} else if (typeof ctx.roundRect === 'function') {
			ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(height / 2, 12));
		} else {
			ctx.rect(-width / 2, -height / 2, width, height);
		}
		ctx.fill();
		ctx.shadowColor = 'transparent';
		if (!body.circleRadius) ctx.stroke();
		ctx.restore();
	}

	private drawPolygon(ctx: CanvasRenderingContext2D, body: Matter.Body, fill: string, stroke: string, lineWidth: number): void {
		const [first, ...rest] = body.vertices;
		if (!first) return;

		ctx.beginPath();
		ctx.moveTo(first.x, first.y);
		for (const vertex of rest) {
			ctx.lineTo(vertex.x, vertex.y);
		}
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = lineWidth;
		ctx.stroke();
	}

	private drawDog(ctx: CanvasRenderingContext2D, body: CircleBody): void {
		const radius = body.circleRadius ?? PHYSICS.dogRadius;
		const { x, y } = body.position;

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(body.angle);

		ctx.fillStyle = '#b7793b';
		ctx.beginPath();
		ctx.arc(0, 0, radius, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#8a4d24';
		ctx.beginPath();
		ctx.ellipse(-radius * 0.7, -radius * 0.5, radius * 0.35, radius * 0.55, -0.45, 0, Math.PI * 2);
		ctx.ellipse(radius * 0.7, -radius * 0.5, radius * 0.35, radius * 0.55, 0.45, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#111827';
		ctx.beginPath();
		ctx.arc(-radius * 0.35, -radius * 0.05, radius * 0.09, 0, Math.PI * 2);
		ctx.arc(radius * 0.35, -radius * 0.05, radius * 0.09, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#2f1c12';
		ctx.beginPath();
		ctx.arc(0, radius * 0.22, radius * 0.15, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	private drawBee(ctx: CanvasRenderingContext2D, body: CircleBody): void {
		const radius = body.circleRadius ?? PHYSICS.beeRadius;
		const { x, y } = body.position;

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(Math.atan2(body.velocity.y, body.velocity.x));

		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.beginPath();
		ctx.ellipse(-radius * 0.15, -radius * 0.75, radius * 0.55, radius * 0.35, -0.45, 0, Math.PI * 2);
		ctx.ellipse(-radius * 0.15, radius * 0.75, radius * 0.55, radius * 0.35, 0.45, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#facc15';
		ctx.beginPath();
		ctx.ellipse(0, 0, radius * 1.25, radius, 0, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = '#111827';
		ctx.lineWidth = Math.max(1.5, radius * 0.25);
		for (const offset of [-0.45, 0.1, 0.55]) {
			ctx.beginPath();
			ctx.moveTo(radius * offset, -radius * 0.75);
			ctx.lineTo(radius * offset, radius * 0.75);
			ctx.stroke();
		}

		ctx.restore();
	}

	private drawHive(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const bounds = body.bounds;
		const width = bounds.max.x - bounds.min.x;
		const height = bounds.max.y - bounds.min.y;
		const { x, y } = body.position;

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(body.angle);
		ctx.fillStyle = '#d97706';
		ctx.strokeStyle = '#78350f';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(-width * 0.4, -height * 0.45);
		ctx.lineTo(width * 0.4, -height * 0.45);
		ctx.lineTo(width * 0.52, 0);
		ctx.lineTo(width * 0.32, height * 0.45);
		ctx.lineTo(-width * 0.32, height * 0.45);
		ctx.lineTo(-width * 0.52, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		ctx.strokeStyle = '#fbbf24';
		for (let row = -1; row <= 1; row += 1) {
			ctx.beginPath();
			ctx.moveTo(-width * 0.35, row * height * 0.22);
			ctx.lineTo(width * 0.35, row * height * 0.22);
			ctx.stroke();
		}

		ctx.fillStyle = '#451a03';
		ctx.beginPath();
		ctx.arc(0, height * 0.18, height * 0.13, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	private drawSpike(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const bounds = body.bounds;
		const width = bounds.max.x - bounds.min.x;
		const height = bounds.max.y - bounds.min.y;
		const count = Math.max(2, Math.floor(width / 22));
		const toothWidth = width / count;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.fillStyle = '#9ca3af';
		ctx.strokeStyle = '#374151';
		ctx.lineWidth = 2;

		for (let index = 0; index < count; index += 1) {
			const left = -width / 2 + index * toothWidth;
			ctx.beginPath();
			ctx.moveTo(left, height / 2);
			ctx.lineTo(left + toothWidth / 2, -height / 2);
			ctx.lineTo(left + toothWidth, height / 2);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		ctx.restore();
	}

	private drawWater(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		if (!this.drawRepeatedBodyImage(ctx, body, 'water', 'x')) {
			this.drawHazardPool(ctx, body, '#38bdf8', '#0369a1', '#e0f2fe', '#0ea5e9');
		}
		this.drawLiquidMotion(ctx, body, 'water');
	}

	private drawLava(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		if (!this.drawRepeatedBodyImage(ctx, body, 'lava', 'x')) {
			this.drawHazardPool(ctx, body, '#fb923c', '#9a3412', '#fde047', '#f97316');
		}
		this.drawLiquidMotion(ctx, body, 'lava');
	}

	private drawLiquidMotion(ctx: CanvasRenderingContext2D, body: Matter.Body, kind: 'water' | 'lava'): void {
		const { width, height } = getBodySize(body);
		const phase = now() / (kind === 'water' ? 520 : 360);
		const left = -width / 2;
		const top = -height / 2;

		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.beginPath();
		ctx.rect(left, top, width, height);
		ctx.clip();

		ctx.strokeStyle = kind === 'water' ? 'rgba(224, 242, 254, 0.8)' : 'rgba(254, 240, 138, 0.9)';
		ctx.lineWidth = kind === 'water' ? 2 : 2.6;
		ctx.beginPath();
		for (let x = left - 8; x <= left + width + 8; x += 8) {
			const y = top + 5 + Math.sin(x * 0.09 + phase) * (kind === 'water' ? 2.2 : 3.2);
			if (x === left - 8) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		const particleCount = Math.max(2, Math.min(7, Math.round(width / 54)));
		for (let index = 0; index < particleCount; index += 1) {
			const travel = (phase * (kind === 'water' ? 9 : 15) + index * 31) % Math.max(18, height - 8);
			const x = left + ((index + 0.55) / particleCount) * width + Math.sin(phase + index) * 4;
			const y = top + height - travel;
			ctx.fillStyle = kind === 'water' ? 'rgba(224, 242, 254, 0.55)' : 'rgba(253, 224, 71, 0.78)';
			ctx.beginPath();
			ctx.arc(x, y, kind === 'water' ? 1.8 + (index % 2) : 1.4 + (index % 3) * 0.5, 0, Math.PI * 2);
			ctx.fill();
		}

		if (kind === 'lava') {
			ctx.globalCompositeOperation = 'screen';
			ctx.globalAlpha = 0.1 + (Math.sin(phase * 1.7) + 1) * 0.04;
			ctx.fillStyle = '#fde047';
			ctx.fillRect(left, top, width, height);
		}
		ctx.restore();
	}

	private drawAcid(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		if (this.drawRepeatedBodyImage(ctx, body, 'acid', 'x')) return;
		this.drawHazardPool(ctx, body, '#a3e635', '#3f6212', '#ecfccb', '#65a30d');
	}

	private drawBrick(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		this.drawBlockTerrain(ctx, body, 'dirt');
	}

	private drawGrassBlockTerrain(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		this.drawBlockTerrain(ctx, body, 'grass');
	}

	private drawBlockTerrain(ctx: CanvasRenderingContext2D, body: Matter.Body, variant: 'dirt' | 'grass'): void {
		const { width, height } = getBodySize(body);
		const tile = Math.max(12, Math.min(22, Math.min(width, height) / 2));
		const left = -width / 2;
		const top = -height / 2;
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);

		for (let row = 0, y = top; y < top + height - 0.1; row += 1, y += tile) {
			const rowHeight = Math.min(tile, top + height - y);
			const offset = row % 2 === 0 ? 0 : tile / 2;
			for (let x = left - offset; x < left + width - 0.1; x += tile) {
				const cellX = Math.max(left, x);
				const cellWidth = Math.min(tile, left + width - cellX);
				ctx.fillStyle = row % 2 === 0 ? '#c9783d' : '#b96532';
				ctx.strokeStyle = '#7c3f20';
				ctx.lineWidth = 1.2;
				if (typeof ctx.roundRect === 'function') {
					ctx.beginPath();
					ctx.roundRect(cellX + 0.7, y + 0.7, Math.max(1, cellWidth - 1.4), Math.max(1, rowHeight - 1.4), Math.min(4, tile * 0.16));
					ctx.fill();
					ctx.stroke();
				} else {
					ctx.fillRect(cellX + 0.7, y + 0.7, Math.max(1, cellWidth - 1.4), Math.max(1, rowHeight - 1.4));
					ctx.strokeRect(cellX + 0.7, y + 0.7, Math.max(1, cellWidth - 1.4), Math.max(1, rowHeight - 1.4));
				}
			}
		}

		if (variant === 'grass') {
			const grassHeight = Math.min(Math.max(8, tile * 0.52), height);
			ctx.fillStyle = '#73c83b';
			ctx.strokeStyle = '#3f8f2f';
			ctx.lineWidth = 1.5;
			ctx.fillRect(left, top, width, grassHeight);
			ctx.strokeRect(left, top, width, grassHeight);
			ctx.strokeStyle = 'rgba(220, 255, 137, 0.8)';
			ctx.lineWidth = 1.4;
			for (let x = left + 8; x < left + width - 4; x += 16) {
				ctx.beginPath();
				ctx.moveTo(x, top + grassHeight * 0.56);
				ctx.lineTo(Math.min(left + width - 4, x + 7), top + grassHeight * 0.56);
				ctx.stroke();
			}
		}
		ctx.restore();
	}

	private drawWood(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		const gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
		gradient.addColorStop(0, '#c98a40');
		gradient.addColorStop(0.55, '#9a6a35');
		gradient.addColorStop(1, '#6b3f1d');
		ctx.fillStyle = gradient;
		ctx.strokeStyle = '#4a2a13';
		ctx.lineWidth = 2;
		ctx.fillRect(-width / 2, -height / 2, width, height);
		ctx.strokeRect(-width / 2, -height / 2, width, height);

		ctx.strokeStyle = 'rgba(74, 42, 19, 0.42)';
		ctx.lineWidth = 1.5;
		for (let y = -height * 0.28; y <= height * 0.32; y += Math.max(8, height / 3)) {
			ctx.beginPath();
			ctx.moveTo(-width / 2 + 8, y);
			for (let x = -width / 2 + 8; x < width / 2 - 8; x += 20) {
				ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
			}
			ctx.stroke();
		}
		ctx.restore();
	}

	private drawHazardPool(ctx: CanvasRenderingContext2D, body: Matter.Body, fill: string, stroke: string, highlight: string, shade: string): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		const tile = Math.max(12, Math.min(22, Math.min(width, height)));
		const left = -width / 2;
		const top = -height / 2;
		ctx.fillStyle = fill;
		ctx.fillRect(left, top, width, height);
		ctx.strokeStyle = stroke;
		ctx.lineWidth = 2;
		ctx.strokeRect(left, top, width, height);
		ctx.strokeStyle = shade;
		ctx.lineWidth = 1;
		for (let x = left + tile; x < left + width; x += tile) {
			ctx.beginPath();
			ctx.moveTo(x, top + tile * 0.44);
			ctx.lineTo(x, top + height);
			ctx.stroke();
		}
		for (let y = top + tile; y < top + height; y += tile) {
			ctx.beginPath();
			ctx.moveTo(left, y);
			ctx.lineTo(left + width, y);
			ctx.stroke();
		}

		ctx.strokeStyle = highlight;
		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		for (let x = -width / 2 + 14; x < width / 2; x += 36) {
			ctx.beginPath();
			ctx.moveTo(x, -height * 0.18);
			ctx.quadraticCurveTo(x + 9, -height * 0.32, x + 18, -height * 0.18);
			ctx.quadraticCurveTo(x + 27, -height * 0.04, x + 36, -height * 0.18);
			ctx.stroke();
		}
		ctx.restore();
	}

	private drawNoDrawZone(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);

		// 지형 자체는 읽히되, 금지 아이콘을 그려 플레이 화면을 오염시키지 않는다.
		ctx.fillStyle = 'rgba(71, 85, 105, 0.18)';
		ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);

		ctx.beginPath();
		if (typeof ctx.roundRect === 'function') {
			ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(8, height / 2));
		} else {
			ctx.rect(-width / 2, -height / 2, width, height);
		}
		ctx.fill();
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.restore();
	}

	private drawTree(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.fillStyle = '#6b3f1d';
		ctx.fillRect(-width * 0.12, height * 0.05, width * 0.24, height * 0.42);
		ctx.fillStyle = '#3f8f52';
		ctx.strokeStyle = '#1f5f38';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, -height * 0.16, width * 0.34, 0, Math.PI * 2);
		ctx.arc(-width * 0.24, height * 0.02, width * 0.26, 0, Math.PI * 2);
		ctx.arc(width * 0.24, height * 0.02, width * 0.26, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	private drawDrawingPreview(ctx: CanvasRenderingContext2D, points: Point[], inkRatio: number): void {
		const [first, ...rest] = points;
		if (!first) return;

		ctx.beginPath();
		ctx.moveTo(first.x, first.y);
		for (const point of rest) ctx.lineTo(point.x, point.y);
		ctx.strokeStyle = 'rgba(2, 6, 23, 0.22)';
		ctx.lineWidth = 12;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(first.x, first.y);
		for (const point of rest) ctx.lineTo(point.x, point.y);
		ctx.strokeStyle = inkRatio < 0.2 ? '#111827' : this.skin.drawingFill;
		ctx.lineWidth = 8;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();
	}
}

function getBodySize(body: Matter.Body): { width: number; height: number } {
	if ((body as CircleBody).circleRadius) {
		const size = ((body as CircleBody).circleRadius ?? 0) * 2;
		return { width: size, height: size };
	}

	const vertices = body.vertices;
	if (vertices.length >= 3) {
		return {
			width: Math.hypot(vertices[1].x - vertices[0].x, vertices[1].y - vertices[0].y),
			height: Math.hypot(vertices[2].x - vertices[1].x, vertices[2].y - vertices[1].y)
		};
	}

	return {
		width: body.bounds.max.x - body.bounds.min.x,
		height: body.bounds.max.y - body.bounds.min.y
	};
}

function getBodyLocalBounds(body: Matter.Body): { minX: number; minY: number; maxX: number; maxY: number } {
	const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
	const cosine = Math.cos(-body.angle);
	const sine = Math.sin(-body.angle);
	const points = parts.flatMap((part) =>
		part.vertices.map((vertex) => {
			const dx = vertex.x - body.position.x;
			const dy = vertex.y - body.position.y;
			return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine };
		})
	);
	return {
		minX: Math.min(...points.map((point) => point.x)),
		minY: Math.min(...points.map((point) => point.y)),
		maxX: Math.max(...points.map((point) => point.x)),
		maxY: Math.max(...points.map((point) => point.y))
	};
}

const CONNECTED_TERRAIN_LABELS = new Set(['ground', 'terrain-block', 'no-draw-zone', 'no-draw-ground']);

export function isTerrainTopExposed(body: Matter.Body, terrainBodies: Matter.Body[]): boolean {
	if (!CONNECTED_TERRAIN_LABELS.has(body.label) || Math.abs(body.angle) > 0.001) return true;
	const { width, height } = getBodySize(body);
	const left = body.position.x - width / 2;
	const right = body.position.x + width / 2;
	const top = body.position.y - height / 2;

	return !terrainBodies.some((candidate) => {
		if (candidate.id === body.id || !CONNECTED_TERRAIN_LABELS.has(candidate.label) || Math.abs(candidate.angle) > 0.001) return false;
		const candidateSize = getBodySize(candidate);
		const candidateLeft = candidate.position.x - candidateSize.width / 2;
		const candidateRight = candidate.position.x + candidateSize.width / 2;
		const candidateBottom = candidate.position.y + candidateSize.height / 2;
		const overlap = Math.min(right, candidateRight) - Math.max(left, candidateLeft);
		return overlap >= Math.min(width, candidateSize.width) * 0.7 && Math.abs(candidateBottom - top) <= 2;
	});
}
