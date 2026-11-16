import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
test('worker is opt-in and disconnected from web/scheduler credentials and blog',async()=>{
  const compose=await readFile(new URL('../../infra/vps/docker-compose.yml',import.meta.url),'utf8');
  const ai=compose.split('  ai-worker:\n')[1].split('  migrate:\n')[0];
  assert.match(ai,/profiles: \[ai\]/);assert.match(ai,/RADAR_AI_ENABLED:-false/);
  assert.doesNotMatch(ai,/OPENAI_API_KEY|DATABASE_EDITOR|DATABASE_MIGRATION|BLOG_|apogee_radar_bridge|depends_on:|ports:/);
  assert.match(ai,/secrets: \[radar_ai_openai_env, radar_ai_database_url\]/);
  assert.match(ai,/networks: \[internal, ai_egress\]/);assert.match(ai,/read_only: true/);
  const web=compose.split('  web:\n')[1].split('  scheduler:\n')[0];
  const scheduler=compose.split('  scheduler:\n')[1].split('  ai-worker:\n')[0];
  assert.doesNotMatch(web+scheduler,/OPENAI_|RADAR_AI_|ai-worker/);
  const docker=await readFile(new URL('../../Dockerfile',import.meta.url),'utf8');
  const stage=docker.split('AS ai-runner')[1].split('FROM node:22-alpine AS runner')[0];
  assert.doesNotMatch(stage,/\.next|blog|from=deps|OPENAI_API_KEY/);
  const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.dependencies,{pg:'8.23.0'});
});
test('only the dedicated transport contains the fixed provider host; no base imports change',async()=>{
  for(const name of (await readdir(new URL('../',import.meta.url))).filter(n=>n.endsWith('.mjs'))){
    const source=await readFile(new URL('../'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/blog-worker|lib\/blog/);
    if(name!=='openai.mjs') assert.doesNotMatch(source,/fetch\s*\(|api\.openai\.com|https?:\/\//);
  }
  const scheduler=await readFile(new URL('../../scripts/run-scheduled-ingestion.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(scheduler,/radar_ai|ai-worker|OPENAI/);
});
