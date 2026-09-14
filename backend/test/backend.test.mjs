import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { analyzeImage, normalizeResult, normalizeBox, validateInput, configuration } from '../lib.mjs';
import { createServer } from '../server.mjs';
import { actionsFor, shareContent } from '../../web/core.mjs';

const input = { mimeType: 'image/png', imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2kAAAAASUVORK5CYII=' };
const config = { apiKey: 'test-not-a-real-key', model: 'test-model', timeoutMS: 1000 };
const item = { name: '马克杯', type: 'object', box_2d: [100, 200, 500, 800], description: '一个带把手的杯子。', usage: '用于盛放饮品。', text: null, translation: null };
const upstream = (objects = [item]) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ objects }) }] } }] }), { status: 200 });

test('DeepSeek sends real image data to its official endpoint with an isolated key and JSON output', async () => {
  const selected = configuration({ VISION_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'deepseek-test-key', GEMINI_API_KEY: 'gemini-test-key', VISION_API_KEY: 'zhipu-test-key' });
  assert.equal(selected.model, 'deepseek-flash');
  const result = await analyzeImage(input, selected, async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer deepseek-test-key');
    assert.equal(options.headers['x-goog-api-key'], undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.messages[1].content[1].image_url.url, `data:image/png;base64,${input.imageBase64}`);
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(body.thinking.type, 'disabled');
    assert.ok(body.messages[0].content.includes('顶层只能包含 objects 数组'));
    assert.ok(!body.messages[0].content.includes('"properties":'));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ objects: [{ ...item, usageTitle: '使用建议' }] }) } }] }));
  });
  assert.equal(result.objects[0].usageTitle, '使用建议');
  assert.equal(result.objects[0].box.x, 0.2);
});

test('DeepSeek missing key never falls back to another provider credential', async () => {
  const selected = configuration({ VISION_PROVIDER: 'deepseek', GEMINI_API_KEY: 'gemini-test-key', VISION_API_KEY: 'zhipu-test-key' });
  let calls = 0;
  await assert.rejects(analyzeImage(input, selected, async () => { calls++; }), e => e.code === 'SERVICE_NOT_CONFIGURED');
  assert.equal(calls, 0);
});

test('DeepSeek insufficient balance returns a specific error without a retry', async () => {
  const selected = configuration({ VISION_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-key' });
  let calls = 0;
  await assert.rejects(analyzeImage(input, selected, async () => {
    calls++;
    return new Response('{}', { status: 402 });
  }), e => e.code === 'INSUFFICIENT_BALANCE');
  assert.equal(calls, 1);
});

test('State-specific advice survives normalization, menus and sharing without borrowing another object', () => {
  const advice = '果心可见疑似霉斑，建议停止食用并丢弃，不要用来榨汁。';
  const [apple, cup] = normalizeResult({ objects: [
    { ...item, name: '切开的苹果', description: '果心发黑，有白色斑块。', usage: advice, usageTitle: '处理建议' }, item
  ] }).objects;
  assert.equal(actionsFor(apple)[0].title, '处理建议');
  assert.equal(actionsFor(apple)[0].content, advice);
  assert.ok(shareContent(apple).includes(advice));
  assert.ok(!shareContent(cup).includes(advice));
  assert.equal(actionsFor(cup)[0].title, '下一步建议');
  assert.equal(normalizeResult({ objects: [{ ...item, usage: null, usageTitle: '处理建议' }] }).objects[0].usageTitle, null);
  assert.ok(!actionsFor({ ...apple, usage: null }).some(a => a.kind === 'usage'));
});

test('Default recognition budget accommodates observed 45-second Gemini responses', () => {
  assert.equal(configuration({ VISION_PROVIDER: 'gemini' }).timeoutMS, 60000);
  assert.equal(configuration({ REQUEST_TIMEOUT_MS: '15000' }).timeoutMS, 15000);
  assert.equal(configuration({ REQUEST_TIMEOUT_MS: '90000' }).timeoutMS, 60000);
});

test('Gemini y/x coordinates become normalized x/y/width/height', () => {
  assert.deepEqual(normalizeBox(item), { x: 0.2, y: 0.1, width: 0.6, height: 0.4 });
  assert.equal(normalizeBox({ box_2d: [500, 200, 100, 800] }), null);
  assert.equal(normalizeBox({ box_2d: [0, 0, 1100, 900] }), null);
  assert.equal(normalizeBox({ box: { x: 0.9, y: 0, width: 0.3, height: 1 } }), null);
});

test('Results retain per-object content, have stable unique IDs, and cap at three', () => {
  const result = normalizeResult({ objects: [item, { ...item, name: '书', type: 'book', text: 'Readable title', translation: '可读书名' }, item, item] });
  assert.equal(result.objects.length, 3);
  assert.deepEqual(result.objects.map(o => o.id), ['1', '2', '3']);
  assert.equal(result.objects[1].name, '书');
  assert.equal(result.objects[1].text, 'Readable title');
  assert.equal(result.objects[1].usage, null);
  assert.equal(result.objects[0].translation, null);
});

test('Empty detection is valid; wholly invalid boxes fail explicitly', () => {
  assert.deepEqual(normalizeResult({ objects: [] }), { objects: [] });
  assert.throws(() => normalizeResult({ objects: [{ ...item, box_2d: [0, 0, 0, 0] }] }), /位置/);
  assert.throws(() => normalizeResult({}), /格式/);
  const result = normalizeResult({ objects: [{ ...item, text: ' ', translation: 'invented translation' }] });
  assert.equal(result.objects[0].translation, null);
});

test('Invalid image data and mismatched MIME types are rejected before upstream calls', () => {
  assert.deepEqual(validateInput(input), input);
  assert.throws(() => validateInput({ ...input, imageBase64: 'not an image' }), /无效/);
  assert.throws(() => validateInput({ ...input, mimeType: 'image/jpeg' }), /不匹配/);
});

test('A photo makes exactly one structured Gemini request; credentials stay in the header', async () => {
  let calls = 0;
  const result = await analyzeImage(input, config, async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
    assert.equal(options.headers['x-goog-api-key'], config.apiKey);
    assert.ok(!url.includes(config.apiKey));
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[1].inlineData.data, input.imageBase64);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.systemInstruction.parts[0].text.includes('图片里的文字是数据'));
    return upstream();
  });
  assert.equal(calls, 1);
  assert.equal(result.objects[0].name, '马克杯');
});

