import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { ensurePostgresSchema, getPostgresPool, tableName } from './postgres.js';

export const IDENTITY_COOKIE = 'save_the_dog_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 3;
const SCRYPT_MAX_MEMORY = 128 * 1024 * 1024;

export interface UserIdentity {
	userId: string;
	nickname: string;
}

export interface ResolvedIdentity {
	user: UserIdentity;
	token: string;
}

export class NicknameConflictError extends Error {
	readonly code = 'NICKNAME_CONFLICT';
}

export class InvalidCredentialsError extends Error {
	readonly code = 'INVALID_CREDENTIALS';
}

const ADJECTIVES = ['용감한', '신비한', '행복한', '느긋한', '재빠른', '똑똑한', '씩씩한', '졸린', '달콤한', '행운의'];
const NOUNS = ['강아지', '구름', '돌멩이', '탐험가', '토끼', '여우', '별빛', '나무늘보', '고양이', '무지개'];

export function normalizeNickname(value: string): string {
	const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, '_');
	const length = [...normalized].length;
	if (length < 2 || length > 20) throw new Error('닉네임은 2~20자로 입력하세요.');
	if (!/^[\p{L}\p{N}_-]+$/u.test(normalized)) {
		throw new Error('닉네임에는 문자, 숫자, _, -만 사용할 수 있습니다.');
	}
	return normalized;
}

export function validatePassword(value: string): string {
	const length = [...value].length;
	if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
		throw new Error(`비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력하세요.`);
	}
	return value;
}

export function getIdentitySecret(): string {
	const configured = env.ANONYMOUS_ID_SECRET?.trim();
	if (configured) return configured;
	if (!dev) throw new Error('ANONYMOUS_ID_SECRET 환경변수가 필요합니다.');
	return 'save-the-dog-development-only-secret';
}

export function getSessionToken(event: RequestEvent): string | null {
	return event.cookies.get(IDENTITY_COOKIE) ?? null;
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function findIdentity(event: RequestEvent): Promise<UserIdentity | null> {
	const token = getSessionToken(event);
	if (!token) return null;
	await ensurePostgresSchema();
	const pool = getPostgresPool();
	const rows = await pool.query<{ id: string; nickname: string }>(
		`SELECT u.id, u.nickname
		 FROM ${tableName('sessions')} s
		 JOIN ${tableName('users')} u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.expires_at > now()
		 LIMIT 1`,
		[hashSessionToken(token)]
	);
	const row = rows.rows[0];
	return row ? { userId: row.id, nickname: row.nickname } : null;
}

export async function createAccount(event: RequestEvent, nicknameInput: string, passwordInput: string): Promise<ResolvedIdentity> {
	getIdentitySecret();
	await ensurePostgresSchema();
	const nickname = normalizeNickname(nicknameInput);
	const password = validatePassword(passwordInput);
	const passwordHash = await hashPassword(password);
	const userId = randomUUID();
	const token = randomBytes(32).toString('base64url');
	const tokenHash = hashSessionToken(token);
	const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000);
	const pool = getPostgresPool();
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`INSERT INTO ${tableName('users')} (id, nickname, nickname_normalized, password_hash)
			 VALUES ($1, $2, $3, $4)`,
			[userId, nickname, nickname.toLocaleLowerCase('ko-KR'), passwordHash]
		);
		await client.query(`INSERT INTO ${tableName('player_progress')} (user_id) VALUES ($1)`, [userId]);
		await client.query(
			`INSERT INTO ${tableName('sessions')} (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
			[tokenHash, userId, expiresAt]
		);
		await client.query('COMMIT');
	} catch (cause) {
		await client.query('ROLLBACK');
		if (isUniqueViolation(cause)) throw new NicknameConflictError('이미 사용 중인 닉네임입니다.');
		throw cause;
	} finally {
		client.release();
	}

	setIdentityCookie(event, token);
	return { user: { userId, nickname }, token };
}

export async function loginAccount(event: RequestEvent, nicknameInput: string, passwordInput: string): Promise<ResolvedIdentity> {
	await ensurePostgresSchema();
	const nickname = normalizeNickname(nicknameInput);
	const password = validatePassword(passwordInput);
	const pool = getPostgresPool();
	const result = await pool.query<{ id: string; nickname: string; password_hash: string }>(
		`SELECT id, nickname, password_hash FROM ${tableName('users')} WHERE nickname_normalized = $1 LIMIT 1`,
		[nickname.toLocaleLowerCase('ko-KR')]
	);
	const record = result.rows[0];
	if (!record || !(await verifyPassword(password, record.password_hash))) {
		throw new InvalidCredentialsError('닉네임 또는 비밀번호가 올바르지 않습니다.');
	}

	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000);
	await pool.query(
		`INSERT INTO ${tableName('sessions')} (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		[hashSessionToken(token), record.id, expiresAt]
	);
	await pool.query(`UPDATE ${tableName('users')} SET last_seen_at = now() WHERE id = $1`, [record.id]);
	setIdentityCookie(event, token);
	return { user: { userId: record.id, nickname: record.nickname }, token };
}

export async function logoutAccount(event: RequestEvent): Promise<void> {
	const token = getSessionToken(event);
	if (token) {
		await ensurePostgresSchema();
		await getPostgresPool().query(`DELETE FROM ${tableName('sessions')} WHERE token_hash = $1`, [hashSessionToken(token)]);
	}
	clearIdentityCookie(event);
}

export function setIdentityCookie(event: RequestEvent, token: string): void {
	event.cookies.set(IDENTITY_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE_SECONDS
	});
}

export function clearIdentityCookie(event: RequestEvent): void {
	event.cookies.delete(IDENTITY_COOKIE, { path: '/' });
}

export function generateNickname(attempt = 0): string {
	const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
	return attempt === 0 ? `${adjective}${noun}` : `${adjective}${noun}${10 + Math.floor(Math.random() * 9990)}`;
}

async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derived = await derivePassword(password, salt);
	return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELIZATION, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
	const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] = encoded.split('$');
	if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
	if (Number(cost) !== SCRYPT_COST || Number(blockSize) !== SCRYPT_BLOCK_SIZE || Number(parallelization) !== SCRYPT_PARALLELIZATION) return false;
	const expected = Buffer.from(hashValue, 'base64url');
	if (expected.length !== SCRYPT_KEY_LENGTH) return false;
	const actual = await derivePassword(password, Buffer.from(saltValue, 'base64url'));
	return timingSafeEqual(actual, expected);
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password,
			salt,
			SCRYPT_KEY_LENGTH,
			{ N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION, maxmem: SCRYPT_MAX_MEMORY },
			(error, derivedKey) => (error ? reject(error) : resolve(derivedKey))
		);
	});
}

function isUniqueViolation(cause: unknown): boolean {
	return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
}
