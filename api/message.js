// api/message.js
const bcrypt = require('bcrypt');
const db = require('../lib/db');

exports.config = { api: { bodyParser: true } }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { address, token, id } = req.body;
  if (!address || !token || !id) {
    return res.status(400).json({ error: 'missing address, token, or id' });
  }

  await db.init();

  const addr = await db.getAddressByAddress(address);
  if (!addr) return res.status(404).json({ error: 'not found' });

  // verify token
  const ok = await bcrypt.compare(token, addr.token_hash);
  if (!ok) return res.status(403).json({ error: 'invalid token' });

  // update activity
  const now = Date.now();
  await db.updateLastActivity(addr.id, now);

  const msg = await db.getMessage(id);
  if (!msg || msg.address_id !== addr.id) {
    return res.status(404).json({ error: 'message not found' });
  }

  return res.json({ message: msg });
};