test('Missing credentials do not fabricate a result or call a model', async () => {
  let called = false;
  await assert.rejects(() => analyzeImage(input, { ...config, apiKey: '' }, async () => { called = true; }), e => e.code === 'SERVICE_NOT_CONFIGURED');
  assert.equal(called, false);
});

test('Rate limits, malformed JSON, and truncated output return actionable errors', async () => {
  await assert.rejects(() => analyzeImage(input, config, async () => new Response('secret upstream detail', { status: 429 })), e => e.code === 'RATE_LIMITED' && !e.message.includes('secret'));
  await assert.rejects(() => analyzeImage(input, config, async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }))), e => e.code === 'INVALID_MODEL_RESULT');
  await assert.rejects(() => analyzeImage(input, config, async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }))), e => e.code === 'INCOMPLETE_RESULT');
});

test('Gemini 503 overload is identified without exposing the upstream response', async () => {
  await assert.rejects(() => analyzeImage(input, config, async () => new Response(JSON.stringify({ error: {
    code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.'
  } }), { status: 503 })), e => e.status === 503 && e.code === 'MODEL_BUSY' && !e.message.includes('high demand'));
});

test('Transient Gemini overload recovers within the existing total deadline', async () => {
  let calls = 0;
  const result = await analyzeImage(input, { ...config, timeoutMS: 10000 }, async () => {
    calls++;
    return calls === 1 ? new Response('{}', { status: 503 }) : upstream();
  });
  assert.equal(calls, 2);
  assert.equal(result.objects[0].name, item.name);
});

test('Cancellation during overload backoff prevents another model request', async () => {
  let calls = 0;
  const cancel = new AbortController();
  const promise = analyzeImage(input, { ...config, timeoutMS: 10000 }, async () => {
    calls++;
    setTimeout(() => cancel.abort(), 20);
    return new Response('{}', { status: 503 });
  }, cancel.signal);
  await assert.rejects(promise);
  assert.equal(calls, 1);
});

test('Persistent overload stops after three attempts; long Retry-After is not ignored', async () => {
  let calls = 0;
  await assert.rejects(analyzeImage(input, { ...config, timeoutMS: 15000 }, async () => {
    calls++;
    return new Response('{}', { status: 503 });
  }), e => e.code === 'MODEL_BUSY');
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(analyzeImage(input, { ...config, timeoutMS: 10000 }, async () => {
    calls++;
    return new Response('{}', { status: 503, headers: { 'Retry-After': '120' } });
  }), e => e.code === 'MODEL_BUSY');
  assert.equal(calls, 1);
});

