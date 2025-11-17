// api/access.js
const bcrypt = require('bcrypt');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { address, token } = req.body;
  if (!address || !token) {
    return res.status(400).json({ error: 'missing address or token' });
  }

  await db.init();

  const addr = await db.getAddressByAddress(address);
  if (!addr) return res.status(404).json({ error: 'not found' });

  // check token
  const ok = await bcrypt.compare(token, addr.token_hash);
  if (!ok) return res.status(403).json({ error: 'invalid token' });

  // update last activity
  const now = Date.now();
  await db.updateLastActivity(addr.id, now);

  return res.json({
    id: addr.id,
    address: addr.address,
    created_at: addr.created_at,
    last_activity_at: now,
    expires_at: addr.expires_at
  });
};
