import {
  OCTAVES,
  AcousticMaterial,
  PointSoundSource,
  DEFAULT_OPTIONS,
  add,
  sub,
  scale,
  dot,
  cross,
  unit,
  distance,
  energy,
  v,
  validVec,
  type Vec,
  type SceneData,
  type SolverOptions,
  type SourceData,
} from "./domain.ts";
import {
  Wall,
  Floor,
  SurfaceIndex,
  type AcousticSurface,
  type DiffractionEdge,
  type Hit,
} from "./geometry.ts";
export type ReceiverResult = {
  direct: Float64Array;
  reflected: Float64Array;
  diffracted: Float64Array;
  total: Float64Array;
  pathCounts: { direct: number; reflected: number; diffracted: number };
};
export type PropagationPath = {
  sourceId: string;
  kind: "direct" | "reflected" | "diffracted";
  points: Vec[];
  lengthM: number;
  bandEnergy: number[];
};
export interface PropagationSolver {
  evaluate(
    receiver: Vec,
    sources: SourceData[],
    options?: Partial<SolverOptions>,
  ): ReceiverResult;
}
export class AcousticScene {
  readonly data: SceneData;
  readonly surfaces: AcousticSurface[];
  readonly index: SurfaceIndex;
  readonly edges: DiffractionEdge[];
  constructor(data: SceneData) {
    if (
      data.schemaVersion !== 1 ||
      data.coordinateSystem !== "local-meters-y-up"
    )
      throw new Error("Unsupported acoustic scene version or coordinates");
    this.data = data;
    const materials = new Map(
      data.materials.map((m) => [m.id, new AcousticMaterial(m)]),
    );
    if (materials.size !== data.materials.length)
      throw new Error("Duplicate material id");
    const ids = new Set<string>();
    this.surfaces = data.surfaces.map((s) => {
      if (ids.has(s.id)) throw new Error(`Duplicate surface id: ${s.id}`);
      ids.add(s.id);
      if (s.kind === "wall") return new Wall(s, materials);
      if (s.kind === "floor" || s.kind === "ceiling")
        return new Floor(s, materials);
      throw new Error("Unsupported surface kind");
    });
    this.index = new SurfaceIndex(this.surfaces);
    const keys = new Set<string>();
    this.edges = this.surfaces
      .flatMap((s) => s.edges())
      .filter((e) => {
        const key = [e.a, e.b]
          .map((p) => [p.x, p.y, p.z].map((n) => n.toFixed(4)).join(","))
          .sort()
          .join("|");
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      });
    for (const r of data.regions) {
      if (r.polygon.length < 3 || !Number.isFinite(r.heightM) || r.heightM <= 0)
        throw new Error(`Invalid region ${r.id}`);
      r.polygon.forEach((p) => validVec(p));
      r.holes.flat().forEach((p) => validVec(p));
    }
  }
  trace(a: Vec, b: Vec): Hit[] {
    return this.index
      .query(a, b)
      .flatMap((s) => {
        const h = s.intersect(a, b);
        return h ? [h] : [];
      })
      .sort((a, b) => a.t - b.t);
  }
  transmission(a: Vec, b: Vec) {
    const factors = new Float64Array(8).fill(1);
    let last: Hit | undefined;
    for (const hit of this.trace(a, b)) {
      if (!hit.material) continue;
      // Coincident surface records represent a single interface. Distinct wall
      // faces farther than 1 mm remain separate, rather than silently merging walls.
      if (last && distance(last.point, hit.point) < 0.001) continue;
      for (let i = 0; i < 8; i++) factors[i] *= hit.material.transmission[i];
      last = hit;
    }
    return factors;
  }
  inAir(p: Vec) {
    const e = v(0.002, 0.002, 0.002);
    return !this.index
      .query(sub(p, e), add(p, e))
      .some(
        (s) =>
          Math.abs(dot(sub(p, s.origin), s.normal)) < 0.002 &&
          s.contains(p) &&
          s.materialAt(p).material,
      );
  }
  clear(a: Vec, b: Vec) {
    return !this.index.query(a, b).some((s) => s.intersect(a, b)?.material);
  }
}
/** Maekawa–Tatge single thin-screen approximation in the geometric shadow.
 * N=2 delta/lambda, D=10 log10(3+20N). Not a UTD or full-wave solution. */
export function diffractionLossDb(
  pathDifferenceM: number,
  frequencyHz: number,
  soundSpeed = 343,
) {
  return (
    10 *
    Math.log10(
      3 + (40 * frequencyHz * Math.max(0, pathDifferenceM)) / soundSpeed,
    )
  );
}
export function shortestEdgePoint(s: Vec, r: Vec, e: DiffractionEdge) {
  const length = distance(e.a, e.b),
    u = scale(sub(e.b, e.a), 1 / length),
    ts = dot(sub(s, e.a), u),
    tr = dot(sub(r, e.a), u),
    ds = distance(s, add(e.a, scale(u, ts))),
    dr = distance(r, add(e.a, scale(u, tr))),
    t = Math.max(
      0,
      Math.min(length, (ts * dr + tr * ds) / Math.max(1e-9, ds + dr)),
    );
  return add(e.a, scale(u, t));
}
/** 3D octave-band energy paths. Geometry is prepared once and reused by every
 * receiver/tile. New engines implement PropagationSolver without changing data. */
