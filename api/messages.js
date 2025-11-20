// api/messages.js
const bcrypt = require('bcrypt');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Accept either token or credential property to be tolerant
  const address = req.body.address && String(req.body.address).trim();
  const token = req.body.token || req.body.credential || req.body.accessToken;

  if (!address || !token) return res.status(400).json({ error: 'missing address or token' });

  try {
    await db.init();
  } catch (err) {
    console.error('db.init failed in messages:', err && err.message ? err.message : err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const pool = db.getPool();
    const r = await pool.query('SELECT id, token_hash, reset_key_hash, password_hash FROM addresses WHERE address = $1 LIMIT 1', [address]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });

    let ok = false;
    // If user set password or reset_key, try them too.
    if (row.reset_key_hash) {
      try { ok = await bcrypt.compare(String(token), row.reset_key_hash); } catch(e){ console.error('bcrypt compare reset_key error', e); }
    }
    if (!ok && row.password_hash) {
      try { ok = await bcrypt.compare(String(token), row.password_hash); } catch(e){ console.error('bcrypt compare password error', e); }
    }
    if (!ok && row.token_hash) {
      try { ok = await bcrypt.compare(String(token), row.token_hash); } catch(e){ console.error('bcrypt compare token error', e); }
    }

    if (!ok) return res.status(403).json({ error: 'invalid token' });

    // Update last access
    try { await pool.query('UPDATE addresses SET last_access = $1 WHERE id = $2', [Date.now(), row.id]); } catch(e){ console.error('update last_access error', e); }

    const msgs = await pool.query('SELECT id, from_addr, subject, body_text, received_at FROM messages WHERE address_id = $1 ORDER BY received_at DESC LIMIT 200', [row.id]);
    return res.status(200).json({ allowed: true, messages: msgs.rows || [] });
  } catch (err) {
    console.error('messages error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'server' });
  }
};
