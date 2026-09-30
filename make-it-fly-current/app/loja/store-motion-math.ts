export interface SpringAxis { value: number; velocity: number }

/** Exact critically damped spring step for a constant target. No Euler overshoot
 * or refresh-rate-dependent response when a pointer stops or changes direction. */
export function stepSpring(axis: SpringAxis, target: number, frequency: number, seconds: number) {
  const delta = Math.max(0, Math.min(seconds, .05));
  const displacement = axis.value - target;
  const momentum = axis.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * delta);
  axis.value = target + (displacement + momentum * delta) * decay;
  axis.velocity = (axis.velocity - frequency * momentum * delta) * decay;
  return axis.value;
}

/** Distinct drifting paths: no shared pendulum beat across the collection. */
export function floatingOffset(time: number, depth: number) {
  return {
    x: (Math.sin(time * .43) * 13 + Math.sin(time * .19 + 1.7) * 5) * depth,
    y: (Math.cos(time * .51) * 15 + Math.sin(time * .27 + .8) * 5) * depth,
    turn: Math.sin(time * .31) * .45,
  };
}
