// api/create.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } };

function randString(len) {
  let s = '';
  while (s.length < len) {
    s += crypto.randomBytes(Math.ceil((len - s.length) * 3 / 4))
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '');
  }
  return s.slice(0, len).toLowerCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
  const retentionDays = parseInt(req.body.retentionDays || process.env.RETENTION_DAYS || '365', 10);
  const domain = process.env.EMAIL_DOMAIN || 'topfreemail.org.ng';

  const localPart = randString(8);
  const address = `${localPart}@${domain}`;
  const token = randString(48);
  let tokenHash;
  try {
    tokenHash = await bcrypt.hash(token, 10);
  } catch (err) {
    console.error('bcrypt.hash error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'server' });
  }

  const now = Date.now();
  const expires_at = now + retentionDays * 24 * 60 * 60 * 1000;

  try {
    // Ensure DB is reachable
    await db.init();
  } catch (err) {
    console.error('db.init failed in create:', err && err.message ? err.message : err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const row = await db.createAddress(address, tokenHash, now, expires_at);
    return res.status(200).json({ id: row.id, address: row.address, token, expires_at });
  } catch (err) {
    console.error('db.createAddress error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'create_failed' });
  }
};
