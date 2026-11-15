export type Point = { x: number; z: number };
export type FieldResult = {
  width: number;
  height: number;
  minX: number;
  minZ: number;
  spanX: number;
  spanZ: number;
  real: Float32Array;
  imaginary: Float32Array;
  db: Float32Array;
  mask: Uint8Array;
  source: Point;
  elapsedMs: number;
  cells: number;
};
export function inside(p: Point, polygon: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      yes = !yes;
  }
  return yes;
}
