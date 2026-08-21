import type { RequestHandler } from '@sveltejs/kit';
import { ensurePostgresSchema, getPostgresPool, tableName } from '$lib/server/postgres.js';
import { jsonResponse, rethrowApiError } from '$lib/server/api.js';
import { enforceRateLimit } from '$lib/server/request.js';

interface PlayerRankingRow {
	nickname: string;
	highest_stage: number;
	total_stars: string | number;
	total_unique_clears: number;
	updated_at: Date;
}

export const GET: RequestHandler = async (event) => {
	try {
		await ensurePostgresSchema();
		await enforceRateLimit(event, 'get-player-leaderboard', undefined, 60, 60 * 1000);
		const result = await getPostgresPool().query<PlayerRankingRow>(
			`SELECT u.nickname, p.highest_stage, p.total_stars, p.total_unique_clears, p.updated_at
			 FROM ${tableName('player_progress')} p
			 JOIN ${tableName('users')} u ON u.id = p.user_id
			 WHERE p.total_unique_clears > 0
			 ORDER BY p.highest_stage DESC, p.total_stars DESC, p.total_unique_clears DESC, p.updated_at ASC
			 LIMIT 20`
		);
		return jsonResponse(
			{
				entries: result.rows.map((row) => ({
					nickname: row.nickname,
					highestStage: row.highest_stage,
					totalStars: Number(row.total_stars),
					totalClears: row.total_unique_clears,
					updatedAt: row.updated_at.toISOString()
				}))
			},
			{ 'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' }
		);
	} catch (cause) {
		return rethrowApiError(cause, 'api/leaderboard GET');
	}
};
