import {
	BASE_WORLD,
	type BeeAttackStyle,
	type DifficultyProfileId,
	type ObstacleType,
	type StageData,
	type StageDesignType,
	type StageEnvironment
} from '../types.js';

export const STAGE_MAP_SCHEMA_VERSION = 1;
const SHARE_PREFIX = `stdog-map-v${STAGE_MAP_SCHEMA_VERSION}.`;
const QR_SHARE_PREFIX = `stdog-qr-v${STAGE_MAP_SCHEMA_VERSION}.`;
const MAX_CUSTOM_MAP_OBJECTS = 40;

const STAGE_DESIGN_TYPES = new Set<StageDesignType>([
	'basic-cover',
	'fall-catch',
	'bridge-gap',
	'anchor-wall',
	'trap-basin',
	'split-hive',
	'terrain-pocket',
	'hive-box',
	'slope-slide',
	'pressure-cage',
	'final-composite'
]);
const STAGE_ENVIRONMENTS = new Set<StageEnvironment>(['meadow', 'volcanic', 'forest']);
const DIFFICULTY_PROFILES = new Set<DifficultyProfileId>([
	'tutorial',
	'shelter',
	'hazard',
	'swarm',
	'physics',
	'expert',
	'master'
]);
const OBSTACLE_TYPES = new Set<ObstacleType>([
	'ground',
	'platform',
	'spike',
	'wall',
	'water',
	'lava',
	'brick',
	'wood',
	'bomb',
	'boulder',
	'crate',
	'acid',
	'ice',
	'stone',
	'rolling-boulder'
]);

export type StageMapObjectKind = 'dog' | 'hive' | ObstacleType;

export interface StageMapObject {
	id: string;
	kind: StageMapObjectKind;
	x: number;
	y: number;
	width?: number;
	height?: number;
	angle?: number;
	beeCount?: number;
	spawnIntervalMs?: number;
	beeForce?: number;
	attackStyle?: BeeAttackStyle;
}

export interface StageMapDocument {
	version: typeof STAGE_MAP_SCHEMA_VERSION;
	stageId: number;
	title: string;
	designType: StageDesignType;
	environment: StageEnvironment;
	world: typeof BASE_WORLD;
	difficulty: {
		inkLimit: number;
		survivalMs: number;
		profile: DifficultyProfileId;
	};
	hint: {
		objectiveLabel: string;
		objectiveHint: string;
		dangerLabel: string;
	};
	designerNote: string;
	objects: StageMapObject[];
}

export function cloneStageMapDocument(document: StageMapDocument): StageMapDocument {
	return {
		...document,
		world: BASE_WORLD,
		difficulty: { ...document.difficulty },
		hint: { ...document.hint },
		objects: document.objects.map((object) => ({ ...object }))
	};
}

export const DESIGN_TYPE_LABELS: Record<StageDesignType, string> = {
	'basic-cover': '기본 보호막',
	'fall-catch': '낙하 받침',
	'bridge-gap': '틈 가로막기',
	'anchor-wall': '벽/발판 앵커',
	'trap-basin': '하단 함정',
	'split-hive': '복수 벌집 분리',
	'terrain-pocket': '지형 포켓',
	'hive-box': '벌집 격리',
	'slope-slide': '경사 미끄럼',
	'pressure-cage': '압박 지지대',
	'final-composite': '복합 최종형'
};

