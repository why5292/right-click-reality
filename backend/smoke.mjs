import { readFile } from 'node:fs/promises';
import { loadEnv, configuration, analyzeImage } from './lib.mjs';

loadEnv(new URL('.env', import.meta.url));
const config = configuration();
if (!config.apiKey || !config.model) {
  console.error('Configure the selected vision service key and model in backend/.env first.');
  process.exitCode = 2;
} else {
  const imagePath = process.argv[2] || new URL('../reference-poster.jpg', import.meta.url);
  const image = await readFile(imagePath);
  try {
    const start = performance.now();
    const result = await analyzeImage({ imageBase64: image.toString('base64'), mimeType: 'image/jpeg' }, config);
    console.error(`Real recognition: provider=${config.provider}, model=${config.model}, elapsed=${((performance.now() - start) / 1000).toFixed(2)}s`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
}
