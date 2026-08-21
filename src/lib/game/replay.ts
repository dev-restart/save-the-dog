import type { CanvasSize, Point, StageData } from './types.js';
import { BASE_WORLD } from './types.js';

export const REPLAY_VERSION = 1 as const;
export const MAX_REPLAY_COMMANDS = 220;

export type ReplayCommand =
	| { type: 'start'; point: Point }
	| { type: 'move'; point: Point }
	| { type: 'end' };

export interface StageReplay {
	version: typeof REPLAY_VERSION;
	stageId: number;
	seed?: string;
	commands: ReplayCommand[];
}

export function createStageReplay(stage: StageData, commands: ReplayCommand[], sourceSize: CanvasSize = BASE_WORLD): StageReplay {
	return {
		version: REPLAY_VERSION,
		stageId: stage.id,
		...(stage.seed ? { seed: stage.seed } : {}),
		commands: commands.map((command) => scaleCommandToBaseWorld(command, sourceSize))
	};
}

export function normalizeReplay(value: unknown): StageReplay {
	if (!isRecord(value)) throw new Error('replay 데이터 형식이 올바르지 않습니다.');
	if (value.version !== REPLAY_VERSION) throw new Error('지원하지 않는 replay 버전입니다.');
	if (!Number.isInteger(value.stageId) || !Number.isFinite(value.stageId)) throw new Error('replay 단계가 올바르지 않습니다.');
	if (value.seed !== undefined && (typeof value.seed !== 'string' || value.seed.length > 80)) throw new Error('replay seed가 올바르지 않습니다.');
	if (!Array.isArray(value.commands) || value.commands.length < 3 || value.commands.length > MAX_REPLAY_COMMANDS) {
		throw new Error('replay 명령 수가 올바르지 않습니다.');
	}

	const commands = value.commands.map(normalizeCommand);
	if (commands[0]?.type !== 'start' || commands.at(-1)?.type !== 'end') {
		throw new Error('replay는 start와 end 명령으로 끝나야 합니다.');
	}
	if (!commands.some((command) => command.type === 'move')) throw new Error('replay 드로잉이 비어 있습니다.');

	return {
		version: REPLAY_VERSION,
		stageId: value.stageId as number,
		...(value.seed === undefined ? {} : { seed: value.seed as string }),
		commands
	};
}

function normalizeCommand(value: unknown): ReplayCommand {
	if (!isRecord(value) || typeof value.type !== 'string') throw new Error('replay 명령 형식이 올바르지 않습니다.');
	if (value.type === 'end') return { type: 'end' };
	if (value.type !== 'start' && value.type !== 'move') throw new Error('replay 명령 종류가 올바르지 않습니다.');
	if (!isRecord(value.point)) throw new Error('replay 좌표가 올바르지 않습니다.');
	const x = value.point.x;
	const y = value.point.y;
	if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
		throw new Error('replay 좌표가 올바르지 않습니다.');
	}
	if (x < 0 || x > BASE_WORLD.width || y < 0 || y > BASE_WORLD.height) throw new Error('replay 좌표가 지도 범위를 벗어났습니다.');
	return { type: value.type, point: { x, y } };
}

function scaleCommandToBaseWorld(command: ReplayCommand, sourceSize: CanvasSize): ReplayCommand {
	if (command.type === 'end') return command;
	if (!Number.isFinite(sourceSize.width) || !Number.isFinite(sourceSize.height) || sourceSize.width <= 0 || sourceSize.height <= 0) {
		throw new Error('replay 원본 화면 크기가 올바르지 않습니다.');
	}
	return {
		type: command.type,
		point: {
			x: (command.point.x / sourceSize.width) * BASE_WORLD.width,
			y: (command.point.y / sourceSize.height) * BASE_WORLD.height
		}
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