export function createEmptyStageMapDocument(): StageMapDocument {
	return {
		version: STAGE_MAP_SCHEMA_VERSION,
		stageId: 1_000_000 + Math.floor(Math.random() * 900_000_000),
		title: '새 사용자 맵',
		designType: 'basic-cover',
		environment: 'meadow',
		world: BASE_WORLD,
		difficulty: {
			inkLimit: 560,
			survivalMs: 10000,
			profile: 'shelter'
		},
		hint: {
			objectiveLabel: '강아지 보호',
			objectiveHint: '강아지 위를 덮되 지형을 지지점으로 활용하세요.',
			dangerLabel: '벌 공격'
		},
		designerNote: '',
		objects: [
			{ id: 'dog-1', kind: 'dog', x: 195, y: 540 },
			{
				id: 'hive-1',
				kind: 'hive',
				x: 195,
				y: 105,
				beeCount: 10,
				spawnIntervalMs: 280,
				beeForce: 0.002,
				attackStyle: 'direct'
			},
			{ id: 'ground-1', kind: 'ground', x: 195, y: 660, width: 390, height: 20 }
		]
	};
}

export function createStageMapDocument(stage: StageData): StageMapDocument {
	const designType = stage.designType ?? 'basic-cover';
	const objects: StageMapObject[] = [
		{
			id: `stage-${stage.id}-dog`,
			kind: 'dog',
			x: stage.dog.x,
			y: stage.dog.y
		},
		...stage.hives.map((hive, index) => ({
			id: `stage-${stage.id}-hive-${index + 1}`,
			kind: 'hive' as const,
			x: hive.x,
			y: hive.y,
			beeCount: hive.beeCount,
			spawnIntervalMs: hive.spawnIntervalMs,
			beeForce: hive.beeForce,
			attackStyle: hive.attackStyle
		})),
		...stage.obstacles.map((obstacle, index) => ({
			id: `stage-${stage.id}-obstacle-${index + 1}`,
			kind: obstacle.type,
			x: obstacle.x,
			y: obstacle.y,
			width: obstacle.width,
			height: obstacle.height,
			angle: obstacle.angle
		}))
	];

	return {
		version: STAGE_MAP_SCHEMA_VERSION,
		stageId: stage.id,
		title: `${stage.id}단계 - ${DESIGN_TYPE_LABELS[designType]}`,
		designType,
		environment: stage.environment ?? 'meadow',
		world: BASE_WORLD,
		difficulty: {
			inkLimit: stage.inkLimit,
			survivalMs: stage.survivalMs,
			profile: stage.difficulty?.profile ?? 'tutorial'
		},
		hint: {
			objectiveLabel: stage.objectiveLabel ?? '강아지 보호',
			objectiveHint: stage.objectiveHint ?? '벌과 위험 지형을 동시에 막으세요.',
			dangerLabel: stage.dangerLabel ?? '벌 공격'
		},
		designerNote: stage.designerNote ?? '',
		objects
	};
}

export function encodeStageMapShare(document: StageMapDocument): string {
	assertValidStageMapDocument(document);
	return `${SHARE_PREFIX}${encodeURIComponent(JSON.stringify(document))}`;
}

export function decodeStageMapShare(shareCode: string): StageMapDocument {
	if (!shareCode.startsWith(SHARE_PREFIX)) {
		throw new Error('지원하지 않는 맵 공유 코드입니다.');
	}

	const raw = decodeURIComponent(shareCode.slice(SHARE_PREFIX.length));
	const parsed = JSON.parse(raw) as StageMapDocument;
	assertValidStageMapDocument(parsed);
	return parsed;
}

export function encodeStageMapQrShare(document: StageMapDocument): string {
	assertValidStageMapDocument(document);
	const compact = [
		document.version,
		document.stageId,
		document.title,
		document.designType,
		document.environment,
		document.difficulty.inkLimit,
		document.difficulty.survivalMs,
		document.difficulty.profile,
		document.hint.objectiveLabel,
		document.hint.objectiveHint,
		document.hint.dangerLabel,
		document.designerNote,
		document.objects.map((object) => [
			object.id,
			object.kind,
			object.x,
			object.y,
			object.width,
			object.height,
			object.angle,
			object.beeCount,
			object.spawnIntervalMs,
			object.beeForce,
			object.attackStyle
		])
	];

	return `${QR_SHARE_PREFIX}${encodeBase64Url(JSON.stringify(compact))}`;
}

