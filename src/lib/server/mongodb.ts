import { env } from '$env/dynamic/private';
import { MongoClient, type Db } from 'mongodb';

interface MongoGlobalState {
	client?: MongoClient;
	clientPromise?: Promise<MongoClient>;
	indexesPromise?: Promise<void>;
}

const mongoGlobal = globalThis as typeof globalThis & {
	__saveTheDogMongo?: MongoGlobalState;
};

function getState(): MongoGlobalState {
	return (mongoGlobal.__saveTheDogMongo ??= {});
}

export async function getMongoDatabase(): Promise<Db> {
	const uri = env.MONGODB?.trim();
	const databaseName = env.MONGODB_DB?.trim();
	if (!uri || !databaseName) {
		throw new Error('MONGODB와 MONGODB_DB 환경변수가 필요합니다.');
	}

	const state = getState();
	if (!state.clientPromise) {
		state.client = new MongoClient(uri, {
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000,
			connectTimeoutMS: 5000
		});
		state.clientPromise = state.client.connect().catch((cause) => {
			state.client = undefined;
			state.clientPromise = undefined;
			throw cause;
		});
	}

	const client = await state.clientPromise;
	return client.db(databaseName);
}

export async function ensureMongoIndexes(db: Db): Promise<void> {
	const state = getState();
	if (state.indexesPromise) return state.indexesPromise;
	state.indexesPromise = ensureIndexes(db).catch((cause) => {
		state.indexesPromise = undefined;
		throw cause;
	});
	return state.indexesPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
	const users = db.collection('anonymous_users');
	const maps = db.collection('online_maps');
	const mapScores = db.collection('map_scores');
	const playerRankings = db.collection('player_rankings');
	const challengeScores = db.collection('challenge_scores');
	const stageTelemetry = db.collection('stage_telemetry');
	const rateLimits = db.collection('rate_limits');

	await Promise.all([
		users.createIndex({ nicknameNormalized: 1 }, { unique: true, name: 'unique_nickname' }),
		users.createIndex({ userId: 1 }, { unique: true, name: 'unique_user_id' }),
		maps.createIndex({ ownerId: 1, contentHash: 1 }, { unique: true, name: 'unique_owner_map_content' }),
		maps.createIndex({ createdAt: -1, _id: -1 }, { name: 'recent_maps' }),
		maps.createIndex({ ownerId: 1, createdAt: -1 }, { name: 'owner_maps' }),
		mapScores.createIndex({ mapId: 1, stars: -1, clearTimeMs: 1, updatedAt: 1 }, { name: 'map_leaderboard' }),
		mapScores.createIndex({ mapId: 1, userId: 1 }, { unique: true, name: 'one_score_per_user_map' }),
		playerRankings.createIndex({ highestStage: -1, totalStars: -1, totalClears: -1, updatedAt: 1 }, { name: 'player_leaderboard' }),
		challengeScores.createIndex({ stageId: 1, stars: -1, clearTimeMs: 1, inkRatio: -1, verifiedAt: 1 }, { name: 'challenge_leaderboard' }),
		challengeScores.createIndex({ stageId: 1, userId: 1 }, { unique: true, name: 'one_verified_score_per_user_stage' }),
		stageTelemetry.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'stage_telemetry_ttl' }),
		rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_ttl' })
	]);
}
