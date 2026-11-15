import {
  A_WEIGHTING,
  OCTAVES,
  PointSoundSource,
  DEFAULT_OPTIONS,
  decibels,
  energy,
  type SourceData,
  type SolverOptions,
} from "./domain.ts";
import { GeometricAcousticSolver } from "./solver.ts";
import { pointInPolygon } from "./geometry.ts";
import type { FieldResult } from "../field.ts";
export type GridRequest = {
  bounds: { minX: number; minZ: number; spanX: number; spanZ: number };
  width: number;
  height: number;
  receiverHeightM: number;
  floorId: string;
  sources: SourceData[];
  options: Partial<SolverOptions>;
};
export type SpectralField = FieldResult & {
  bandDb: Float32Array;
  directDb: Float32Array;
  reflectedDb: Float32Array;
  diffractedDb: Float32Array;
  pathCounts: { direct: number; reflected: number; diffracted: number };
};
export type DisplayBand = "total" | "A" | number;
export function displayField(
  field: SpectralField,
  band: DisplayBand,
  component: "total" | "direct" | "reflected" | "diffracted" = "total",
): SpectralField {
  const values =
    component === "direct"
      ? field.directDb
      : component === "reflected"
        ? field.reflectedDb
        : component === "diffracted"
          ? field.diffractedDb
          : field.bandDb;
  const db = new Float32Array(field.db.length);
  for (let i = 0; i < db.length; i++) {
    if (!field.mask[i]) {
      db[i] = -120;
      continue;
    }
    db[i] =
      typeof band === "number"
        ? values[i * 8 + band]
        : decibels(
            OCTAVES.reduce(
              (sum, _, b) =>
                sum +
                energy(values[i * 8 + b] + (band === "A" ? A_WEIGHTING[b] : 0)),
              0,
            ),
          );
  }
  return { ...field, db };
}
/** Chunked grid jobs share a prepared scene/BVH, support bounded spatial tiles,
 * yield for cancellation, and transfer typed buffers to a renderer or backend. */
export class AcousticGridJob {
  readonly solver: GeometricAcousticSolver;
  readonly request: GridRequest;
  readonly field: SpectralField;
  readonly sources: PointSoundSource[];
  readonly started = performance.now();
  row = 0;
  constructor(solver: GeometricAcousticSolver, request: GridRequest) {
    this.solver = solver;
    this.request = request;
    const { width, height, bounds } = request;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > 262144
    )
      throw new Error("Tile must contain 1–262144 receiver cells");
    if (
      !Object.values(bounds).every(Number.isFinite) ||
      bounds.spanX <= 0 ||
      bounds.spanZ <= 0 ||
      !Number.isFinite(request.receiverHeightM) ||
      request.receiverHeightM <= 0
    )
      throw new Error("Invalid receiver grid");
    const n = width * height;
    this.field = {
      width,
      height,
      ...bounds,
      real: new Float32Array(n),
      imaginary: new Float32Array(n),
      mask: new Uint8Array(n),
      db: new Float32Array(n).fill(-120),
      bandDb: new Float32Array(n * 8).fill(-120),
      directDb: new Float32Array(n * 8).fill(-120),
      reflectedDb: new Float32Array(n * 8).fill(-120),
      diffractedDb: new Float32Array(n * 8).fill(-120),
      source: { x: 0, z: 0 },
      elapsedMs: 0,
      cells: 0,
      pathCounts: { direct: 0, reflected: 0, diffracted: 0 },
    };
    this.sources = request.sources
      .filter((s) => s.enabled)
      .map((s) => new PointSoundSource(s));
  }
  step(rows = 2) {
    const f = this.field,
      q = this.request,
      regions = this.solver.scene.data.regions.filter(
        (r) => r.floorId === q.floorId,
      ),
      end = Math.min(q.height, this.row + rows);
    for (; this.row < end; this.row++)
      for (let i = 0; i < q.width; i++) {
        const idx = this.row * q.width + i,
          x = q.bounds.minX + ((i + 0.5) / q.width) * q.bounds.spanX,
          z = q.bounds.minZ + ((this.row + 0.5) / q.height) * q.bounds.spanZ;
        const region = regions.find(
          (r) =>
            pointInPolygon(x, z, r.polygon) &&
            !r.holes.some((h) => pointInPolygon(x, z, h)),
        );
        if (!region || q.receiverHeightM >= region.heightM) continue;
        const result = this.solver.evaluatePrepared(
          { x, y: region.polygon[0].y + q.receiverHeightM, z },
          this.sources,
          { ...DEFAULT_OPTIONS, ...q.options },
        );
        f.mask[idx] = 1;
        f.cells++;
        for (let b = 0; b < 8; b++) {
          f.bandDb[idx * 8 + b] = decibels(result.total[b]);
          f.directDb[idx * 8 + b] = decibels(result.direct[b]);
          f.reflectedDb[idx * 8 + b] = decibels(result.reflected[b]);
          f.diffractedDb[idx * 8 + b] = decibels(result.diffracted[b]);
        }
        f.db[idx] = decibels(result.total.reduce((a, b) => a + b, 0));
        for (const kind of ["direct", "reflected", "diffracted"] as const)
          f.pathCounts[kind] += result.pathCounts[kind];
      }
    f.elapsedMs = performance.now() - this.started;
    return this.row === q.height;
  }
}
