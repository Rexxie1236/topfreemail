// api/convert.js
const bcrypt = require('bcrypt');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address, token, newResetKey } = req.body || {};
  if (!address || !token || !newResetKey) return res.status(400).json({ error: 'missing address, token or newResetKey' });

  try { await db.init(); } catch (e) { console.error('db.init failed in convert:', e); return res.status(504).json({ error: 'database_unavailable' }); }

  try {
    const pool = db.getPool();
    const r = await pool.query('SELECT id, token_hash FROM addresses WHERE address = $1 LIMIT 1', [address]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });

    const ok = await bcrypt.compare(String(token), row.token_hash);
    if (!ok) return res.status(403).json({ error: 'invalid token' });

    const newHash = await bcrypt.hash(String(newResetKey), 10);
    await pool.query('UPDATE addresses SET reset_key_hash = $1 WHERE id = $2', [newHash, row.id]);

    return res.status(200).json({ converted: true });
  } catch (err) {
    console.error('convert error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'server' });
  }
};
