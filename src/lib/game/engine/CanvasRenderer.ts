import Matter from 'matter-js';
import { PHYSICS } from '../constants.js';
import { getSkinDefinition, type SkinAsset, type SkinDefinition } from '../skins.js';
import type { BodyLabel, GamePhase, Point, SkinId, StageEnvironment } from '../types.js';
import type { DrawingBodyPlugin } from './ObjectFactory.js';

type CircleBody = Matter.Body & { circleRadius?: number };

const BODY_COLORS: Record<string, string> = {
	ground: '#3f8f52',
	platform: '#4f9f62',
	drawing: '#8b5a2b',
	water: '#38bdf8',
	lava: '#f97316',
	brick: '#b96b38',
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

	constructor(skin: SkinId = 'classic', private backgroundEnvironment: StageEnvironment = 'meadow') {
		this.skin = getSkinDefinition(skin);
		this.loadImages();
	}

	draw(
		ctx: CanvasRenderingContext2D,
		world: Matter.World,
		phase: GamePhase,
		drawingPoints: Point[],
		inkRatio: number
	): void {
		const width = ctx.canvas.clientWidth || ctx.canvas.width;
		const height = ctx.canvas.clientHeight || ctx.canvas.height;
		ctx.clearRect(0, 0, width, height);
		this.drawBackground(ctx, phase);

		for (const body of Matter.Composite.allBodies(world)) {
			this.drawBody(ctx, body, phase);
		}

		if (drawingPoints.length > 1) {
			this.drawDrawingPreview(ctx, drawingPoints, inkRatio);
		}
	}

	private drawBackground(ctx: CanvasRenderingContext2D, phase: GamePhase): void {
		const width = ctx.canvas.clientWidth || ctx.canvas.width;
		const height = ctx.canvas.clientHeight || ctx.canvas.height;
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

	private drawBody(ctx: CanvasRenderingContext2D, body: Matter.Body, phase: GamePhase): void {
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
			if (!this.drawBodyImage(ctx, body, 'spike')) {
				this.drawSpike(ctx, body);
			}
			return;
		}
		if (label === 'water') {
			if (!this.drawBodyImage(ctx, body, 'water')) {
				this.drawWater(ctx, body);
			}
			return;
		}
		if (label === 'lava') {
			if (!this.drawBodyImage(ctx, body, 'lava')) {
				this.drawLava(ctx, body);
			}
			return;
		}
		if (label === 'acid') {
			if (this.drawBodyImage(ctx, body, 'acid')) return;
		}
		if (label === 'ice') {
			if (this.drawBodyImage(ctx, body, 'ice')) return;
		}
		if (label === 'stone') {
			if (this.drawBodyImage(ctx, body, 'stone')) return;
		}
		if (label === 'brick') {
			if (!this.drawBodyImage(ctx, body, 'brick')) {
				this.drawBrick(ctx, body);
			}
			return;
		}
		if (label === 'wood') {
			if (!this.drawBodyImage(ctx, body, 'wood')) {
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
		if (label === 'ground' || label === 'platform') {
			if (this.drawBodyImage(ctx, body, label)) return;
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
			asset === 'bomb' ||
			asset === 'boulder' ||
			asset === 'crate' ||
			asset === 'acid' ||
			asset === 'ice' ||
			asset === 'stone' ||
			asset === 'rollingBoulder'
		) {
			// 이미지젠 시트는 흰 배경으로 분리했다. multiply를 사용하면 흰 여백이 게임 배경을 덮지 않는다.
			ctx.globalCompositeOperation = 'multiply';
		}
		ctx.drawImage(image, -width / 2, -height / 2, width, height);
		ctx.restore();
		return true;
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
		this.drawHazardPool(ctx, body, '#38bdf8', '#0369a1', '#e0f2fe');
	}

	private drawLava(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		this.drawHazardPool(ctx, body, '#fb923c', '#9a3412', '#fed7aa');
	}

	private drawBrick(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.fillStyle = '#b96b38';
		ctx.strokeStyle = '#7c2d12';
		ctx.lineWidth = 2;
		ctx.fillRect(-width / 2, -height / 2, width, height);
		ctx.strokeRect(-width / 2, -height / 2, width, height);

		ctx.strokeStyle = 'rgba(124, 45, 18, 0.55)';
		ctx.lineWidth = 1;
		const rowHeight = 16;
		for (let y = -height / 2 + rowHeight; y < height / 2; y += rowHeight) {
			ctx.beginPath();
			ctx.moveTo(-width / 2, y);
			ctx.lineTo(width / 2, y);
			ctx.stroke();
		}
		for (let y = -height / 2; y < height / 2; y += rowHeight) {
			const offset = Math.round((y + height / 2) / rowHeight) % 2 === 0 ? 0 : 18;
			for (let x = -width / 2 + offset; x < width / 2; x += 36) {
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x, Math.min(height / 2, y + rowHeight));
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

	private drawHazardPool(ctx: CanvasRenderingContext2D, body: Matter.Body, fill: string, stroke: string, highlight: string): void {
		const { width, height } = getBodySize(body);
		ctx.save();
		ctx.translate(body.position.x, body.position.y);
		ctx.rotate(body.angle);
		ctx.fillStyle = fill;
		ctx.strokeStyle = stroke;
		ctx.lineWidth = 2;

		ctx.beginPath();
		if (typeof ctx.roundRect === 'function') {
			ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(14, height / 2));
		} else {
			ctx.rect(-width / 2, -height / 2, width, height);
		}
		ctx.fill();
		ctx.stroke();

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
