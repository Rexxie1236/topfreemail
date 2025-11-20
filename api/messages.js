// api/messages.js
const bcrypt = require("bcrypt");
const db = require("../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "method" });

  const { address, credential } = req.body || {};
  if (!address || !credential)
    return res.status(400).json({ error: "missing_fields" });

  await db.init();

  const acc = await db.getAddress(address);
  if (!acc) return res.status(404).json({ error: "not_found" });

  let ok = false;

  // If user converted token → password
  if (acc.password_hash) {
    ok = await bcrypt.compare(credential, acc.password_hash);
  } else {
    ok = await bcrypt.compare(credential, acc.token_hash);
  }

  if (!ok) return res.status(403).json({ error: "invalid_credential" });

  await db.saveLastActivity(acc.id);
  const msgs = await db.listMessages(acc.id);

  res.json({
    ok: true,
    converted: !!acc.password_hash,
    messages: msgs
  });
};
