import { writeFile, rename, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { base } from './policy.mjs';

export function runtimeStatus(env) {
  if (env.RADAR_AI_ENABLED !== 'true') return base('disabled', 'BASE');
  // Activation requires a separately reviewed transport. Environment alone cannot enable calls.
  return base('transport_disabled');
}

async function main() {
  const file = '/tmp/radar-ai-health.json';
  if (process.argv[2] === 'healthcheck') {
    try { const s = JSON.parse(await readFile(file, 'utf8')); process.exitCode = s.alive && Date.now() - Date.parse(s.at) >= 0 && Date.now() - Date.parse(s.at) < 180_000 ? 0 : 1; }
    catch { process.exitCode = 1; }
    return;
  }
  if (!['check', 'run'].includes(process.argv[2] || 'check')) throw new Error('invalid_command');
  let stop = false, wake;
  const halt = () => { stop = true; wake?.(); };
  process.on('SIGTERM', halt); process.on('SIGINT', halt);
  try {
    do {
      const status = { component: 'radar-ai-worker', alive: true, at: new Date().toISOString(), ...runtimeStatus(process.env) };
      if (process.argv[2] === 'run') {
        await writeFile(file + '.tmp', JSON.stringify(status), { mode: 0o600 });
        await rename(file + '.tmp', file);
      }
      console.log(JSON.stringify(status));
      if (process.argv[2] !== 'run' || stop) break;
      await new Promise(resolve => { const timer = setTimeout(resolve, 60_000); wake = () => { clearTimeout(timer); resolve(); }; });
    } while (!stop);
  } finally { process.off('SIGTERM', halt); process.off('SIGINT', halt); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
