export type FaceRegion = [left: number, top: number, right: number, bottom: number];

export function isFaceRegion(value: unknown): value is FaceRegion {
  if (!Array.isArray(value) || value.length !== 4 ||
    !value.every(coordinate => typeof coordinate === "number" && Number.isFinite(coordinate))) return false;
  const [left, top, right, bottom] = value;
  return 0 <= left && left < right && right <= 1 && 0 <= top && top < bottom && bottom <= 1;
}
