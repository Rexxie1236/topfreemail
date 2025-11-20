// api/create.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } };

function randomTokenChars(length) {
  const bytes = Math.ceil((length * 6) / 8);
  return crypto.randomBytes(bytes).toString('base64url').slice(0, length);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const retentionDays = parseInt(req.body.retentionDays || process.env.RETENTION_DAYS || '365', 10);
  const domain = process.env.EMAIL_DOMAIN || 'topfreemail.org.ng';
  const TOKEN_LENGTH = 16;

  const tokenPlain = randomTokenChars(TOKEN_LENGTH);

  let tokenHash;
  try {
    tokenHash = await bcrypt.hash(tokenPlain, 10);
  } catch (e) {
    console.error('bcrypt.hash error:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'server' });
  }

  const localPart = (req.body.localPart && String(req.body.localPart).replace(/[^a-z0-9.-]/gi, '').toLowerCase())
                    || crypto.randomBytes(4).toString('hex').slice(0,8);
  const address = `${localPart}@${domain}`;
  const now = Date.now();
  const expires_at = now + retentionDays * 24 * 60 * 60 * 1000;

  try {
    await db.init();
  } catch (err) {
    console.error('db.init failed in create:', err && err.message ? err.message : err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const pool = db.getPool();
    const q = `INSERT INTO addresses (address, token_hash, created_at, expires_at) VALUES ($1,$2,$3,$4) RETURNING id,address`;
    const vals = [address, tokenHash, now, expires_at];
    const r = await pool.query(q, vals);
    return res.status(200).json({ id: r.rows[0].id, address: r.rows[0].address, token: tokenPlain, expires_at });
  } catch (err) {
    console.error('db.createAddress error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'create_failed' });
  }
};
