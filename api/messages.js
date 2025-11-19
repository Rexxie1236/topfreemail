const bcrypt = require('bcrypt');
const db = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { address, credential } = req.body || {};

  if (!address || !credential) {
    return res.status(400).json({ error: 'missing address or credential' });
  }

  try {
    await db.init();
  } catch (err) {
    console.error('messages: db.init failed:', err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const row = await db.getAddressByAddress(address);
    if (!row) return res.status(404).json({ error: 'not_found' });

    let allowed = false;

    // compare with reset password (if exists)
    if (row.reset_key_hash) {
      try {
        allowed = await bcrypt.compare(String(credential), row.reset_key_hash);
      } catch (e) {
        console.error('reset_key_hash compare error:', e);
      }
    }

    // fallback to original token
    if (!allowed && row.token_hash) {
      try {
        allowed = await bcrypt.compare(String(credential), row.token_hash);
      } catch (e) {
        console.error('token_hash compare error:', e);
      }
    }

    if (!allowed) return res.status(401).json({ error: 'unauthorized' });

    const pool = db.getPool();
    const msgs = await pool.query(
      `SELECT id, from_addr, subject, body_text, received_at
       FROM messages
       WHERE address_id = $1
       ORDER BY received_at DESC
       LIMIT 200`,
      [row.id]
    );

    return res.status(200).json({
      ok: true,
      passwordConverted: !!row.reset_key_hash,
      messages: msgs.rows || []
    });

  } catch (err) {
    console.error('messages handler error:', err);
    return res.status(500).json({ error: 'server' });
  }
};

