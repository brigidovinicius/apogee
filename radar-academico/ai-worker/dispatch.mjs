import { base, decideMode, failureKind, prepareRequest } from './policy.mjs';

/** Provider is deliberately injected. There is NO real OpenAI transport in this release. */
export async function dispatch({ store, request, provider = null, onBase, onReserved, now = Date.now }) {
  const fallback = async decision => ({ ...decision, result: await onBase(decision) });
  if (!provider) return fallback(base('transport_disabled'));
  let decision, reservation;
  try {
    decision = decideMode(await store.status(), now());
    if (decision.mode !== 'AMPLIADO') return fallback(decision);
    // Rebuild at the trust boundary: a caller cannot forge a smaller cost descriptor.
    request = prepareRequest(request?.key, request?.envelope, request?.body, {stream:request?.stream,purpose:request?.purpose});
    reservation = await store.reserve(request);
    if (reservation.status !== 'reserved') return fallback(base(reservation.reason || reservation.status,
      reservation.mode));
    if (onReserved && await onReserved(reservation.id) !== true) {
      await store.finish(reservation.id, 'not_sent', null, 'task_changed');
      return fallback(base('task_changed'));
    }
    const sent = await store.markSent(reservation.id);
    if (!sent.sent) return fallback(base(sent.reason, sent.mode));
  } catch { return fallback(base('control_unavailable')); }

  let response;
  try { response = await provider(request.body, { operationId: reservation.id, maximumMicro: reservation.maximum_micro }); }
  catch (error) {
    const reason = failureKind(error);
    try { await store.finish(reservation.id, 'unknown', null, reason); } catch { /* Durable sent reservation remains held. */ }
    return fallback(base(reason, reason === 'credit_balance_exhausted' ? 'BASE_CREDITO' : 'BASE_API'));
  }
  if (!response || !Number.isSafeInteger(response.costMicro) || response.costMicro < 0) {
    try { await store.finish(reservation.id, 'unknown', null, 'usage_unknown'); } catch { /* Preserve hold. */ }
    return fallback(base('usage_unknown'));
  }
  try {
    const settled = await store.finish(reservation.id, 'confirmed', response.costMicro);
    if (!settled.accepted) return fallback(base(settled.reason || 'settlement_failed'));
  } catch { return fallback(base('settlement_unknown')); }
  // A proposal only. Publication is owned by the existing Radar validation pipeline.
  return { mode: 'AMPLIADO', reason: 'completed', operationId: reservation.id, proposal: response.value };
}
