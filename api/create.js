// api/create.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } };

// Create a URL-safe random token of N characters (base64url)
function randomTokenChars(length) {
  // Each base64url char carries ~6 bits. Need ceil(length*6/8) bytes.
  const bytes = Math.ceil((length * 6) / 8);
  return crypto.randomBytes(bytes).toString('base64url').slice(0, length);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const retentionDays = parseInt(
    req.body.retentionDays || process.env.RETENTION_DAYS || '365',
    10
  );
  const domain = process.env.EMAIL_DOMAIN || 'topfreemail.org.ng';

  // Optional reset key (memorable backup code)
  const resetKeyPlain = (req.body.resetKey || '').trim() || null;

  // 16-character URL-safe token (≈96 bits entropy)
  const TOKEN_LENGTH = 16;
  const token = randomTokenChars(TOKEN_LENGTH);

  // Hash token & reset key
  let tokenHash;
  let resetKeyHash = null;
  try {
    tokenHash = await bcrypt.hash(token, 10);
    if (resetKeyPlain) {
      resetKeyHash = await bcrypt.hash(resetKeyPlain, 10);
    }
  } catch (err) {
    console.error('bcrypt.hash error:', err?.message || err);
    return res.status(500).json({ error: 'server' });
  }

  const localPart =
    (req.body.localPart &&
      String(req.body.localPart)
        .replace(/[^a-z0-9.-]/gi, '')
        .toLowerCase()) ||
    crypto.randomBytes(4).toString('hex').slice(0, 8);

  const address = `${localPart}@${domain}`;

  const now = Date.now();
  const expires_at = now + retentionDays * 24 * 60 * 60 * 1000;

  try {
    await db.init();
  } catch (err) {
    console.error('db.init failed in create:', err?.message || err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const p = db.getPool ? db.getPool() : null;

    const q = `
      INSERT INTO addresses 
        (address, token_hash, created_at, expires_at, reset_key_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, address;
    `;

    const vals = [address, tokenHash, now, expires_at, resetKeyHash];
    const { rows } = await p.query(q, vals);

    return res.status(200).json({
      id: rows[0].id,
      address: rows[0].address,
      token,
      expires_at,
    });
  } catch (err) {
    console.error('db.createAddress error:', err?.message || err);
    return res.status(500).json({ error: 'create_failed' });
  }
};
