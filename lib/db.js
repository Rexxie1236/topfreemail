// lib/db.js
// Robust DB helper for serverless environments (Vercel / Neon / Supabase).
// Uses pg.Pool and supports SSL and sslmode=require in the connection string.

const { Pool } = require('pg');

let pool;
let initialized = false;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || '';
  const dbSslEnv = (process.env.DB_SSL || '').toLowerCase();

  // If the connection string contains sslmode=require or ?sslmode=require,
  // the pg client will negotiate TLS. For some providers we also set
  // rejectUnauthorized:false to avoid self-signed issues.
  const needsSsl =
    dbSslEnv === 'true' ||
    connectionString.toLowerCase().includes('sslmode=require') ||
    connectionString.toLowerCase().includes('ssl=true');

  const config = {
    connectionString: connectionString || undefined,
    // connectionTimeoutMillis: 10000, // optional
  };

  if (needsSsl) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }

  pool = new Pool(config);
  // Optional: log errors to help debugging
  pool.on('error', (err) => {
    console.error('Postgres pool error:', err && err.message ? err.message : err);
  });

  return pool;
}

async function init() {
  if (initialized) return;
  const p = getPool();
  // attempt a quick connection to fail fast in runtime logs if DB is misconfigured
  try {
    const client = await p.connect();
    client.release();
    initialized = true;
  } catch (err) {
    console.error('db.init() connection error:', err && err.message ? err.message : err);
    throw err;
  }
}

async function createAddress(address, tokenHash, createdAt, expiresAt) {
  const p = getPool();
  const q = `
    INSERT INTO addresses (address, token_hash, created_at, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, address;
  `;
  const vals = [address, tokenHash, createdAt, expiresAt];
  const { rows } = await p.query(q, vals);
  return rows[0];
}

async function findAddressByEmail(address) {
  const p = getPool();
  const q = `SELECT * FROM addresses WHERE address = $1 LIMIT 1`;
  const { rows } = await p.query(q, [address]);
  return rows[0];
}

module.exports = {
  getPool,
  init,
  createAddress,
  findAddressByEmail
};
