// Read project-local credentials only. Do not log provider bodies, keys, or headers.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('../server/node_modules/dotenv');
const root = path.resolve(__dirname, '..');
const config = {
  ...dotenv.parse(fs.readFileSync(path.join(root, 'server/.env'))),
  ...dotenv.parse(fs.readFileSync(path.join(root, 'server/.env.local'))),
};

(async () => {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': config.GEMINI_API_KEY }, signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  const result = await response.json();
  if (!response.ok) {
    const details = result.error?.details || [];
    console.log(JSON.stringify({ service: 'Gemini model access', httpStatus: response.status, status: result.error?.status,
      reasons: details.map(d => d.reason).filter(r => typeof r === 'string' && /^[A-Z_]+$/.test(r)),
      leakedKey: /leaked/i.test(result.error?.message || '') }));
    process.exitCode = 1;
    return;
  }
  const models = result.models || [];
  console.log(JSON.stringify({ service: 'Gemini model access', httpStatus: response.status,
    generationModelListed: models.some(m => m.name === `models/${config.GEMINI_MODEL}`),
    embeddingModelListed: models.some(m => m.name === `models/${config.EMBEDDING_MODEL}`) }));
  const checks = [
    ['generation', config.GEMINI_MODEL, 'generateContent', { contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }], generationConfig: { maxOutputTokens: 256 } }],
    ['embeddings', config.EMBEDDING_MODEL, 'embedContent', { model: `models/${config.EMBEDDING_MODEL}`, content: { parts: [{ text: 'task: retrieval | query: contract notice period' }] }, outputDimensionality: 768 }],
  ];
  for (const [service, model, method, body] of checks) {
    if (process.argv.includes('--generation-only') && service !== 'generation') continue;
    const check = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
      method: 'POST', headers: { 'x-goog-api-key': config.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    const data = await check.json();
    console.log(JSON.stringify({ service, model, httpStatus: check.status, status: data.error?.status,
      reason: data.error?.details?.find(d => d.reason)?.reason,
      generated: Boolean(data.candidates?.[0]?.content?.parts?.some(p => p.text)),
      dimensions: data.embedding?.values?.length,
      quotaUnavailable: data.error?.status === 'RESOURCE_EXHAUSTED' }));
    if (!check.ok) process.exitCode = 1;
  }
})().catch(error => { console.error(JSON.stringify({ service: 'Gemini model access', error: error.name, networkCode: error.cause?.code || null })); process.exitCode = 1; });
