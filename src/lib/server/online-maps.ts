import { createHash, randomUUID } from 'node:crypto';
import type { StageMapDocument, StageMapObject } from '$lib/game/stages/stage-map-schema.js';
import { validateStageMapDocument } from '$lib/game/stages/stage-map-schema.js';
import type { Db, WithId } from 'mongodb';
import { env } from '$env/dynamic/private';

export const ONLINE_MAP_LIMIT = readPositiveInteger(env.ONLINE_MAP_LIMIT, 10, 100);

export interface OnlineMapRecord {
	_id: string;
	ownerId: string;
	ownerNickname: string;
	title: string;
	document: StageMapDocument;
	contentHash: string;
	createdAt: Date;
	updatedAt: Date;
	downloadCount: number;
}

export interface OnlineMapSummary {
	mapId: string;
	title: string;
	authorNickname: string;
	contentHash: string;
	createdAt: string;
	updatedAt: string;
	downloadCount: number;
	objectCount: number;
}

export interface CursorValue {
	createdAt: string;
	mapId: string;
}

export function normalizeOnlineMapDocument(input: unknown): StageMapDocument {
	if (!isRecord(input)) throw new Error('지도 데이터 형식이 올바르지 않습니다.');
	const document = input as unknown as StageMapDocument;
	if (
		typeof document.title !== 'string' ||
		typeof document.designerNote !== 'string' ||
		!isRecord(document.difficulty) ||
		!isRecord(document.hint) ||
		typeof document.hint.objectiveLabel !== 'string' ||
		typeof document.hint.objectiveHint !== 'string' ||
		typeof document.hint.dangerLabel !== 'string' ||
		!Array.isArray(document.objects) ||
		document.objects.some((object) => !isRecord(object))
	) {
		throw new Error('지도 데이터 형식이 올바르지 않습니다.');
	}
	const errors = validateStageMapDocument(document);
	if (errors.length > 0) throw new Error(errors[0]);
	if (document.title.length > 80 || document.hint.objectiveLabel.length > 80 || document.hint.objectiveHint.length > 240 || document.hint.dangerLabel.length > 80 || document.designerNote.length > 1000) {
		throw new Error('지도 설명이 허용된 길이를 초과했습니다.');
	}

	return {
		version: document.version,
		stageId: document.stageId,
		title: document.title.trim(),
		designType: document.designType,
		environment: document.environment,
		world: { width: 390, height: 693 },
		difficulty: {
			inkLimit: document.difficulty.inkLimit,
			survivalMs: document.difficulty.survivalMs,
			profile: document.difficulty.profile
		},
		hint: {
			objectiveLabel: document.hint.objectiveLabel.trim(),
			objectiveHint: document.hint.objectiveHint.trim(),
			dangerLabel: document.hint.dangerLabel.trim()
		},
		designerNote: document.designerNote.trim(),
		objects: document.objects.map(normalizeObject)
	};
}

export function hashMapDocument(document: StageMapDocument): string {
	return createHash('sha256').update(JSON.stringify(document)).digest('hex');
}

export function createOnlineMapRecord(ownerId: string, ownerNickname: string, document: StageMapDocument, mapId = randomUUID()): OnlineMapRecord {
	const now = new Date();
	return {
		_id: mapId,
		ownerId,
		ownerNickname,
		title: document.title,
		document,
		contentHash: hashMapDocument(document),
		createdAt: now,
		updatedAt: now,
		downloadCount: 0
	};
}

export function toOnlineMapSummary(record: WithId<OnlineMapRecord>): OnlineMapSummary {
	return {
		mapId: record._id,
		title: record.title,
		authorNickname: record.ownerNickname,
		contentHash: record.contentHash,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		downloadCount: record.downloadCount ?? 0,
		objectCount: record.document.objects.length
	};
}

export function encodeCursor(value: CursorValue): string {
	return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor(value: string | null): CursorValue | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as CursorValue;
		if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.mapId !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function mapCollection(db: Db) {
	return db.collection<OnlineMapRecord>('online_maps');
}

function normalizeObject(object: StageMapObject): StageMapObject {
	const normalized: StageMapObject = {
		id: object.id,
		kind: object.kind,
		x: object.x,
		y: object.y
	};
	if (object.width !== undefined) normalized.width = object.width;
	if (object.height !== undefined) normalized.height = object.height;
	if (object.angle !== undefined) normalized.angle = object.angle;
	if (object.kind === 'hive') {
		if (object.beeCount !== undefined) normalized.beeCount = object.beeCount;
		if (object.spawnIntervalMs !== undefined) normalized.spawnIntervalMs = object.spawnIntervalMs;
		if (object.beeForce !== undefined) normalized.beeForce = object.beeForce;
		if (object.attackStyle !== undefined) normalized.attackStyle = object.attackStyle;
	}
	return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPositiveInteger(value: string | undefined, fallback: number, max: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}