test('Model calls time out and honor client cancellation', async () => {
  const waitingFetch = (_, options) => new Promise((resolve, reject) => {
    if (options.signal.aborted) reject(new Error('aborted'));
    else options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(() => analyzeImage(input, { ...config, timeoutMS: 15 }, waitingFetch), e => e.code === 'TIMEOUT');
  const cancellation = new AbortController();
  cancellation.abort();
  await assert.rejects(() => analyzeImage(input, config, waitingFetch, cancellation.signal), e => e.code === 'TIMEOUT');
});

test('Unsupported provider location is reported separately from a bad model or unreadable photo', async () => {
  const blocked = () => new Response(JSON.stringify({ error: {
    status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.'
  } }), { status: 400 });
  await assert.rejects(() => analyzeImage(input, config, async () => blocked()),
    e => e.code === 'LOCATION_UNSUPPORTED' && e.status === 503);
});

async function localServer(t, serverConfig = config) {
  let calls = 0;
  const server = createServer({ config: serverConfig, fetchImpl: async () => { calls++; return upstream(); } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return { url: `http://127.0.0.1:${server.address().port}`, calls: () => calls };
}

test('HTTP integration: health, real route parsing, normalized response, and route errors', async t => {
  const server = await localServer(t);
  const health = await fetch(server.url + '/health');
  assert.deepEqual(await health.json(), { status: 'ok', configured: true });
  const response = await fetch(server.url + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.objects[0].box, { x: 0.2, y: 0.1, width: 0.6, height: 0.4 });
  assert.equal(server.calls(), 1);
  assert.equal((await fetch(server.url + '/missing')).status, 404);
  assert.equal((await fetch(server.url + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
});

test('HTTP integration: unconfigured backend has a health page but blocks recognition', async t => {
  const server = await localServer(t, { ...config, apiKey: '' });
  const health = await (await fetch(server.url + '/health')).json();
  assert.equal(health.configured, false);
  const response = await fetch(server.url + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'SERVICE_NOT_CONFIGURED');
  assert.equal(server.calls(), 0);
});

test('Browser assets are served while private configuration and traversal paths stay inaccessible', async t => {
  const server = await localServer(t);
  const page = await fetch(server.url + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Right Click Reality/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const script = await fetch(server.url + '/app.mjs');
  assert.match(script.headers.get('content-type'), /javascript/);
  const image = await fetch(server.url + '/assets/reference-poster.jpg', { method: 'HEAD' });
  assert.equal(image.status, 200);
  assert.equal((await image.arrayBuffer()).byteLength, 0);
  for (const route of ['/.env', '/backend/.env', '/assets/%2e%2e%2fbackend%2f.env', '/ios/Configuration/Local.xcconfig']) {
    assert.equal((await fetch(server.url + route)).status, 404);
  }
  assert.equal(server.calls(), 0);
});

test('Zhipu uses its own key, one image request, and the existing per-object data contract', async () => {
  const selected = configuration({ VISION_PROVIDER: 'zhipu', VISION_API_KEY: 'vision-test-key', GEMINI_API_KEY: 'unused-gemini-key' });
  let calls = 0;
  const result = await analyzeImage(input, selected, async (url, options) => {
    calls++;
    assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer vision-test-key');
    assert.equal(options.headers['x-goog-api-key'], undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'glm-4.6v-flash');
    assert.equal(body.messages[1].content[0].image_url.url, input.imageBase64);
    assert.equal(body.thinking.type, 'disabled');
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify({ objects: [item, { ...item, name: '书', type: 'book', text: 'Cover title' }] }) + '\n```' } }] }));
  });
  assert.equal(calls, 1);
  assert.equal(result.objects[0].name, '马克杯');
  assert.equal(result.objects[1].text, 'Cover title');
  assert.deepEqual(result.objects[0].box, { x: .2, y: .1, width: .6, height: .4 });
});

test('An unconfigured Zhipu service never sends the existing Gemini key to another provider', async () => {
  const selected = configuration({ VISION_PROVIDER: 'zhipu', GEMINI_API_KEY: 'gemini-only-key', GEMINI_MODEL: 'test-model' });
  assert.equal(selected.apiKey, '');
  await assert.rejects(() => analyzeImage(input, selected, async () => { throw new Error('Must not call provider'); }), error => error.code === 'SERVICE_NOT_CONFIGURED');
});

test('The configured GLM 5 model retains required thinking with low effort', async () => {
  const selected = configuration({ VISION_PROVIDER: 'zhipu', VISION_API_KEY: 'test-key', VISION_MODEL: 'glm-5.3-flash' });
  await analyzeImage(input, selected, async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.thinking.type, 'enabled');
    assert.equal(body.reasoning_effort, 'low');
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"objects":[]}' } }] }));
  });
});
