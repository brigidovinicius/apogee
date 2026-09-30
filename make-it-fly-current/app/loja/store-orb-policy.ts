export type OrbFrameMode = "paused" | "static" | "running";

export interface OrbVisibility {
  hostVisible: boolean;
  sectionVisible: boolean;
  heroVisible: boolean;
  mobile: boolean;
  documentHidden: boolean;
  modalOpen: boolean;
  reducedMotion: boolean;
  rendererUnavailable: boolean;
}

/** The fixed mobile canvas is technically in view even when cards cover it. */
export function resolveOrbFrameMode(state: OrbVisibility): OrbFrameMode {
  if (state.rendererUnavailable || state.documentHidden || state.modalOpen
    || !state.hostVisible || !state.sectionVisible || (state.mobile && !state.heroVisible)) {
    return "paused";
  }
  return state.reducedMotion ? "static" : "running";
}
