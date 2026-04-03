# 翻訳アプリくん

リアルタイム音声認識＋自動翻訳のWebアプリです。
マイクで話した内容をその場で文字起こし・翻訳し、2画面に並べて表示します。

---

## 構成ファイル

```
翻訳アプリくん/
├── index.html   # フロントエンド（UI・音声処理・翻訳ロジックをすべて含む）
├── server.js    # Node.js サーバー（静的配信 + Deepgram WebSocketプロキシ）
└── node_modules/
    └── ws/      # WebSocketライブラリ
```

---

## アーキテクチャ

```
ブラウザ (index.html)
  │
  │  WebSocket (ws://localhost:8765/listen)
  ▼
server.js (Node.js / ポート8765)
  │  HTTPサーバー → index.html を配信
  │  WebSocketプロキシ → Deepgramに音声を中継
  │
  │  WebSocket (wss://api.deepgram.com/v1/listen)
  ▼
Deepgram API（音声認識）
  │
  │  認識テキストをブラウザへ返す
  ▼
ブラウザ → Google翻訳 API（HTTP fetch）
  └→ 翻訳結果を画面に表示
```

---

## 使用API

### 1. Deepgram（音声認識）

- **エンドポイント:** `wss://api.deepgram.com/v1/listen`
- **方式:** WebSocket ストリーミング
- **送信:** マイク音声を PCM 16bit / 16kHz / モノラル に変換してバイナリ送信
- **受信:** JSON形式で認識結果が随時届く

**主なパラメータ:**

| パラメータ | 値 | 説明 |
|---|---|---|
| `model` | `nova-3` | 最新の高精度モデル |
| `language` | `en` / `ja` | 認識言語 |
| `smart_format` | `true` | 数字・日付の自動整形 |
| `punctuate` | `true` | 句読点の自動付与 |
| `interim_results` | `true` | 確定前の暫定テキストも受信 |
| `encoding` | `linear16` | PCM 16bit エンコーディング |
| `sample_rate` | `16000` | サンプリングレート |

**APIキーの扱い:**
ブラウザに直接APIキーを持たせるのはセキュリティリスクがあるため、`server.js` がプロキシとして間に入り、サーバー側でキーを付与して Deepgram に接続します。

```js
// server.js の該当箇所
const API_KEY = 'xxxxxxxxxxxxxxxx';
const dgWs = new WebSocket(dgUrl, {
  headers: { Authorization: `Token ${API_KEY}` },
});
```

### 2. Google翻訳（非公式エンドポイント）

- **エンドポイント:** `https://translate.googleapis.com/translate_a/single`
- **方式:** HTTP GET（`fetch`）
- **APIキー不要**（`client=gtx` による非公式利用）

```js
const url = `https://translate.googleapis.com/translate_a/single`
          + `?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
const res  = await fetch(url);
const json = await res.json();
const translated = json?.[0]?.map(x => x?.[0]).filter(Boolean).join('');
```

> **注意:** 非公式エンドポイントのため、仕様変更・突然の停止リスクがあります。
> 本番運用する場合は Google Cloud Translation API（v2）の利用を推奨します。

---

## 音声処理の仕組み

ブラウザの Web Audio API を使って、マイク音声をリアルタイムにサーバーへ送ります。

```
getUserMedia()         → マイク音声ストリームを取得
createMediaStreamSource → AudioNodeに接続
createScriptProcessor  → 4096サンプルごとにコールバック
  └→ Float32 → Int16 変換（PCM 16bit）
  └→ WebSocket.send(バイナリ)
```

```js

// Float32Array → Int16Array 変換
const i16 = new Int16Array(f32.length);
for (let i = 0; i < f32.length; i++)
  i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
socket.send(i16.buffer);
```

---

## 表示ロジック

| 状態 | 表示 |
|---|---|
| 暫定テキスト（interim） | 薄い表示（`opacity: 0.4`） |
| 確定テキスト（is_final） | 通常表示 |
| 翻訳完了 | 翻訳パネルに表示、interim クラス除去 |

確定テキストが届いたタイミングで翻訳リクエストを送信します。
前の翻訳リクエストが残っていれば `AbortController` でキャンセルします。

---

## 機能一覧

| ボタン | 機能 |
|---|---|
| 🇺🇸→🇯🇵 / 🇯🇵→🇺🇸 | 翻訳方向の切り替え（録音中は自動停止） |
| 開始 / 停止 | 録音の開始・停止 |
| 🎙️ / 🔇 | ミュート切り替え（音声送信を止める） |
| 🗑️ | 表示履歴のクリア |
| ◫ / ⬓ | レイアウト切替（左右 / 上下） |

---

## レイアウト切替の仕組み

`.panels` 要素に CSS クラスを付け替えるだけで実現しています。

```css
.panels.layout-lr { flex-direction: row; }   /* 左右分割 */
.panels.layout-tb { flex-direction: column; } /* 上下分割 */
```

```js
const LAYOUTS = [
  { cls: 'layout-lr', icon: '◫', label: '左右' },
  { cls: 'layout-tb', icon: '⬓', label: '上下' },
];
```

---

## セットアップ・起動方法

### 必要環境

- Node.js（v18以降推奨）
- Deepgram アカウントとAPIキー（[deepgram.com](https://deepgram.com) で無料取得可）

### インストール

```bash
cd 翻訳アプリくん
npm install ws
```

### APIキーの設定

`server.js` の先頭にある `API_KEY` を自分のキーに書き換えます。

```js
const API_KEY = 'ここにDeepgramのAPIキーを貼る';
```

### 起動

```bash
node server.js
```

起動後、ブラウザで以下を開きます。

```
http://localhost:8765
```

---

## 注意事項

- マイクへのアクセス許可がブラウザから求められます（許可してください）
- `localhost` でのみ動作します（HTTPSなしでマイクが使えるのはlocalhostだけです）
- Deepgram APIキーは `server.js` にハードコードされています。GitHubなどに公開する場合は環境変数（`.env`）に移してください
