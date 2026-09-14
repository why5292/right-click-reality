// Explicit diagnostic command; never prints request headers, keys or image data.
import { readFile } from 'node:fs/promises';
import { loadEnv, configuration, analyzeImage } from './lib.mjs';

loadEnv(new URL('.env', import.meta.url));
const config = configuration();
const mode = process.argv[2] || 'original';
if (config.provider !== 'gemini' || !['original', 'text', 'image'].includes(mode)) {
  throw new Error('This diagnostic requires Gemini and mode original, text or image.');
}
const redact = value => String(value).split(config.apiKey || '\0').join('[redacted]')
  .replace(/AIza[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 1200);
const start = performance.now();
const log = data => console.log(JSON.stringify({ mode, elapsedSeconds: +((performance.now() - start) / 1000).toFixed(2), ...data }));
log({ model: config.model, timeoutMS: config.timeoutMS });
const image = await readFile(new URL('../reference-poster.jpg', import.meta.url));
try {
  const result = await analyzeImage({ imageBase64: image.toString('base64'), mimeType: 'image/jpeg' }, config, async (url, options) => {
    if (mode === 'text') options.body = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }] });
    if (mode === 'image') options.body = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }, { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } }] }] });
    let response;
    try { response = await fetch(url, options); }
    catch (error) { log({ networkError: error.name, cause: error.cause?.code }); throw error; }
    log({ httpStatus: response.status, contentType: response.headers.get('content-type'), retryAfter: response.headers.get('retry-after') });
    if (!response.ok) {
      log({ upstreamError: redact(await response.clone().text()) });
    } else if (mode !== 'original') {
      const data = await response.clone().json();
      const generated = Boolean(data.candidates?.[0]?.content?.parts?.some(p => !p.thought && p.text));
      log({ generationSucceeded: generated, finishReason: data.candidates?.[0]?.finishReason });
      if (!generated) throw new Error('Probe returned no generated text.');
      // The text probe intentionally does not return the application's object schema.
      process.exitCode = 0;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"objects":[]}' }] }, finishReason: 'STOP' }] }));
    }
    return response;
  });
  log({ verdict: 'PASS', objectCount: result.objects.length });
} catch (error) {
  log({ verdict: 'FAIL', code: error.code, message: redact(error.message) });
  process.exitCode = 1;
}
