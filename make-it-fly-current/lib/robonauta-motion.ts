export const HEAD_YAW_LIMIT = (20 * Math.PI) / 180;
export const HEAD_PITCH_LIMIT = (10 * Math.PI) / 180;

export interface PointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
}

export interface HeadMotionState extends HeadPose {
  yawVelocity: number;
  pitchVelocity: number;
}

function clamp(value: number, limit: number) {
  return Number.isFinite(value) ? Math.max(-limit, Math.min(limit, value)) : 0;
}

/** Radians for a head facing +Z: positive yaw looks right, positive pitch down.
 * Pass the visible tracking area's bounds; leaving it selects a neutral pose. */
export function pointerToHeadPose(
  clientX: number,
  clientY: number,
  bounds: PointerBounds,
  active = true,
): HeadPose {
  if (
    !active ||
    ![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return { yaw: 0, pitch: 0 };
  }

  return {
    yaw: clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, 1) * HEAD_YAW_LIMIT,
    pitch: clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, 1) * HEAD_PITCH_LIMIT,
  };
}

export function createHeadMotionState(): HeadMotionState {
  return { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
}

function stepAxis(value: number, velocity: number, target: number, limit: number, seconds: number, response: number) {
  const start = clamp(value, limit);
  const speed = clamp(velocity, 4);
  const destination = clamp(target, limit);
  const displacement = start - destination;
  const momentum = speed + response * displacement;
  const decay = Math.exp(-response * seconds);
  const nextValue = destination + (displacement + momentum * seconds) * decay;
  const nextVelocity = (speed - response * momentum * seconds) * decay;
  const boundedValue = clamp(nextValue, limit);
  const movingBeyondLimit =
    (nextValue >= limit && nextVelocity > 0) ||
    (nextValue <= -limit && nextVelocity < 0);

  return {
    value: boundedValue,
    velocity: movingBeyondLimit ? 0 : nextVelocity,
  };
}

/** Exact critically damped spring integration for each frame's target.
 * It retains momentum through pointer reversals without depending on frame rate.
 * Inputs are immutable; seconds is elapsed time, and response is in s^-1. */
export function stepHeadMotion(
  state: HeadMotionState,
  target: HeadPose,
  seconds: number,
  response = 10,
): HeadMotionState {
  const elapsed = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 10)) : 0;
  const frequency = Number.isFinite(response) && response > 0 ? Math.min(response, 60) : 10;
  const yaw = stepAxis(state.yaw, state.yawVelocity, target.yaw, HEAD_YAW_LIMIT, elapsed, frequency);
  const pitch = stepAxis(state.pitch, state.pitchVelocity, target.pitch, HEAD_PITCH_LIMIT, elapsed, frequency);

  return {
    yaw: yaw.value,
    pitch: pitch.value,
    yawVelocity: yaw.velocity,
    pitchVelocity: pitch.velocity,
  };
}