export function decodeSharedStageMap(value: string): StageMapDocument {
	const shareCode = extractShareCode(value);
	if (shareCode.startsWith(SHARE_PREFIX)) return decodeStageMapShare(shareCode);
	if (!shareCode.startsWith(QR_SHARE_PREFIX)) throw new Error('지원하지 않는 맵 공유 코드입니다.');

	const compact = JSON.parse(decodeBase64Url(shareCode.slice(QR_SHARE_PREFIX.length))) as unknown[];
	if (!Array.isArray(compact) || compact.length !== 13 || !Array.isArray(compact[12])) {
		throw new Error('QR 맵 데이터 형식이 올바르지 않습니다.');
	}

	const document: StageMapDocument = {
		version: compact[0] as typeof STAGE_MAP_SCHEMA_VERSION,
		stageId: compact[1] as number,
		title: compact[2] as string,
		designType: compact[3] as StageDesignType,
		environment: compact[4] as StageEnvironment,
		world: BASE_WORLD,
		difficulty: {
			inkLimit: compact[5] as number,
			survivalMs: compact[6] as number,
			profile: compact[7] as DifficultyProfileId
		},
		hint: {
			objectiveLabel: compact[8] as string,
			objectiveHint: compact[9] as string,
			dangerLabel: compact[10] as string
		},
		designerNote: compact[11] as string,
		objects: (compact[12] as unknown[]).map((entry) => {
			if (!Array.isArray(entry)) throw new Error('QR 오브젝트 데이터 형식이 올바르지 않습니다.');
			const kind = entry[1] as StageMapObjectKind;
			const object: StageMapObject = {
				id: entry[0] as string,
				kind,
				x: entry[2] as number,
				y: entry[3] as number
			};
			if (kind === 'hive') {
				object.beeCount = entry[7] as number | undefined;
				object.spawnIntervalMs = entry[8] as number | undefined;
				object.beeForce = entry[9] as number | undefined;
				object.attackStyle = entry[10] as BeeAttackStyle | undefined;
			}
			if (OBSTACLE_TYPES.has(kind as ObstacleType)) {
				object.width = entry[4] as number | undefined;
				object.height = entry[5] as number | undefined;
				object.angle = entry[6] ?? undefined;
			}
			return object;
		})
	};
	assertValidStageMapDocument(document);
	return document;
}

export function createStageDataFromMapDocument(document: StageMapDocument): StageData {
	assertValidStageMapDocument(document);
	const dog = document.objects.find((object) => object.kind === 'dog');
	if (!dog) throw new Error('강아지 위치가 필요합니다.');

	return {
		id: document.stageId,
		dog: { x: dog.x, y: dog.y },
		hives: document.objects
			.filter((object) => object.kind === 'hive')
			.map((object) => ({
				x: object.x,
				y: object.y,
				beeCount: object.beeCount ?? 10,
				spawnIntervalMs: object.spawnIntervalMs ?? 280,
				beeForce: object.beeForce,
				attackStyle: object.attackStyle
			})),
		obstacles: document.objects
			.filter((object): object is StageMapObject & { kind: ObstacleType } => OBSTACLE_TYPES.has(object.kind as ObstacleType))
			.map((object) => ({
				type: object.kind,
				x: object.x,
				y: object.y,
				width: object.width ?? 48,
				height: object.height ?? 32,
				angle: object.angle
			})),
		inkLimit: document.difficulty.inkLimit,
		survivalMs: document.difficulty.survivalMs,
		environment: document.environment,
		designType: document.designType,
		objectiveLabel: document.hint.objectiveLabel,
		objectiveHint: document.hint.objectiveHint,
		dangerLabel: document.hint.dangerLabel,
		designerNote: document.designerNote,
		difficulty: { profile: document.difficulty.profile }
	};
}

