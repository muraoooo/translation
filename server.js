// ローカル開発用サーバー
// - 静的ファイル配信 (index.html)
// - /api/token : Vercel と同じく Deepgram の短命APIキーを発行
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const API_KEY = config.apiKey;
const PORT = config.port;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

async function issueTempKey() {
  const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
    headers: { Authorization: `Token ${API_KEY}` },
  });
  if (!projectsRes.ok) {
    const detail = await projectsRes.text();
    return { error: { status: 502, body: { error: 'projects list failed', status: projectsRes.status, detail } } };
  }
  const { projects } = await projectsRes.json();
  if (!projects || !projects.length) {
    return { error: { status: 500, body: { error: 'no projects' } } };
  }
  const project_id = projects[0].project_id;

  const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${project_id}/keys`, {
    method: 'POST',
    headers: { Authorization: `Token ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comment: 'translation-app browser temp key',
      scopes: ['usage:write'],
      time_to_live_in_seconds: 60,
    }),
  });
  if (!keyRes.ok) {
    const detail = await keyRes.text();
    return { error: { status: 502, body: { error: 'key creation failed', status: keyRes.status, detail } } };
  }
  const data = await keyRes.json();
  return { ok: { key: data.key, expires_in: 60 } };
}

const httpServer = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/token')) {
    try {
      const result = await issueTempKey();
      if (result.error) {
        res.writeHead(result.error.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.error.body));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result.ok));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

httpServer.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
