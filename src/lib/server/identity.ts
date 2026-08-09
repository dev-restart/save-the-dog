import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import type { Collection, Db, WithId } from 'mongodb';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const IDENTITY_COOKIE = 'save_the_dog_identity';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface AnonymousUser {
	_id: string;
	userId: string;
	nickname: string;
	nicknameNormalized: string;
	createdAt: Date;
	lastSeenAt: Date;
}

export interface ResolvedIdentity {
	user: WithId<AnonymousUser>;
	token: string;
}

export class NicknameConflictError extends Error {
	readonly code = 'NICKNAME_CONFLICT';
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

export function getIdentitySecret(): string {
	const configured = env.ANONYMOUS_ID_SECRET?.trim();
	if (configured) return configured;
	if (!dev) {
		throw new Error('ANONYMOUS_ID_SECRET 환경변수가 필요합니다.');
	}
	return 'save-the-dog-development-only-secret';
}

export function getSessionToken(event: RequestEvent): string | null {
	return event.cookies.get(IDENTITY_COOKIE) ?? null;
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function findIdentity(db: Db, event: RequestEvent): Promise<WithId<AnonymousUser> | null> {
	const token = getSessionToken(event);
	if (!token) return null;
	const user = await db.collection<AnonymousUser>('anonymous_users').findOne({ _id: hashSessionToken(token) });
	if (!user) return null;
	await db.collection<AnonymousUser>('anonymous_users').updateOne(
		{ _id: user._id },
		{ $set: { lastSeenAt: new Date() } }
	);
	return user;
}

export async function createIdentity(db: Db, event: RequestEvent, nicknameInput?: string): Promise<ResolvedIdentity> {
	getIdentitySecret();
	const users = db.collection<AnonymousUser>('anonymous_users');
	const explicitNickname = nicknameInput !== undefined;
	const requestedNickname = explicitNickname ? normalizeNickname(nicknameInput ?? '') : undefined;

	for (let attempt = 0; attempt < 12; attempt += 1) {
		const nickname = requestedNickname ?? generateNickname(attempt);
		const token = randomBytes(32).toString('base64url');
		const now = new Date();
		const user: AnonymousUser = {
			_id: hashSessionToken(token),
			userId: randomUUID(),
			nickname,
			nicknameNormalized: nickname.toLocaleLowerCase('ko-KR'),
			createdAt: now,
			lastSeenAt: now
		};

		try {
			await users.insertOne(user);
			setIdentityCookie(event, token);
			return { user: user as WithId<AnonymousUser>, token };
		} catch (cause) {
			if (isDuplicateKeyError(cause) && explicitNickname) {
				throw new NicknameConflictError('이미 사용 중인 닉네임입니다.');
			}
			if (!isDuplicateKeyError(cause)) throw cause;
		}
	}

	throw new Error('닉네임을 생성하지 못했습니다. 잠시 후 다시 시도하세요.');
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

function isDuplicateKeyError(cause: unknown): boolean {
	return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}

export function usersCollection(db: Db): Collection<AnonymousUser> {
	return db.collection<AnonymousUser>('anonymous_users');
}
