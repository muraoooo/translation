const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envPath = path.join(__dirname, '.env');
loadEnvFile(envPath);

const config = {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  port: Number(process.env.PORT) || 8765,
};

if (!config.apiKey) {
  throw new Error('DEEPGRAM_API_KEY が未設定です。.env を確認してください。');
}

module.exports = config;
