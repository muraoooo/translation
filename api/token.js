// Vercel Serverless Function: Deepgram の短命トークンを発行
// ブラウザはこのトークンで wss://api.deepgram.com/v1/listen に直接接続する
module.exports = async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPGRAM_API_KEY is not set' });
    return;
  }

  try {
    const r = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: 'Deepgram auth/grant failed', detail });
      return;
    }

    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
