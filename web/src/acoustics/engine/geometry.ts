import {
  v,
  add,
  sub,
  scale,
  dot,
  unit,
  cross,
  distance,
  validVec,
  finite,
  type Vec,
  type SurfaceData,
  type WallData,
  type FloorData,
  type OpeningData,
  type AcousticMaterial,
} from "./domain.ts";
export type Box = { min: Vec; max: Vec };
export type Hit = {
  t: number;
  point: Vec;
  surface: AcousticSurface;
  material: AcousticMaterial | null;
  opening?: OpeningData;
};
export type DiffractionEdge = { id: string; a: Vec; b: Vec };
export function pointInPolygon(
  x: number,
  z: number,
  points: { x: number; z: number }[],
) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function bounds(points: Vec[]): Box {
  return {
    min: v(
      Math.min(...points.map((p) => p.x)),
      Math.min(...points.map((p) => p.y)),
      Math.min(...points.map((p) => p.z)),
    ),
    max: v(
      Math.max(...points.map((p) => p.x)),
      Math.max(...points.map((p) => p.y)),
      Math.max(...points.map((p) => p.z)),
    ),
  };
}
export function intersectsBox(a: Vec, b: Vec, box: Box) {
  let lo = 0,
    hi = 1;
  for (const k of ["x", "y", "z"] as const) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-10) {
      if (a[k] < box.min[k] - 0.0001 || a[k] > box.max[k] + 0.0001)
        return false;
    } else {
      let t = (box.min[k] - 0.0001 - a[k]) / d,
        u = (box.max[k] + 0.0001 - a[k]) / d;
      if (t > u) [t, u] = [u, t];
      lo = Math.max(lo, t);
      hi = Math.min(hi, u);
      if (lo > hi) return false;
    }
  }
  return true;
}
export abstract class AcousticSurface {
  readonly data: SurfaceData;
  readonly material: AcousticMaterial;
  abstract readonly normal: Vec;
  abstract readonly origin: Vec;
  abstract readonly box: Box;
  constructor(data: SurfaceData, materials: Map<string, AcousticMaterial>) {
    this.data = data;
    const m = materials.get(data.materialId);
    if (!m) throw new Error(`Unknown material ${data.materialId}`);
    this.material = m;
  }
  abstract contains(p: Vec): boolean;
  materialAt(_p: Vec): {
    material: AcousticMaterial | null;
    opening?: OpeningData;
  } {
    return { material: this.material };
  }
  intersect(a: Vec, b: Vec): Hit | null {
    const d = sub(b, a),
      den = dot(d, this.normal);
    if (Math.abs(den) < 1e-9) return null;
    const t = dot(sub(this.origin, a), this.normal) / den;
    if (t <= 1e-5 || t >= 1 - 1e-5) return null;
    const point = add(a, scale(d, t));
    return this.contains(point)
      ? { t, point, surface: this, ...this.materialAt(point) }
      : null;
  }
  mirror(p: Vec) {
    return sub(
      p,
      scale(this.normal, 2 * dot(sub(p, this.origin), this.normal)),
    );
  }
  abstract edges(): DiffractionEdge[];
}
export class Opening {
  readonly data: OpeningData;
  readonly material: AcousticMaterial;
  constructor(data: OpeningData, materials: Map<string, AcousticMaterial>) {
    this.data = data;
    const material = materials.get(data.materialId);
    if (!material)
      throw new Error(`Unknown opening material ${data.materialId}`);
    this.material = material;
  }
  contains(localM: number, y: number) {
    const o = this.data;
    return (
      Math.abs(localM - o.centerM) < o.widthM / 2 - 1e-6 &&
      y > o.bottomM + 1e-6 &&
      y < o.bottomM + o.heightM - 1e-6
    );
  }
  transmittedMaterial() {
    return this.data.state === "open" ? null : this.material;
  }
}
export class Wall extends AcousticSurface {
  readonly origin: Vec;
  readonly normal: Vec;
  readonly u: Vec;
  readonly width: number;
  readonly box: Box;
  readonly wall: WallData;
  readonly materials: Map<string, AcousticMaterial>;
  readonly apertures: Opening[];
  constructor(data: WallData, materials: Map<string, AcousticMaterial>) {
    super(data, materials);
    validVec(data.a);
    validVec(data.b);
    finite(data.heightM, "Wall height");
    finite(data.thicknessM, "Wall thickness");
    if (
      data.heightM <= 0 ||
      data.thicknessM < 0 ||
      Math.abs(data.a.y - data.b.y) > 0.0001
    )
      throw new Error("Wall needs positive height and horizontal base");
    this.width = distance(data.a, data.b);
    if (this.width < 0.001) throw new Error("Zero-length wall");
    this.wall = data;
    this.materials = materials;
    this.apertures = data.openings.map((o) => new Opening(o, materials));
    this.origin = data.a;
    this.u = unit(sub(data.b, data.a));
    this.normal = cross(this.u, v(0, 1, 0));
    this.box = bounds([
      data.a,
      data.b,
      add(data.a, v(0, data.heightM, 0)),
      add(data.b, v(0, data.heightM, 0)),
    ]);
    for (const o of data.openings) {
      [o.centerM, o.widthM, o.bottomM, o.heightM].forEach((n) =>
        finite(n, "Opening dimension"),
      );
      if (
        o.widthM <= 0 ||
        o.heightM <= 0 ||
        o.centerM - o.widthM / 2 < -0.025 ||
        o.centerM + o.widthM / 2 > this.width + 0.025 ||
        o.bottomM < data.a.y - 0.06 ||
        o.bottomM + o.heightM > data.a.y + data.heightM + 0.06
      )
        throw new Error(`Opening ${o.id} does not fit wall ${data.id}`);
      if (!materials.has(o.materialId))
        throw new Error(`Unknown opening material ${o.materialId}`);
      if (!["open", "closed"].includes(o.state))
        throw new Error("Invalid opening state");
    }
  }
  contains(p: Vec) {
    const t = dot(sub(p, this.origin), this.u);
    return (
      t >= -1e-5 &&
      t <= this.width + 1e-5 &&
      p.y >= this.origin.y - 1e-5 &&
      p.y <= this.origin.y + this.wall.heightM + 1e-5
    );
  }
  materialAt(p: Vec) {
    const x = dot(sub(p, this.origin), this.u),
      opening = this.apertures.find((o) => o.contains(x, p.y));
    return opening
      ? { opening: opening.data, material: opening.transmittedMaterial() }
      : { material: this.material };
  }
  edges() {
    const result: DiffractionEdge[] = [];
    const edge = (id: string, a: Vec, b: Vec) =>
      result.push({ id: `${this.data.id}:${id}`, a, b });
    const top = v(0, this.wall.heightM, 0);
    edge("left", this.wall.a, add(this.wall.a, top));
    edge("right", this.wall.b, add(this.wall.b, top));
    edge("top", add(this.wall.a, top), add(this.wall.b, top));
    for (const o of this.wall.openings.filter((o) => o.state === "open")) {
      const left = add(this.origin, scale(this.u, o.centerM - o.widthM / 2)),
        right = add(this.origin, scale(this.u, o.centerM + o.widthM / 2));
      const a = { ...left, y: o.bottomM },
        b = { ...right, y: o.bottomM },
        c = { ...left, y: o.bottomM + o.heightM },
        d = { ...right, y: o.bottomM + o.heightM };
      edge(`${o.id}:left`, a, c);
      edge(`${o.id}:right`, b, d);
      edge(`${o.id}:top`, c, d);
      if (o.bottomM > this.origin.y + 0.05) edge(`${o.id}:bottom`, a, b);
    }
    return result;
  }
}
export class Floor extends AcousticSurface {
  readonly origin: Vec;
  readonly normal = v(0, 1, 0);
  readonly box: Box;
  readonly floor: FloorData;
  constructor(data: FloorData, materials: Map<string, AcousticMaterial>) {
    super(data, materials);
    if (data.polygon.length < 3)
      throw new Error("Floor polygon needs at least three points");
    data.polygon.forEach((p) => validVec(p));
    this.origin = data.polygon[0];
    if (data.polygon.some((p) => Math.abs(p.y - this.origin.y) > 0.001))
      throw new Error("Floor must be horizontal");
    this.floor = data;
    this.box = bounds(data.polygon);
  }
  contains(p: Vec) {
    return (
      pointInPolygon(p.x, p.z, this.floor.polygon) &&
      !(this.floor.holes ?? []).some((h) => pointInPolygon(p.x, p.z, h))
    );
  }
  edges() {
    return [];
  } // slab-edge diffraction is an extension point, not a fake roof leak
}
/** Static bounding-volume hierarchy: ray queries avoid scanning every wall. */
export class SurfaceIndex {
  readonly box: Box;
  readonly left?: SurfaceIndex;
  readonly right?: SurfaceIndex;
  readonly items: AcousticSurface[];
  constructor(items: AcousticSurface[]) {
    this.box = items.length
      ? bounds(items.flatMap((s) => [s.box.min, s.box.max]))
      : { min: v(0, 0, 0), max: v(0, 0, 0) };
    this.items = items;
    if (items.length > 8) {
      const ext = sub(this.box.max, this.box.min),
        axis =
          ext.x >= ext.y && ext.x >= ext.z ? "x" : ext.y >= ext.z ? "y" : "z";
      const sorted = [...items].sort(
        (a, b) =>
          a.box.min[axis] +
          a.box.max[axis] -
          (b.box.min[axis] + b.box.max[axis]),
      );
      const mid = Math.floor(sorted.length / 2);
      this.left = new SurfaceIndex(sorted.slice(0, mid));
      this.right = new SurfaceIndex(sorted.slice(mid));
      this.items = [];
    }
  }
  query(a: Vec, b: Vec, result: AcousticSurface[] = []) {
    if (!intersectsBox(a, b, this.box)) return result;
    if (this.left) {
      this.left.query(a, b, result);
      this.right!.query(a, b, result);
    } else
      for (const s of this.items)
        if (intersectsBox(a, b, s.box)) result.push(s);
    return result;
  }
}
