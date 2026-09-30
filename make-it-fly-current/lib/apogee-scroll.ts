/** Real section positions keep the same journey on tall and compact layouts. */
export function flightAnchors(sectionTops: readonly number[], viewportHeight: number, documentHeight: number) {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1;
  const end = Number.isFinite(documentHeight) ? Math.max(0, documentHeight - viewport) : 0;
  if (end <= 0 || !sectionTops.length) return [0, Math.max(1, end)];
  const anchors = sectionTops.map((top, index) => Math.min(end, Math.max(0,
    Number.isFinite(top) ? top - (index === 0 ? 0 : viewport * 0.2) : 0)));
  return [...anchors, end];
}

/** Direct scroll mapping: no delayed spring, wheel interception or pinned stage. */
export function flightProgress(scrollY: number, anchors: readonly number[]) {
  if (!Number.isFinite(scrollY) || anchors.length < 2 || scrollY <= anchors[0]) return 0;
  const last = anchors.length - 1;
  if (scrollY >= anchors[last]) return 1;
  let index = 0;
  while (index < last - 1 && scrollY >= anchors[index + 1]) index++;
  const distance = anchors[index + 1] - anchors[index];
  const local = distance > 0 ? (scrollY - anchors[index]) / distance : 0;
  return Math.min(1, Math.max(0, (index + local) / last));
}
