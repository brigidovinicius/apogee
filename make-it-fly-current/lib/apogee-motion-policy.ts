export type ApogeeMotionInput = {
  mounted: boolean;
  lowPower: boolean;
  failed: boolean;
};

/** The scroll-driven scene starts automatically, retaining resource/WebGL safeguards. */
export function resolveApogeeMotion({
  mounted,
  lowPower,
  failed,
}: ApogeeMotionInput) {
  return { canAnimate: mounted && !lowPower && !failed };
}

type PreviousScene = {
  mounted: boolean;
  lowPower: boolean;
  sceneVersion: number;
};

type NextScene = {
  lowPower: boolean;
};

/** Readiness belongs to one effective animation generation, not an old Canvas. */
export function nextSceneVersion(previous: PreviousScene, next: NextScene) {
  const wasAnimated = previous.mounted && !previous.lowPower;
  const isAnimated = !next.lowPower;
  return previous.sceneVersion + (wasAnimated !== isAnimated ? 1 : 0);
}