export function validateStageMapDocument(document: StageMapDocument): string[] {
	const errors: string[] = [];
	if (document.version !== STAGE_MAP_SCHEMA_VERSION) errors.push('맵 공유 코드 버전이 맞지 않습니다.');
	if (!Number.isInteger(document.stageId) || document.stageId < 1) errors.push('맵 ID는 1 이상의 정수여야 합니다.');
	if (!document.title.trim()) errors.push('맵 이름을 입력하세요.');
	if (!STAGE_DESIGN_TYPES.has(document.designType)) errors.push('지원하지 않는 퍼즐 유형입니다.');
	if (!STAGE_ENVIRONMENTS.has(document.environment)) errors.push('지원하지 않는 배경입니다.');
	if (!DIFFICULTY_PROFILES.has(document.difficulty.profile)) errors.push('지원하지 않는 벌 난이도입니다.');
	if (!Number.isFinite(document.difficulty.inkLimit) || document.difficulty.inkLimit < 120 || document.difficulty.inkLimit > 1200) {
		errors.push('잉크는 120~1200 범위에서 지정하세요.');
	}
	if (!Number.isFinite(document.difficulty.survivalMs) || document.difficulty.survivalMs < 3000 || document.difficulty.survivalMs > 30000) {
		errors.push('생존 시간은 3~30초 범위에서 지정하세요.');
	}
	if (document.objects.length > MAX_CUSTOM_MAP_OBJECTS) errors.push(`오브젝트는 최대 ${MAX_CUSTOM_MAP_OBJECTS}개까지 배치할 수 있습니다.`);
	if (document.objects.filter((object) => object.kind === 'dog').length !== 1) errors.push('강아지는 정확히 1마리 배치하세요.');
	if (document.objects.filter((object) => object.kind === 'hive').length < 1) errors.push('벌집을 하나 이상 배치하세요.');

	const objectIds = new Set<string>();
	for (const object of document.objects) {
		if (!object.id || objectIds.has(object.id)) errors.push('오브젝트 ID가 중복되었습니다.');
		objectIds.add(object.id);
		if (!isFinitePosition(object.x, object.y)) errors.push(`${object.kind} 위치가 지도 범위를 벗어났습니다.`);
		if (object.kind === 'hive') {
			if (!positiveInteger(object.beeCount, 1, 30)) errors.push('벌 수는 1~30 범위에서 지정하세요.');
			if (!positiveInteger(object.spawnIntervalMs, 120, 2000)) errors.push('벌 생성 간격은 120~2000ms 범위에서 지정하세요.');
		}
		if (OBSTACLE_TYPES.has(object.kind as ObstacleType)) {
			if (!positiveNumber(object.width, 8, BASE_WORLD.width) || !positiveNumber(object.height, 8, BASE_WORLD.height)) {
				errors.push(`${object.kind} 크기를 확인하세요.`);
			}
		}
	}
	return [...new Set(errors)];
}

function assertValidStageMapDocument(document: StageMapDocument): void {
	const errors = validateStageMapDocument(document);
	if (errors.length > 0) throw new Error(errors[0]);
}

function extractShareCode(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith(SHARE_PREFIX) || trimmed.startsWith(QR_SHARE_PREFIX)) return trimmed;
	try {
		return new URL(trimmed).searchParams.get('custom-map') ?? trimmed;
	} catch {
		return trimmed;
	}
}

function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value: string): string {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function isFinitePosition(x: number, y: number): boolean {
	return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= BASE_WORLD.width && y >= 0 && y <= BASE_WORLD.height;
}

function positiveInteger(value: number | undefined, min: number, max: number): boolean {
	return Number.isInteger(value) && (value ?? 0) >= min && (value ?? 0) <= max;
}

function positiveNumber(value: number | undefined, min: number, max: number): boolean {
	return Number.isFinite(value) && (value ?? 0) >= min && (value ?? 0) <= max;
}
