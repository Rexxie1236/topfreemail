// lib/db.js
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';

if (DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
  // Postgres (production)
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: (process.env.DB_SSL === 'true') ? { rejectUnauthorized:false } : false });

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        address TEXT UNIQUE NOT NULL,
        token_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        last_activity_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        address_id INTEGER REFERENCES addresses(id) ON DELETE CASCADE,
        from_addr TEXT,
        subject TEXT,
        body_text TEXT,
        received_at BIGINT
      );
    `);
  }

  module.exports = {
    type: 'pg',
    pool,
    init,
    async createAddress(address, token_hash, createdAt, expiresAt) {
      const last_activity_at = createdAt;
      const r = await pool.query(
        `INSERT INTO addresses(address, token_hash, created_at, last_activity_at, expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id, address, created_at, last_activity_at, expires_at`,
        [address, token_hash, createdAt, last_activity_at, expiresAt]
      );
      return r.rows[0];
    },
    async getAddressByAddress(address) {
      const r = await pool.query(`SELECT * FROM addresses WHERE address = $1`, [address]);
      return r.rows[0];
    },
    async getAddressById(id) {
      const r = await pool.query(`SELECT * FROM addresses WHERE id = $1`, [id]);
      return r.rows[0];
    },
    async updateLastActivity(id, ts) {
      await pool.query(`UPDATE addresses SET last_activity_at = $1, expires_at = $2 WHERE id = $3`, [ts, ts + (parseInt(process.env.RETENTION_DAYS||365,10)*24*60*60*1000), id]);
    },
    async insertMessage(address_id, from_addr, subject, body_text, received_at) {
      await pool.query(`INSERT INTO messages(address_id, from_addr, subject, body_text, received_at) VALUES($1,$2,$3,$4,$5)`, [address_id, from_addr, subject, body_text, received_at]);
    },
    async listMessages(address_id) {
      const r = await pool.query(`SELECT id, from_addr, subject, received_at FROM messages WHERE address_id = $1 ORDER BY received_at DESC`, [address_id]);
      return r.rows;
    },
    async getMessage(id) {
      const r = await pool.query(`SELECT * FROM messages WHERE id = $1`, [id]);
      return r.rows[0];
    },
    async deleteAddress(id) {
      await pool.query(`DELETE FROM messages WHERE address_id = $1`, [id]);
      await pool.query(`DELETE FROM addresses WHERE id = $1`, [id]);
    },
    async listExpired(threshold) {
      const r = await pool.query(`SELECT id FROM addresses WHERE expires_at < $1`, [threshold]);
      return r.rows.map(r2 => r2.id);
    }
  };

} else {
  // SQLite local fallback (for dev/testing)
  const sqlite3 = require('sqlite3').verbose();
  const DB_FILE = path.join(process.cwd(), 'db.sqlite3');
  const db = new sqlite3.Database(DB_FILE);

  function runAsync(sql, params=[]) {
    return new Promise((res,rej)=>{
      db.run(sql, params, function(err){ if(err) rej(err); else res(this); });
    });
  }
  function allAsync(sql, params=[]) {
    return new Promise((res,rej)=>{ db.all(sql, params, (e,r)=> e?rej(e):res(r)); });
  }
  function getAsync(sql, params=[]) {
    return new Promise((res,rej)=>{ db.get(sql, params, (e,r)=> e?rej(e):res(r)); });
  }

  async function init() {
    await runAsync(`CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT UNIQUE,
      token_hash TEXT,
      created_at INTEGER,
      last_activity_at INTEGER,
      expires_at INTEGER
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address_id INTEGER,
      from_addr TEXT,
      subject TEXT,
      body_text TEXT,
      received_at INTEGER
    )`);
  }

  module.exports = {
    type:'sqlite',
    init,
    async createAddress(address, token_hash, createdAt, expiresAt) {
      const r = await runAsync(`INSERT INTO addresses(address, token_hash, created_at, last_activity_at, expires_at) VALUES(?,?,?,?,?)`, [address, token_hash, createdAt, createdAt, expiresAt]);
      const row = await getAsync(`SELECT id,address,created_at,last_activity_at,expires_at FROM addresses WHERE address = ?`, [address]);
      return row;
    },
    async getAddressByAddress(address) { return await getAsync(`SELECT * FROM addresses WHERE address = ?`, [address]); },
    async getAddressById(id) { return await getAsync(`SELECT * FROM addresses WHERE id = ?`, [id]); },
    async updateLastActivity(id, ts) {
      const expires = ts + (parseInt(process.env.RETENTION_DAYS||365,10)*24*60*60*1000);
      await runAsync(`UPDATE addresses SET last_activity_at = ?, expires_at = ? WHERE id = ?`, [ts, expires, id]);
    },
    async insertMessage(address_id, from_addr, subject, body_text, received_at) {
      await runAsync(`INSERT INTO messages(address_id, from_addr, subject, body_text, received_at) VALUES(?,?,?,?,?)`, [address_id, from_addr, subject, body_text, received_at]);
    },
    async listMessages(address_id) { return await allAsync(`SELECT id, from_addr, subject, received_at FROM messages WHERE address_id = ? ORDER BY received_at DESC`, [address_id]); },
    async getMessage(id) { return await getAsync(`SELECT * FROM messages WHERE id = ?`, [id]); },
    async deleteAddress(id) { 
      await runAsync(`DELETE FROM messages WHERE address_id = ?`, [id]);
      await runAsync(`DELETE FROM addresses WHERE id = ?`, [id]);
    },
    async listExpired(threshold) { 
      const rows = await allAsync(`SELECT id FROM addresses WHERE expires_at < ?`, [threshold]); 
      return rows.map(r=>r.id); 
    }
  };
}
