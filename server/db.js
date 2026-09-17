const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
  application_name: 'kelo-api'
});

pool.on('error', (err) => {
  console.error('[kelo-db] unexpected idle client error:', err);
});

async function query(text, values) {
  return pool.query(text, values);
}

module.exports = { pool, query };
