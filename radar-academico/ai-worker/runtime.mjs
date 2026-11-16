import { open, constants } from 'node:fs/promises';
import { base, decideMode } from './policy.mjs';
import { createOpenAIProvider } from './openai.mjs';
import { AiStore } from './store.mjs';
import { processOne } from './queue.mjs';

const unavailable = () => new Error('credentials_unavailable');
async function readSecret(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw unavailable();
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 4096) throw unavailable();
    const bytes = Buffer.alloc(4097);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    if (bytesRead > 4096) throw unavailable();
    return bytes.subarray(0, bytesRead).toString('utf8').trim();
  } finally { await file.close(); }
}

/** Only the dedicated env file is read. Never load or modify the web/blog env. */
export async function loadCredentials(env, read = readSecret) {
  if (env.RADAR_AI_ENABLED !== 'true') return null;
  try {
    const organizationId = env.RADAR_AI_ORGANIZATION_ID;
    const projectId = env.RADAR_AI_PROJECT_ID;
    if (!/^org-[A-Za-z0-9]{8,80}$/.test(organizationId || '') || !/^proj_[A-Za-z0-9]{8,80}$/.test(projectId || '')) throw unavailable();
    const content = await read(env.RADAR_AI_KEY_FILE || '/run/secrets/radar_ai_openai_env');
    const entries = content.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
    if (entries.length !== 1) throw unavailable();
    const match = entries[0].match(/^OPENAI_API_KEY=(sk-[A-Za-z0-9_-]{20,})$/);
    if (!match) throw unavailable();
    const connectionString = await read(env.RADAR_AI_DATABASE_URL_FILE || '/run/secrets/radar_ai_database_url');
    const url = new URL(connectionString);
    if (url.protocol !== 'postgresql:' || url.username !== 'radar_ai_worker' || !url.password ||
      url.hostname !== 'postgres' || !['', '5432'].includes(url.port) || !/^\/[A-Za-z0-9_]{1,63}$/.test(url.pathname) || url.search || url.hash) throw unavailable();
    return { apiKey: match[1], organizationId, projectId, connectionString };
  } catch { throw unavailable(); }
}

export async function createRuntime(env, dependencies = {}) {
  const credentials = await loadCredentials(env, dependencies.readSecret);
  if (!credentials) return { check: async () => base('disabled'), tick: async () => base('disabled'), close: async () => {} };
  const pg = dependencies.pg || (await import('pg')).default;
  const pool = new pg.Pool({ connectionString: credentials.connectionString, max: 1, application_name: 'radar-ai-worker',
    connectionTimeoutMillis: 5000, query_timeout: 5000, statement_timeout: 5000, idleTimeoutMillis: 10000 });
  // Pool errors may contain connection data. They are handled by the next bounded tick.
  pool.on('error', () => {});
  const store = new AiStore((sql, args) => pool.query(sql, args));
  const provider = createOpenAIProvider({ ...credentials, fetchImpl: dependencies.fetchImpl });
  return {
    check: async () => { try { return decideMode(await store.status()); } catch { return base('control_unavailable'); } },
    tick: () => processOne({ store, provider }),
    close: () => pool.end(),
  };
}

/** Logs/health never include tasks, proposals, credentials, URLs or provider errors. */
export function publicStatus(result, now = Date.now()) {
  return { component: 'radar-ai-worker', alive: true, at: new Date(now).toISOString(), mode: result.mode, reason: result.reason };
}
