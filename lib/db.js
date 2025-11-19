// lib/db.js
// Minimal DB helper for Vercel serverless functions using node-postgres (pg).
// Exports: init(), getPool(), query(), getAddressByAddress(address)

const { Pool } = require('pg');

let pool = null;
let inited = false;

function getPool() {
  if (!pool) {
    // Use DATABASE_URL from environment
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not set');
    }

    // For Neon or managed Postgres, require SSL
    const ssl = (process.env.DB_SSL === 'true' || /sslmode=require/.test(connectionString)) ? { rejectUnauthorized: false } : false;

    pool = new Pool({
      connectionString,
      ssl,
      // small keep-alive
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

async function init() {
  if (inited && pool) return;
  try {
    getPool(); // will throw if DATABASE_URL missing
    // Test a simple query to ensure connection works
    await pool.query('SELECT 1');
    inited = true;
  } catch (err) {
    // Reset state on failure so subsequent calls can retry
    inited = false;
    pool = pool || null;
    console.error('db.init error:', err && err.message ? err.message : err);
    throw err;
  }
}

/**
 * Generic query helper
 */
async function query(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}

/**
 * Helper used by your handlers: fetch address row by address string.
 * Returns row or null.
 */
async function getAddressByAddress(address) {
  const q = 'SELECT id, address, token_hash, reset_key_hash, created_at, expires_at FROM addresses WHERE address = $1 LIMIT 1';
  const res = await query(q, [address]);
  return res.rows[0] || null;
}

module.exports = {
  init,
  getPool,
  query,
  getAddressByAddress,
};
