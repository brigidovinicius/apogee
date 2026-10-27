/** A small observable for the orbital video; no animation runtime is needed. */
export type ScrollProgress = ReturnType<typeof createScrollProgress>;
export function createScrollProgress(initial = 0) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: number) {
      if (next === value) return;
      value = next;
      listeners.forEach((notify) => notify());
    },
    on(_event: "change", notify: () => void) {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
  };
}
