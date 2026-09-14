import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { APIError, analyzeImage, configuration, loadEnv } from './lib.mjs';

// An explicit route table keeps local credentials and project files private.
const assets = new Map([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['../web/app.mjs', 'text/javascript; charset=utf-8']],
  ['/core.mjs', ['../web/core.mjs', 'text/javascript; charset=utf-8']],
  ['/demo-data.mjs', ['../web/demo-data.mjs', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['../web/favicon.svg', 'image/svg+xml']],
  ['/assets/desk.svg', ['../web/assets/desk.svg', 'image/svg+xml']],
  ['/assets/reference-poster.jpg', ['../reference-poster.jpg', 'image/jpeg']]
]);

async function serveAsset(request, response, asset) {
  try {
    const bytes = await readFile(new URL(asset[0], import.meta.url));
    response.writeHead(200, {
      'Content-Type': asset[1], 'Content-Length': bytes.length,
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { send(response, 500, { error: { code: 'PAGE_UNAVAILABLE', message: '页面暂时无法读取。' } }); }
}

async function readJSON(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new APIError(415, 'CONTENT_TYPE', '请求格式应为 JSON。');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 9 * 1024 * 1024) throw new APIError(413, 'IMAGE_TOO_LARGE', '图片过大，请重新选择。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new APIError(400, 'INVALID_JSON', '请求内容无效。'); }
}

function send(response, status, payload) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

export function createServer({ config = configuration(), fetchImpl = fetch } = {}) {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (['GET', 'HEAD'].includes(request.method) && assets.has(pathname)) {
      await serveAsset(request, response, assets.get(pathname));
      return;
    }
    if (request.method === 'GET' && pathname === '/health') {
      send(response, 200, { status: 'ok', configured: Boolean(config.apiKey && config.model) });
      return;
    }
    if (request.method !== 'POST' || pathname !== '/analyze') {
      send(response, 404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } });
      return;
    }
    const cancellation = new AbortController();
    response.on('close', () => { if (!response.writableEnded) cancellation.abort(); });
    try {
      const input = await readJSON(request);
      const result = await analyzeImage(input, config, fetchImpl, cancellation.signal);
      send(response, 200, result);
    } catch (error) {
      const known = error instanceof APIError;
      send(response, known ? error.status : 500, { error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : '服务暂时不可用，请重试。'
      } });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv(new URL('.env', import.meta.url));
  const config = configuration();
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const server = createServer({ config });
  server.requestTimeout = 45000;
  server.headersTimeout = 10000;
  server.listen(config.port, config.host, () => {
    console.log(`Right Click Reality backend is listening on port ${config.port}.`);
    console.log(config.apiKey && config.model ? `Vision service configured: ${config.provider}.` : 'Configure the vision service key in backend/.env before real recognition.');
  });
  server.on('error', error => { console.error(`Server could not start: ${error.code || 'UNKNOWN'}`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
