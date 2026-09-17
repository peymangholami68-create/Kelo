import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

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
  const { rows } = await client.query(`
    select
      current_database() as database,
      current_user as user,
      version() as version
  `);
  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await client.end();
}
