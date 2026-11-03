import { AsyncLocalStorage } from 'node:async_hooks';

const deadlines = new AsyncLocalStorage<number>();

/** One absolute deadline follows redirects, robots and every document in a lead's chain. */
export function withOfficialRequestDeadline<T>(deadline: number, work: () => Promise<T>): Promise<T> {
  return deadlines.run(Math.min(deadlines.getStore() ?? Infinity, deadline), work);
}

export function officialRequestSignal(maximumMs = 15_000): AbortSignal {
  const remaining = Math.min(maximumMs, (deadlines.getStore() ?? Infinity) - Date.now());
  if (remaining <= 0) throw new DOMException('Official request deadline exceeded', 'TimeoutError');
  return AbortSignal.timeout(Math.ceil(remaining));
}

export function waitForOfficialRequest(milliseconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const signal = officialRequestSignal(milliseconds + 1000);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}
