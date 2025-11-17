// api/create.js
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const retentionDays = parseInt(req.body.retentionDays || process.env.RETENTION_DAYS || '365', 10);
  const domain = process.env.EMAIL_DOMAIN || 'topfreemail.org.ng';
  const local = nanoid(8).toLowerCase();
  const address = `${local}@${domain}`;
  const token = nanoid(36); // shown once to user
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
