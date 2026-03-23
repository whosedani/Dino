const crypto = require('crypto');

module.exports = async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const ADMIN_HASH = process.env.ADMIN_HASH;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET — public read
  if (req.method === 'GET') {
    try {
      if (!KV_URL || !KV_TOKEN) {
        return res.status(200).json({});
      }
      const kvRes = await fetch(KV_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + KV_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', 'dino-config'])
      });
      const data = await kvRes.json();
      if (data.result) {
        return res.status(200).json(JSON.parse(data.result));
      }
      return res.status(200).json({});
    } catch (e) {
      return res.status(200).json({});
    }
  }

  // POST — auth required
  if (req.method === 'POST') {
    const authHeader = req.headers['authorization'] || '';

    if (!ADMIN_HASH || authHeader !== ADMIN_HASH) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const kvRes = await fetch(KV_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + KV_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'dino-config', JSON.stringify(body)])
      });

      if (!kvRes.ok) {
        return res.status(500).json({ error: 'Failed to save' });
      }

      return res.status(200).json(body);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
