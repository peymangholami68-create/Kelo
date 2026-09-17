import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationDir = path.resolve(__dirname, '..', 'database', 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
});

try {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await fs.readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/i, '');
    const exists = await client.query('select 1 from schema_migrations where id = $1', [id]);
    if (exists.rowCount) {
      console.log(`[DB] skip ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
    console.log(`[DB] apply ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations(id) values($1)', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('[DB] migrations complete');
} finally {
  await client.end();
}
