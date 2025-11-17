// api/inbound.js
const formidable = require('formidable');
const db = require('../lib/db');

// CloudMailin will POST using multipart/form-data
exports.config = {
  api: {
    bodyParser: false
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields) => {
    if (err) {
      console.error('FORM ERROR:', err);
      return res.status(400).send('invalid');
    }

    // CloudMailin provides these fields
    const toRaw = fields.to || '';
    const from = fields.from || '';
    const subject = fields.subject || '';
    const body = fields.plain || fields.html || '';

    // toRaw can be something like: "rexx1972@topfreemail.org.ng"
    const address = (toRaw || '').trim().toLowerCase();

    await db.init();

    const addr = await db.getAddressByAddress(address);
    if (!addr) {
      console.log('Email sent to non-existent inbox:', address);
      return res.status(200).send('ok');
    }

    const now = Date.now();

    await db.insertMessage(
      addr.id,
      from,
      subject,
      body,
      now
    );

    await db.updateLastActivity(addr.id, now);

    return res.status(200).send('stored');
  });
};
