/** Values shared by the real camera and the HTML labels around the globe. */
export const APOGEE_FOV = 35;
export const APOGEE_SUN = [-3.8, 2.6, 4.5] as const;

export type ApogeeSample = {
  progress: number;
  /** Earth diameter as a fraction of the canvas width, not its height. */
  diameterRatio: number;
  /** Normalized canvas coordinates, measured from its top-left corner. */
  center: readonly [number, number];
  distance: number;
  yaw: number;
  pitch: number;
  camera: readonly [number, number, number];
  rotation: number;
  cloudRotation: number;
  starOpacity: number;
  atmosphereOpacity: number;
};

type CameraStop = readonly [progress: number, diameter: number, x: number, y: number];

const desktopStops: readonly CameraStop[] = [
  [0, 1.75, 1.05, 1.43],
  [0.12, 1.28, 0.94, 0.92],
  [0.42, 0.6, 0.68, 0.43],
  [0.7, 0.22, 0.78, 0.36],
  [0.82, 0.115, 0.78, 0.37],
  [1, 0.105, 0.78, 0.38],
];

const mobileStops: readonly CameraStop[] = [
  [0, 1.8, 1.18, 0.58],
  [0.14, 1.42, 1.04, 0.46],
  [0.48, 0.65, 0.66, 0.3],
  [0.7, 0.36, 0.78, 0.265],
  [0.82, 0.275, 0.78, 0.255],
  [1, 0.26, 0.78, 0.255],
];

export function clampApogee(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function smoothApogee(value: number) {
  const t = clampApogee(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Exact distance for the perspective silhouette of a unit sphere. */
export function apogeeDistance(diameterRatio: number, aspect: number) {
  const halfFov = (APOGEE_FOV * Math.PI) / 360;
  return Math.sqrt(1 + (1 / (diameterRatio * aspect * Math.tan(halfFov))) ** 2);
}

/** Monotone cubic Hermite interpolation keeps velocity continuous at the stops. */
function interpolate(stops: readonly CameraStop[], values: readonly number[], p: number) {
  let index = 0;
  while (index < stops.length - 2 && p > stops[index + 1][0]) index++;
  const slopes = values.slice(1).map((value, i) => (value - values[i]) / (stops[i + 1][0] - stops[i][0]));
  const tangent = (i: number) => {
    if (i === 0) return slopes[0];
    if (i === stops.length - 1) return 0;
    const before = slopes[i - 1];
    const after = slopes[i];
    if (before * after <= 0) return 0;
    const h0 = stops[i][0] - stops[i - 1][0];
    const h1 = stops[i + 1][0] - stops[i][0];
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / before + (h1 + 2 * h0) / after);
  };
  const width = stops[index + 1][0] - stops[index][0];
  const t = clampApogee((p - stops[index][0]) / width);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * values[index]
    + (t3 - 2 * t2 + t) * width * tangent(index)
    + (-2 * t3 + 3 * t2) * values[index + 1]
    + (t3 - t2) * width * tangent(index + 1);
}

export function sampleApogee(progress: number, compact = false, canvasAspect?: number): ApogeeSample {
  const p = clampApogee(progress);
  const aspect = canvasAspect && Number.isFinite(canvasAspect) && canvasAspect > 0
    ? canvasAspect
    : compact ? 390 / 844 : 1.6;
  const stops = compact ? mobileStops : desktopStops;
  const distance = interpolate(stops, stops.map((stop) => apogeeDistance(stop[1], aspect)), p);
  const diameterRatio = 1 / (Math.sqrt(distance * distance - 1) * Math.tan((APOGEE_FOV * Math.PI) / 360) * aspect);
  const travel = smoothApogee(p);
  const yaw = -0.095 + travel * 0.21;
  const pitch = 0.055 + Math.sin(travel * Math.PI * 0.72) * 0.065;
  const rotation = (4 * Math.PI / 180) * travel;

  return {
    progress: p,
    diameterRatio,
    center: [interpolate(stops, stops.map((stop) => stop[2]), p), interpolate(stops, stops.map((stop) => stop[3]), p)],
    distance,
    yaw,
    pitch,
    camera: [
      distance * Math.sin(yaw) * Math.cos(pitch),
      distance * Math.sin(pitch),
      distance * Math.cos(yaw) * Math.cos(pitch),
    ],
    rotation,
    cloudRotation: rotation * 1.08,
    starOpacity: 0.25 + 0.28 * smoothApogee((p - 0.18) / 0.62),
    atmosphereOpacity: 0.56 - 0.18 * travel,
  };
}

// Section-aligned camera choreography: opening, experience, journey, schedule,
// manifesto, host, participation and the end of the page. No orbit-line UI.
const flightDesktopStops: readonly CameraStop[] = [
  [0, 1.75, 1.05, 1.43],
  [0.055, 0.95, 0.9, 0.83],
  [1 / 7, 0.42, 0.79, 0.5],
  [2 / 7, 0.48, 0.18, 0.64],
  [3 / 7, 0.32, 0.48, 0.68],
  [4 / 7, 0.6, 0.75, 0.52],
  [5 / 7, 0.34, 0.16, 0.72],
  [6 / 7, 0.4, 0.82, 0.36],
  [1, 0.2, 0.5, 0.3],
];
const flightMobileStops: readonly CameraStop[] = [
  [0, 1.8, 1.18, 0.58],
  [0.055, 1.0, 0.96, 0.42],
  [1 / 7, 0.64, 0.84, 0.3],
  [2 / 7, 0.82, 0.12, 0.62],
  [3 / 7, 0.6, 0.83, 0.48],
  [4 / 7, 1.05, 0.7, 0.52],
  [5 / 7, 0.68, 0.12, 0.72],
  [6 / 7, 0.66, 0.84, 0.32],
  [1, 0.4, 0.5, 0.25],
];

export function sampleEarthFlight(progress: number, compact = false, canvasAspect?: number): ApogeeSample & { opacity: number } {
  const p = clampApogee(progress);
  const aspect = canvasAspect && Number.isFinite(canvasAspect) && canvasAspect > 0
    ? canvasAspect : compact ? 390 / 844 : 1.6;
  const stops = compact ? flightMobileStops : flightDesktopStops;
  const distance = interpolate(stops, stops.map(stop => apogeeDistance(stop[1], aspect)), p);
  const diameterRatio = 1 / (Math.sqrt(distance * distance - 1) * Math.tan((APOGEE_FOV * Math.PI) / 360) * aspect);
  const yaw = -0.095 + p * 0.32;
  const pitch = 0.055 + Math.sin(p * Math.PI) * 0.065;
  const rotation = p * Math.PI * 0.28;
  const opacity = interpolate(stops, compact
    ? [1, 0.82, 0.38, 0.32, 0.19, 0.34, 0.23, 0.24, 0.12]
    : [1, 0.9, 0.66, 0.62, 0.25, 0.48, 0.34, 0.36, 0.14], p);

  return {
    progress: p, diameterRatio, distance, yaw, pitch, rotation,
    center: [interpolate(stops, stops.map(stop => stop[2]), p), interpolate(stops, stops.map(stop => stop[3]), p)],
    camera: [distance * Math.sin(yaw) * Math.cos(pitch), distance * Math.sin(pitch), distance * Math.cos(yaw) * Math.cos(pitch)],
    cloudRotation: rotation * 1.08,
    starOpacity: 0.18 + 0.13 * smoothApogee(p),
    atmosphereOpacity: 0.5 - 0.12 * p,
    opacity,
  };
}
