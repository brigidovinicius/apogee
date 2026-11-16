import { createHash } from 'node:crypto';

export const LIMITS = Object.freeze({ cycle: 50_000_000, operational: 50_000_000, day: 2_000_000,
  streams: Object.freeze({ radar: 30_000_000, jobs: 15_000_000, reserve: 5_000_000 }),
  envelopes: Object.freeze({ extraction: 50_000_000, discovery: 50_000_000, search: 50_000_000, embeddings: 50_000_000, evaluation: 50_000_000 }) });

export function base(reason, mode) {
  if (!mode) {
    if (['disabled', 'operator_pause'].includes(reason)) mode = 'BASE';
    else if (['credit_expired', 'credit_exhausted', 'credit_balance_exhausted', 'cycle_limit', 'daily_limit', 'envelope_limit', 'monthly_limit', 'stream_limit'].includes(reason)) mode = 'BASE_CREDITO';
    else if (['rate_limited', 'api_unavailable'].includes(reason)) mode = 'BASE_API';
    else mode = 'BASE_CONTROLE';
  }
  return { mode, reason };
}

/** No credentials, account guesses or inferred renewal dates belong in a mode decision. */
export function decideMode(snapshot, now = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object') return base('control_unavailable');
  if (snapshot.manual_paused) return base('operator_pause', 'BASE');
  if (!snapshot.enabled) return base('disabled', 'BASE');
  if (snapshot.budget_block) return base(snapshot.budget_block);
  if (!snapshot.cycle_id || snapshot.product !== 'radar' || !snapshot.project_matches) return base('allocation_unverified');
  const times = ['starts_at', 'ends_at', 'verified_at', 'proof_until'].map(k => Date.parse(snapshot[k]));
  if (!times.every(Number.isFinite) || times[0] > now || times[2] > now || times[3] - times[2] > 6 * 3600_000) return base('allocation_unverified');
  if (times[1] <= now) return base('credit_expired', 'BASE_CREDITO');
  if (times[3] <= now || snapshot.free_only_verified !== true) return base('billing_unverified');
  if (!Number.isSafeInteger(snapshot.free_micro) || snapshot.free_micro <= 0) return base('credit_exhausted', 'BASE_CREDITO');
  if (snapshot.circuit_until && Date.parse(snapshot.circuit_until) > now) return base(snapshot.circuit_reason || 'api_unavailable',
    snapshot.circuit_reason === 'credit_balance_exhausted' ? 'BASE_CREDITO' : 'BASE_API');
  return { mode: 'AMPLIADO', reason: 'eligible' };
}

/** Reserve a byte upper bound including serialized input/instructions and framing allowance.
 * Tools remain unsupported in this foundation: their retrieved-token cost is not bounded. */
export function prepareRequest(key, envelope, body, { stream = 'radar', purpose = 'normal' } = {}) {
  if (!Object.hasOwn(LIMITS.streams, stream) || !['normal','recheck','recovery'].includes(purpose) || stream === 'reserve' && purpose === 'normal') throw Error('invalid_budget_stream');
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(key) || !Object.hasOwn(LIMITS.envelopes, envelope)) throw new Error('invalid_operation');
  if (!body || typeof body !== 'object' || Array.isArray(body) || !/^[a-z0-9][a-z0-9.-]{1,79}$/.test(body.model || '')) throw new Error('invalid_request');
  const allowed = ['model', 'input', 'instructions', 'max_output_tokens', 'tools', 'background', 'store', 'stream'];
  if (Object.keys(body).some(key => !allowed.includes(key)) || typeof body.input !== 'string' ||
    (body.instructions !== undefined && typeof body.instructions !== 'string')) throw new Error('text_only_request_required');
  if (!Number.isSafeInteger(body.max_output_tokens) || body.max_output_tokens < 1 || body.max_output_tokens > 8000) throw new Error('invalid_output_limit');
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length)) throw new Error('tools_not_supported');
  if (body.background || body.store || body.stream) throw new Error('unsupported_request_mode');
  const serialized = JSON.stringify(Object.fromEntries(Object.keys(body).sort().map(key => [key, body[key]])));
  const inputBound = Buffer.byteLength(serialized, 'utf8') + 4096;
  if (inputBound > 64_000) throw new Error('input_limit');
  return Object.freeze({ key, envelope, stream, purpose, model: body.model, inputBound, outputLimit: body.max_output_tokens,
    requestHash: createHash('sha256').update(JSON.stringify({ serialized, stream, purpose })).digest('hex'),
    body: Object.freeze({ ...JSON.parse(serialized), ...(body.tools ? { tools: Object.freeze([]) } : {}) }) });
}

export function failureKind(error) {
  if (error?.code === 'credit_balance_exhausted') return 'credit_balance_exhausted';
  if (error?.status === 429) return 'rate_limited';
  return 'api_unavailable';
}
