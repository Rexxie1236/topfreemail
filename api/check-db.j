// api/check-db.js
// SAFE debugging endpoint: returns only the host from DATABASE_URL (no password, no full URL)
exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  try {
    const url = process.env.DATABASE_URL || '';
    // try to parse host from forms like:
    // postgresql://postgres:PASS@host:5432/postgres
    let host = 'not-set';
    if (url) {
      // remove protocol
      const withoutProto = url.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
      // split at @ to separate credentials (if present)
      const afterAt = withoutProto.includes('@') ? withoutProto.split('@').pop() : withoutProto;
      // host is before the first colon or slash
      host = afterAt.split(/[:\/]/)[0] || afterAt;
    }
    return res.json({ host });
  } catch (err) {
    return res.status(500).json({ error: 'parse-failed' });
  }
};
