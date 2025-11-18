// api/open.js
// Verifies a credential (token OR password) for an address and returns messages.
// Expects POST { address, credential }
// Returns: 200 { allowed: true, converted: Boolean, messages: [...] }
// Error codes: 400 (missing), 404 (not_found), 401 (unauthorized), 500 (server)

const bcrypt = require('bcrypt');
const db = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address, credential } = req.body || {};
  if (!address || !credential) return res.status(400).json({ error: 'missing' });

  try {
    await db.init();
  } catch (err) {
    console.error('db.init failed in open:', err && err.message ? err.message : err);
    return res.status(504).json({ error: 'database_unavailable' });
  }

  try {
    const pool = db.getPool ? db.getPool() : null;
    if (!pool) {
      console.error('open: no db pool available');
      return res.status(500).json({ error: 'server' });
    }

    // find the address row
    const r = await pool.query(
      'SELECT id, token_hash, reset_key_hash FROM addresses WHERE address = $1 LIMIT 1',
      [address]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });

    let allowed = false;

    // If a reset_key_hash exists (password was set), try it first.
    if (row.reset_key_hash) {
      try {
        allowed = await bcrypt.compare(String(credential), row.reset_key_hash);
      } catch (e) {
        console.error('bcrypt.compare reset_key_hash error:', e && e.message ? e.message : e);
      }
    }

    // If not allowed yet, try token_hash (in case token still valid)
    if (!allowed && row.token_hash) {
      try {
        allowed = await bcrypt.compare(String(credential), row.token_hash);
      } catch (e) {
        console.error('bcrypt.compare token_hash error:', e && e.message ? e.message : e);
      }
    }

    if (!allowed) return res.status(401).json({ error: 'unauthorized' });

    // Fetch messages for this address
    // We assume messages table has address_id referencing addresses.id
    const msgsQ = await pool.query(
      `SELECT id, from_addr, subject, body_text, received_at
       FROM messages
       WHERE address_id = $1
       ORDER BY received_at DESC
       LIMIT 200`,
      [row.id]
    );

    const messages = msgsQ.rows || [];

    return res.status(200).json({
      allowed: true,
      converted: !!row.reset_key_hash,
      messages,
    });
  } catch (err) {
    console.error('open error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'server' });
  }
};
