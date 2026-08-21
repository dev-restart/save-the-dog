import fs from 'node:fs';
import pg from 'pg';

const values = readEnvFile('.env');
const connectionString = values.DATABASE_URL?.trim();
const schema = values.SCHEMA?.trim();

if (!connectionString) throw new Error('DATABASE_URL이 필요합니다.');
if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(schema)) throw new Error('SCHEMA가 올바르지 않습니다.');

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 });
const client = await pool.connect();
try {
	await client.query('BEGIN');
	await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
	await client.query(`CREATE SCHEMA "${schema}"`);
	await client.query('COMMIT');
	console.log('지정된 PostgreSQL schema를 초기화했습니다.');
} catch (cause) {
	await client.query('ROLLBACK');
	throw cause;
} finally {
	client.release();
	await pool.end();
}

function readEnvFile(path) {
	const result = {};
	for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/u)) {
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
		if (!match) continue;
		let value = match[2].trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
		result[match[1]] = value;
	}
	return result;
}
