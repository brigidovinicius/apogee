export type MakeItFlyScrollPosition = { href: string; left: number; top: number };

const key = "apogeeMakeItFlyScroll";

export function readMakeItFlyScroll(state: unknown, href: string): MakeItFlyScrollPosition | null {
  if (!state || typeof state !== "object" || !(key in state)) return null;
  const point = (state as Record<string, unknown>)[key];
  if (!point || typeof point !== "object") return null;
  const { href: savedHref, left, top } = point as Record<string, unknown>;
  if (savedHref !== href || new URL(href).pathname !== "/makeitfly"
    || typeof left !== "number" || !Number.isFinite(left) || left < 0
    || typeof top !== "number" || !Number.isFinite(top) || top < 0) return null;
  return { href, left, top };
}

// Add our position to the current entry without replacing Next's route state.
export function rememberMakeItFlyScroll() {
  if (window.location.pathname !== "/makeitfly") return;
  window.history.replaceState({
    ...window.history.state,
    [key]: { href: window.location.href, left: window.scrollX, top: window.scrollY },
  }, "");
}
