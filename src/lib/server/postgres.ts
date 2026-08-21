import { env } from '$env/dynamic/private';
import pg from 'pg';

const { Pool } = pg;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

interface PostgresGlobalState {
	pool?: InstanceType<typeof Pool>;
	schemaPromise?: Promise<void>;
}

const postgresGlobal = globalThis as typeof globalThis & {
	__saveTheDogPostgres?: PostgresGlobalState;
};

function getState(): PostgresGlobalState {
	return (postgresGlobal.__saveTheDogPostgres ??= {});
}

export function getPostgresSchema(): string {
	const schema = env.SCHEMA?.trim();
	if (!schema || !IDENTIFIER_PATTERN.test(schema)) {
		throw new Error('SCHEMA 환경변수는 유효한 PostgreSQL 식별자여야 합니다.');
	}
	return schema;
}

export function tableName(name: string): string {
	if (!IDENTIFIER_PATTERN.test(name)) throw new Error('허용되지 않은 PostgreSQL 테이블 이름입니다.');
	return `"${getPostgresSchema()}"."${name}"`;
}

export function getPostgresPool(): InstanceType<typeof Pool> {
	const connectionString = env.DATABASE_URL?.trim();
	if (!connectionString) throw new Error('DATABASE_URL 환경변수가 필요합니다.');

	const state = getState();
	if (!state.pool) {
		state.pool = new Pool({
			connectionString,
			max: 2,
			connectionTimeoutMillis: 5_000,
			idleTimeoutMillis: 20_000,
			allowExitOnIdle: true
		});
	}
	return state.pool;
}

export async function ensurePostgresSchema(): Promise<void> {
	const state = getState();
	if (!state.schemaPromise) {
		state.schemaPromise = createSchema().catch((cause) => {
			state.schemaPromise = undefined;
			throw cause;
		});
	}
	return state.schemaPromise;
}

async function createSchema(): Promise<void> {
	const pool = getPostgresPool();
	const schema = getPostgresSchema();
	const users = tableName('users');
	const sessions = tableName('sessions');
	const progress = tableName('player_progress');
	const stageScores = tableName('stage_scores');
	const ownedMaps = tableName('owned_maps');
	const publishedMaps = tableName('published_maps');
	const mapScores = tableName('map_scores');
	const telemetry = tableName('stage_telemetry');
	const rateLimits = tableName('rate_limits');

	await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${users} (
			id uuid PRIMARY KEY,
			nickname varchar(20) NOT NULL,
			nickname_normalized varchar(80) NOT NULL UNIQUE,
			password_hash text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			last_seen_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${sessions} (
			token_hash char(64) PRIMARY KEY,
			user_id uuid NOT NULL REFERENCES ${users}(id) ON DELETE CASCADE,
			created_at timestamptz NOT NULL DEFAULT now(),
			last_seen_at timestamptz NOT NULL DEFAULT now(),
			expires_at timestamptz NOT NULL
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON ${sessions}(user_id)`);
	await pool.query(`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON ${sessions}(expires_at)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${progress} (
			user_id uuid PRIMARY KEY REFERENCES ${users}(id) ON DELETE CASCADE,
			highest_stage integer NOT NULL DEFAULT 1 CHECK (highest_stage BETWEEN 1 AND 500),
			last_played_stage integer NOT NULL DEFAULT 1 CHECK (last_played_stage BETWEEN 1 AND 500),
			total_unique_clears integer NOT NULL DEFAULT 0 CHECK (total_unique_clears BETWEEN 0 AND 500),
			total_stars numeric(7,1) NOT NULL DEFAULT 0,
			stage_stars jsonb NOT NULL DEFAULT '{}'::jsonb,
			version integer NOT NULL DEFAULT 1,
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${stageScores} (
			user_id uuid NOT NULL REFERENCES ${users}(id) ON DELETE CASCADE,
			stage_id integer NOT NULL CHECK (stage_id BETWEEN 1 AND 500),
			seed varchar(80),
			stars numeric(2,1) NOT NULL CHECK (stars BETWEEN 0 AND 3),
			clear_time_ms integer NOT NULL CHECK (clear_time_ms >= 0),
			ink_ratio real NOT NULL CHECK (ink_ratio BETWEEN 0 AND 1),
			replay_hash char(64) NOT NULL,
			verified_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (user_id, stage_id)
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS stage_scores_ranking_idx ON ${stageScores}(stage_id, stars DESC, clear_time_ms ASC, ink_ratio DESC, verified_at ASC)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${ownedMaps} (
			id uuid PRIMARY KEY,
			owner_id uuid NOT NULL REFERENCES ${users}(id) ON DELETE CASCADE,
			title varchar(80) NOT NULL,
			document jsonb NOT NULL,
			content_hash char(64) NOT NULL,
			source_online_map_id uuid,
			published_map_id uuid,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS owned_maps_owner_updated_idx ON ${ownedMaps}(owner_id, updated_at DESC)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${publishedMaps} (
			id uuid PRIMARY KEY,
			owner_id uuid NOT NULL REFERENCES ${users}(id) ON DELETE CASCADE,
			owner_map_id uuid REFERENCES ${ownedMaps}(id) ON DELETE SET NULL,
			owner_nickname varchar(20) NOT NULL,
			title varchar(80) NOT NULL,
			document jsonb NOT NULL,
			content_hash char(64) NOT NULL,
			download_count integer NOT NULL DEFAULT 0,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			UNIQUE (owner_id, content_hash)
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS published_maps_recent_idx ON ${publishedMaps}(created_at DESC, id DESC)`);
	await pool.query(`CREATE INDEX IF NOT EXISTS published_maps_owner_idx ON ${publishedMaps}(owner_id, created_at DESC)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${mapScores} (
			map_id uuid NOT NULL REFERENCES ${publishedMaps}(id) ON DELETE CASCADE,
			user_id uuid NOT NULL REFERENCES ${users}(id) ON DELETE CASCADE,
			nickname varchar(20) NOT NULL,
			stars numeric(2,1) NOT NULL CHECK (stars BETWEEN 0 AND 3),
			clear_time_ms integer NOT NULL CHECK (clear_time_ms >= 0),
			ink_ratio real NOT NULL CHECK (ink_ratio BETWEEN 0 AND 1),
			hint_views integer NOT NULL DEFAULT 0,
			verified_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (map_id, user_id)
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS map_scores_ranking_idx ON ${mapScores}(map_id, stars DESC, clear_time_ms ASC, ink_ratio DESC, updated_at ASC)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${telemetry} (
			day date NOT NULL,
			stage_id integer NOT NULL,
			outcome varchar(16) NOT NULL,
			reason varchar(32) NOT NULL,
			attempts integer NOT NULL DEFAULT 0,
			total_elapsed_ms bigint NOT NULL DEFAULT 0,
			total_ink_ratio double precision NOT NULL DEFAULT 0,
			expires_at timestamptz NOT NULL,
			PRIMARY KEY (day, stage_id, outcome, reason)
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS stage_telemetry_expires_idx ON ${telemetry}(expires_at)`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${rateLimits} (
			id text PRIMARY KEY,
			count integer NOT NULL DEFAULT 0,
			expires_at timestamptz NOT NULL
		)
	`);
	await pool.query(`CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON ${rateLimits}(expires_at)`);
}
