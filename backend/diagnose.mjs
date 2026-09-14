import { loadEnv, configuration } from './lib.mjs';

loadEnv(new URL('.env', import.meta.url));
const config = configuration();
console.log(JSON.stringify({ provider: config.provider, keyConfigured: Boolean(config.apiKey), model: config.model || null }));
if (['zhipu', 'deepseek'].includes(config.provider)) {
  console.log('Use node backend/smoke.mjs to verify the selected vision model with the reference image.');
  if (!config.apiKey) process.exitCode = 2;
} else if (!config.apiKey) {
  process.exitCode = 2;
} else {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': config.apiKey }, signal: AbortSignal.timeout(15000)
    });
    const body = await response.json();
    if (!response.ok) {
      const message = String(body.error?.message || 'Model discovery failed.').split(config.apiKey).join('[redacted]').replace(/AIza[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 700);
      console.log(JSON.stringify({ status: response.status, code: body.error?.status, message }));
      process.exitCode = 1;
    } else {
      const models = (body.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
      console.log(JSON.stringify({ configuredModelListed: models.includes(config.model), models }, null, 2));
    }
  } catch {
    console.error('Could not reach Gemini model discovery.');
    process.exitCode = 1;
  }
}
