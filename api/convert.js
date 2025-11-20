// api/convert.js
const bcrypt = require("bcrypt");
const db = require("../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "method" });

  const { address, token, newPassword } = req.body || {};
  if (!address || !token || !newPassword)
    return res.status(400).json({ error: "missing_fields" });

  await db.init();

  const acc = await db.getAddress(address);
  if (!acc) return res.status(404).json({ error: "not_found" });

  const ok = await bcrypt.compare(token, acc.token_hash);
  if (!ok) return res.status(403).json({ error: "invalid_token" });

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.savePassword(acc.id, newHash);

  res.json({ converted: true });
};
