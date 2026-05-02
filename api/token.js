// Vercel Serverless Function: Deepgram の短命APIキーを発行
// 1) /v1/projects で project_id を取得
// 2) /v1/projects/{id}/keys で TTL 60秒 のキーを作成して返す
// ブラウザはこのキーを Sec-WebSocket-Protocol: ['token', key] で使う
module.exports = async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPGRAM_API_KEY is not set' });
    return;
  }

  try {
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!projectsRes.ok) {
      const detail = await projectsRes.text();
      res.status(502).json({ error: 'projects list failed', status: projectsRes.status, detail });
      return;
    }
    const { projects } = await projectsRes.json();
    if (!projects || !projects.length) {
      res.status(500).json({ error: 'no projects on this account' });
      return;
    }
    const project_id = projects[0].project_id;

    const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${project_id}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'translation-app browser temp key',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }),
    });
    if (!keyRes.ok) {
      const detail = await keyRes.text();
      res.status(502).json({ error: 'key creation failed', status: keyRes.status, detail });
      return;
    }
    const keyData = await keyRes.json();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ key: keyData.key, expires_in: 60 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
