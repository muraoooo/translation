// ローカル開発用サーバー
// - 静的ファイル配信 (index.html)
// - /api/token : Vercel の serverless 関数と同じく Deepgram の短命トークンを発行
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

async function handleToken(res) {
  try {
    const r = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${API_KEY}` },
    });
    const body = await r.text();
    res.writeHead(r.status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

const httpServer = http.createServer((req, res) => {
  if (req.url.startsWith('/api/token')) {
    handleToken(res);
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
