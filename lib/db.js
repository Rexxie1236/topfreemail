// lib/db.js
const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL missing");

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function init() {
  const p = getPool();
  await p.query("SELECT 1");
}

async function createAddress(address, tokenHash, expiresAt) {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO addresses(address, token_hash, created_at, expires_at)
     VALUES ($1,$2,EXTRACT(EPOCH FROM NOW())*1000,$3)
     RETURNING id,address`,
    [address, tokenHash, expiresAt]
  );
  return res.rows[0];
}

async function getAddress(address) {
  const p = getPool();
  const res = await p.query(
    `SELECT id,address,token_hash,password_hash
     FROM addresses WHERE address=$1 LIMIT 1`,
    [address]
  );
  return res.rows[0] || null;
}

async function savePassword(id, hash) {
  const p = getPool();
  await p.query(
    `UPDATE addresses SET password_hash=$1 WHERE id=$2`,
    [hash, id]
  );
}

async function saveLastActivity(id) {
  const p = getPool();
  await p.query(
    `UPDATE addresses SET last_access=EXTRACT(EPOCH FROM NOW())*1000 WHERE id=$1`,
    [id]
  );
}

async function listMessages(id) {
  const p = getPool();
  const res = await p.query(
    `SELECT id,from_addr,subject,body_text,received_at
     FROM messages WHERE address_id=$1 ORDER BY received_at DESC`,
    [id]
  );
  return res.rows;
}

module.exports = {
  init,
  getAddress,
  createAddress,
  savePassword,
  saveLastActivity,
  listMessages
};
