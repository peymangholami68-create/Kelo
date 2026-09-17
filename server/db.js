import pg from 'pg';

const { Pool } = pg;

let pool;

function buildPool() {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the Kelo backend.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
  });

  pool.on('error', (err) => {
    console.error('[KELO][DB] unexpected idle client error', err);
  });

  return pool;
}

export function getPool() {
  return buildPool();
}

export async function query(text, values = []) {
  return getPool().query(text, values);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
