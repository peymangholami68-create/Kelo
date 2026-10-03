/**
 * KELO DB migrations — Docker-safe (DATABASE_URL from env, dotenv optional).
 * Usage: docker compose exec web node server/migrate.js
 */
try { require('dotenv').config(); } catch (_) { /* optional */ }
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const dir = path.resolve(__dirname, '..', 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    await client.query(
      'create table if not exists kelo_migrations (id text primary key, applied_at timestamptz not null default now())'
    );
    for (const file of files) {
      const already = await client.query('select 1 from kelo_migrations where id = $1', [file]);
      if (already.rowCount) {
        console.log('[migrate] skip', file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into kelo_migrations (id) values ($1)', [file]);
        await client.query('commit');
        console.log('[migrate] applied', file);
      } catch (error) {
        await client.query('rollback');
        // If schema was partially created outside kelo_migrations, mark as applied when objects exist
        const msg = String(error && error.message || error);
        if (/already exists/i.test(msg)) {
          await client.query('insert into kelo_migrations (id) values ($1) on conflict do nothing', [file]);
          console.log('[migrate] skip (already exists)', file);
          continue;
        }
        throw error;
      }
    }
    console.log('[migrate] complete');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