export class GeometricAcousticSolver implements PropagationSolver {
  readonly scene: AcousticScene;
  constructor(scene: AcousticScene) {
    this.scene = scene;
  }
  evaluate(
    receiver: Vec,
    sourceData: SourceData[],
    options: Partial<SolverOptions> = {},
  ): ReceiverResult {
    return this.evaluatePrepared(
      receiver,
      sourceData.filter((s) => s.enabled).map((s) => new PointSoundSource(s)),
      { ...DEFAULT_OPTIONS, ...options },
    );
  }
  tracePaths(receiver: Vec, sources: SourceData[], options: Partial<SolverOptions> = {}) {
    const paths: PropagationPath[] = [];
    const result = this.evaluatePrepared(receiver,
      sources.filter(s => s.enabled).map(s => new PointSoundSource(s)),
      { ...DEFAULT_OPTIONS, ...options }, path => paths.push(path));
    return { result, paths };
  }
  evaluatePrepared(
    receiver: Vec,
    sources: PointSoundSource[],
    options: SolverOptions,
    onPath?: (path: PropagationPath) => void,
  ): ReceiverResult {
    validVec(receiver);
    if (
      !(options.soundSpeed > 0) ||
      !Number.isFinite(options.soundSpeed) ||
      !(options.maxPathLengthM > 0)
    )
      throw new Error("Invalid propagation options");
    const direct = new Float64Array(8),
      reflected = new Float64Array(8),
      diffracted = new Float64Array(8),
      total = new Float64Array(8),
      pathCounts = { direct: 0, reflected: 0, diffracted: 0 };
    for (const source of sources) {
      const s = source.data.position,
        d = distance(s, receiver);
      if (d > options.maxPathLengthM) continue;
      const transmission = this.scene.transmission(s, receiver),
        spread = 1 / Math.max(1, d) ** 2;
      for (let b = 0; b < 8; b++)
        direct[b] += source.bandEnergy[b] * spread * transmission[b];
      pathCounts.direct++;
      onPath?.({sourceId:source.data.id,kind:"direct",points:[s,receiver],lengthM:d,
        bandEnergy:source.bandEnergy.map((e,b)=>e*spread*transmission[b])});
      if (options.reflections)
        for (const surface of this.scene.surfaces) {
          if (
            dot(sub(s, surface.origin), surface.normal) *
              dot(sub(receiver, surface.origin), surface.normal) <=
            1e-8
          )
            continue;
          const image = surface.mirror(s),
            hit = surface.intersect(image, receiver);
          if (!hit?.material) continue;
          const pathLength =
            distance(s, hit.point) + distance(hit.point, receiver);
          if (pathLength > options.maxPathLengthM) continue;
          const first = this.scene.transmission(s, hit.point),
            second = this.scene.transmission(hit.point, receiver),
            spreadReflection = 1 / Math.max(1, pathLength) ** 2;
          for (let b = 0; b < 8; b++)
            reflected[b] +=
              source.bandEnergy[b] *
              spreadReflection *
              first[b] *
              second[b] *
              hit.material.reflection[b];
          pathCounts.reflected++;
          onPath?.({sourceId:source.data.id,kind:"reflected",points:[s,hit.point,receiver],lengthM:pathLength,
            bandEnergy:source.bandEnergy.map((e,b)=>e*spreadReflection*first[b]*second[b]*hit.material!.reflection[b])});
        }
      if (options.diffraction && transmission.some((t) => t < 0.999)) {
        // Keep the shortest viable single-edge route. Summing a full screen-loss
        // estimate for every edge would double-count the same diffracted field.
        let shortest = Infinity;
        let diffractionPoint: Vec | undefined;
        for (const edge of this.scene.edges) {
          const p = shortestEdgePoint(s, receiver, edge),
            path = distance(s, p) + distance(p, receiver);
          if (path >= shortest || path > options.maxPathLengthM) continue;
          if (!this.scene.clear(s, p) || !this.scene.clear(p, receiver))
            continue;
          const axis = unit(sub(edge.b, edge.a)),
            u = unit(
              cross(axis, Math.abs(axis.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0)),
            ),
            w = cross(axis, u);
          // A real air route must exist beside the edge. This prevents rays leaking
          // through sealed wall/ceiling seams or an artificial collinear vertex.
          let viable = false;
          for (let angle = 0; angle < 12 && !viable; angle++) {
            const theta = (angle * Math.PI) / 6,
              offset = add(
                p,
                add(
                  scale(u, 0.012 * Math.cos(theta)),
                  scale(w, 0.012 * Math.sin(theta)),
                ),
              );
            if (
              this.scene.inAir(offset) &&
              this.scene.clear(s, offset) &&
              this.scene.clear(offset, receiver)
            )
              viable = true;
          }
          if (viable) { shortest = path; diffractionPoint = p; }
        }
        if (Number.isFinite(shortest)) {
          for (let b = 0; b < 8; b++)
            diffracted[b] +=
              source.bandEnergy[b] *
              spread *
              (1 - transmission[b]) *
              energy(
                -diffractionLossDb(
                  shortest - d,
                  OCTAVES[b],
                  options.soundSpeed,
                ),
              );
          pathCounts.diffracted++;
          if(diffractionPoint)onPath?.({sourceId:source.data.id,kind:"diffracted",points:[s,diffractionPoint,receiver],lengthM:shortest,
            bandEnergy:source.bandEnergy.map((e,b)=>e*spread*(1-transmission[b])*energy(-diffractionLossDb(shortest-d,OCTAVES[b],options.soundSpeed)))});
        }
      }
    }
    for (let b = 0; b < 8; b++)
      total[b] = direct[b] + reflected[b] + diffracted[b];
    return { direct, reflected, diffracted, total, pathCounts };
  }
}
