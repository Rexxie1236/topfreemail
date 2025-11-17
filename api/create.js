// api/create.js
// Replaced nanoid (ESM) with a small crypto-based generator to avoid ERR_REQUIRE_ESM on Vercel.
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } }

// return an alphanumeric lowercase string of length `len`
function randString(len) {
  // create a base64 then strip non-alphanum; repeat if needed
  let s = '';
  while (s.length < len) {
    s += crypto.randomBytes(Math.ceil((len - s.length) * 3 / 4)).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
  return s.slice(0, len).toLowerCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const retentionDays = parseInt(req.body.retentionDays || process.env.RETENTION_DAYS || '365', 10);
  const domain = process.env.EMAIL_DOMAIN || 'topfreemail.org.ng';

  const local = randString(8); // e.g. abc123ef
  const address = `${local}@${domain}`;
  const token = randString(48); // shown once to user
  const token_hash = await bcrypt.hash(token, 10);
  const now = Date.now();
  const expires_at = now + retentionDays * 24 * 60 * 60 * 1000;

  await db.init();
  try {
    const addr = await db.createAddress(address, token_hash, now, expires_at);
    // return address and raw token (display once)
    return res.json({ id: addr.id, address: addr.address, token, expires_at });
  } catch (e) {
    console.error('create err', e);
    return res.status(500).json({ error: 'create failed' });
  }
};
