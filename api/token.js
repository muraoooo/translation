// Vercel Serverless Function: Deepgram の短命APIキーを発行
// 1) /v1/projects で project_id を取得し /v1/projects/{id}/keys で TTL付きキーを作成
// 2) その API キーに新規キー発行権限が無い場合はマスターキーをそのまま返す（フォールバック）
module.exports = async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPGRAM_API_KEY is not set on Vercel' });
    return;
  }

  const log = [];
  try {
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    log.push(`projects: ${projectsRes.status}`);

    if (projectsRes.ok) {
      const { projects } = await projectsRes.json();
      if (projects && projects.length) {
        const project_id = projects[0].project_id;
        const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${project_id}/keys`, {
          method: 'POST',
          headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: 'translation-app browser temp key',
            scopes: ['usage:write'],
            time_to_live_in_seconds: 60,
          }),
        });
        log.push(`key create: ${keyRes.status}`);
        if (keyRes.ok) {
          const data = await keyRes.json();
          res.setHeader('Cache-Control', 'no-store');
          res.status(200).json({ key: data.key, mode: 'temp', expires_in: 60, log });
          return;
        }
      }
    }

    // フォールバック: マスターキーをそのまま返す
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ key: apiKey, mode: 'master', log });
  } catch (err) {
    res.status(500).json({ error: err.message, log });
  }
};
