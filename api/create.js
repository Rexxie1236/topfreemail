// api/create.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const domain = process.env.EMAIL_DOMAIN || "topfreemail.org.ng";

  const local = crypto.randomBytes(4).toString("hex").slice(0, 8);
  const address = `${local}@${domain}`;

  const token = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const tokenHash = await bcrypt.hash(token, 10);

  const expires = Date.now() + 365 * 24 * 60 * 60 * 1000;

  await db.init();
  const row = await db.createAddress(address, tokenHash, expires);

  res.json({
    id: row.id,
    address: row.address,
    token,
    expires_at: expires
  });
};
