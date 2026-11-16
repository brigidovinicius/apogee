import { prepareRequest, base } from './policy.mjs';
import { dispatch } from './dispatch.mjs';

/** One bounded task per invocation; proposals never publish catalogue content. */
export async function processOne({ store, provider = null }) {
  if (!provider) return base('transport_disabled');
  let task;
  try {
    await store.recover();
    const claim = await store.claimTask();
    if (claim.status !== 'claimed') return base(claim.reason || claim.status);
    task = claim.task;
    const request = prepareRequest(task.task_key, task.envelope, task.body, {stream:task.stream,purpose:task.purpose});
    if (request.requestHash !== task.request_hash) throw Error('task_hash_mismatch');
    const result = await dispatch({ store, request, provider, onBase: () => null,
      onReserved: id => store.attachTask(task.id, task.lease_token, id) });
    if (result.mode === 'AMPLIADO' && result.proposal?.complete !== false && await store.completeTask(task.id, task.lease_token, result.proposal)) return result;
    await store.deferTask(task.id, task.lease_token);
    return result.mode === 'AMPLIADO' ? base(result.proposal?.complete === false ? 'incomplete_response' : 'stale_proposal') : result;
  } catch {
    if (task) { try { await store.deferTask(task.id, task.lease_token); } catch { /* Lease recovery preserves holds. */ } }
    return base('control_unavailable');
  }
}
