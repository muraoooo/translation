const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const config = require('./config');

const API_KEY = config.apiKey;
const PORT = config.port;

// HTTPサーバー（静的ファイル配信）
const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
  };
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

// WebSocketプロキシサーバー
const wss = new WebSocket.Server({ server: httpServer, path: '/listen' });

wss.on('connection', (browserWs, req) => {
  // URLパラメータをそのまま転送（token以外）
  const url = new URL(req.url, 'http://localhost');
  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (k !== 'token') params.set(k, v);
  }

  const dgUrl = `wss://api.deepgram.com/v1/listen?${params}`;
  console.log('[Proxy] Connecting to Deepgram:', dgUrl);

  const dgWs = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${API_KEY}` },
  });

  dgWs.on('open', () => {
    console.log('[Proxy] Deepgram connected');
  });

  // Deepgram → ブラウザ
  dgWs.on('message', (data) => {
    const str = data.toString();
    try {
      const json = JSON.parse(str);
      // 結果タイプとtranscriptだけ表示
      const t = json.channel?.alternatives?.[0]?.transcript;
      if (t) console.log(`[DG] type=${json.type} final=${json.is_final} lang=${json.channel?.detected_language} text="${t}"`);
      else console.log('[DG] msg:', json.type, json.message || '');
    } catch(e) {
      console.log('[DG raw]', str.substring(0, 100));
    }
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(data);
    }
  });

  // ブラウザ → Deepgram
  browserWs.on('message', (data) => {
    if (dgWs.readyState === WebSocket.OPEN) {
      dgWs.send(data);
    }
  });

  dgWs.on('close', (code, reason) => {
    console.log('[Proxy] Deepgram closed:', code);
    browserWs.close();
  });

  dgWs.on('error', (err) => {
    console.error('[Proxy] Deepgram error:', err.message);
    browserWs.close();
  });

  browserWs.on('close', () => {
    console.log('[Proxy] Browser disconnected');
    dgWs.close();
  });
});

httpServer.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
