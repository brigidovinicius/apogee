import { prepareRequest } from './policy.mjs';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const MAX_RESPONSE_BYTES = 262_144;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const failure = (code = 'api_unavailable', status) => Object.assign(new Error(code), { code, status });

export function readResponseTariff(value, model, now = Date.now()) {
  if (!value || value.model !== model || value.approved !== true ||
    typeof value.price_version !== 'string' || !value.price_version ||
    !Number.isFinite(Date.parse(value.valid_until)) || Date.parse(value.valid_until) <= now ||
    !['input_micro_per_million', 'cached_input_micro_per_million', 'cache_write_micro_per_million', 'output_micro_per_million']
      .every(key => integer(value[key]) && value[key] <= 1_000_000_000)) throw failure('price_unverified');
  return Object.freeze({ ...value });
}

/** Input, cache reads and 30-minute cache writes are disjoint billing buckets.
 * Integer arithmetic rounds the total upwards once, including reasoning output. */
export function responseCost(usage, tariff) {
  const cached = usage?.input_tokens_details?.cached_tokens;
  const writes = usage?.input_tokens_details?.cache_write_tokens;
  if (!usage || ![usage.input_tokens, usage.output_tokens, usage.total_tokens, cached, writes].every(integer) ||
    cached + writes > usage.input_tokens || usage.total_tokens !== usage.input_tokens + usage.output_tokens) throw failure('usage_unknown');
  const microTimesMillion = BigInt(usage.input_tokens - cached - writes) * BigInt(tariff.input_micro_per_million) +
    BigInt(cached) * BigInt(tariff.cached_input_micro_per_million) + BigInt(writes) * BigInt(tariff.cache_write_micro_per_million) +
    BigInt(usage.output_tokens) * BigInt(tariff.output_micro_per_million);
  const cost = (microTimesMillion + 999_999n) / 1_000_000n;
  if (cost > BigInt(Number.MAX_SAFE_INTEGER)) throw failure('usage_unknown');
  return Number(cost);
}

async function boundedJson(response) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES) ||
    !response.body || !/application\/json/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel().catch(() => {});
    throw failure('usage_unknown');
  }
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw failure('usage_unknown');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

/** One fixed-host HTTPS request, no SDK retries, redirects, tools or state storage.
 * This function is usable only after dispatch reserved and marked the operation. */
export function createOpenAIProvider({ apiKey, organizationId, projectId, fetchImpl = fetch, timeoutMs = 30_000, now = Date.now }) {
  if (typeof apiKey !== 'string' || !/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey) ||
    !/^org-[A-Za-z0-9]{8,80}$/.test(organizationId || '') || !/^proj_[A-Za-z0-9]{8,80}$/.test(projectId || '') ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw failure('credentials_unavailable');
  const validate = (body, context = {}) => {
    const request = prepareRequest('provider:validate', 'extraction', body);
    const tariff = readResponseTariff(context.responseTariff, request.model, now());
    if (context.organizationId !== organizationId || context.projectId !== projectId) throw failure('allocation_unverified');
    const worstInput = Math.max(tariff.input_micro_per_million, tariff.cached_input_micro_per_million, tariff.cache_write_micro_per_million);
    const minimumReserve = Math.ceil(request.inputBound * worstInput / 1_000_000) + Math.ceil(request.outputLimit * tariff.output_micro_per_million / 1_000_000);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.operationId || '') ||
      !integer(context.maximumMicro) || context.maximumMicro < Math.max(1, minimumReserve) || context.maximumMicro > 2_000_000 ||
      body.store !== false || body.service_tier !== 'default') throw failure('reservation_required');
    return { request, tariff };
  };
  const send = async (body, context) => {
    const { request, tariff } = validate(body, context);
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
        'OpenAI-Organization': organizationId, 'OpenAI-Project': projectId, 'X-Client-Request-Id': context.operationId },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) {
      // Provider text may contain request data. Do not put it in logs or exceptions.
      let code;
      try { code = (await boundedJson(response))?.error?.code; } catch { /* retain unknown reservation */ }
      throw failure(['insufficient_quota', 'credit_balance_exhausted'].includes(code) ? 'credit_balance_exhausted' :
        response.status === 429 ? 'rate_limited' : 'api_unavailable', response.status);
    }
    const result = await boundedJson(response);
    if (!/^resp_[A-Za-z0-9_-]{8,200}$/.test(result?.id || '') || !/^req_[A-Za-z0-9_-]{1,200}$/.test(response.headers.get('x-request-id') || '') || result.model !== body.model ||
      result.service_tier !== 'default' || !['completed', 'incomplete'].includes(result.status) ||
      !Array.isArray(result.output)) throw failure('usage_unknown');
    const costMicro = responseCost(result.usage, tariff);
    const text = result.output.filter(item => item.type === 'message' && item.role === 'assistant')
      .flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('\n');
    return { costMicro, value: { text, complete: result.status === 'completed', responseId: result.id },
      receipt: { responseId: result.id, requestId: response.headers.get('x-request-id'),
        inputTokens: result.usage.input_tokens, cachedTokens: result.usage.input_tokens_details.cached_tokens,
        cacheWriteTokens: result.usage.input_tokens_details.cache_write_tokens, outputTokens: result.usage.output_tokens } };
  };
  send.preflight = validate;
  return send;
}
