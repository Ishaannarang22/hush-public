import {
  DEFAULT_OPTIONS,
  PointSoundSource,
  decibels,
  type Vec,
  type SolverOptions,
} from "./domain.ts";
import {
  AcousticGridJob,
  type GridRequest,
  type SpectralField,
} from "./grid.ts";
import { pointInPolygon } from "./geometry.ts";
import { GeometricAcousticSolver } from "./solver.ts";

const kinds = ["direct", "reflected", "diffracted"] as const;
type Kind = (typeof kinds)[number];
type Basis = Record<Kind, Float64Array> & { counts: Record<Kind, number> };
type ReceiverGrid = { key: string; points: (Vec | null)[] };
const gridKey = (q: GridRequest) =>
  JSON.stringify([q.bounds, q.width, q.height, q.floorId, q.receiverHeightM]);
const transferKey = (key: string, position: Vec, options: SolverOptions) =>
  JSON.stringify([
    key,
    position,
    options.reflections,
    options.diffraction,
    options.soundSpeed,
    options.maxPathLengthM,
  ]);

/** The path solver is linear in source energy. Cache unit-energy transfer per
 * source position, keeping raw energy (including exact zeros), never clipped dB.
 * A cache belongs to one immutable scene and is replaced when that scene changes. */
export class AcousticTransferCache {
  readonly solver: GeometricAcousticSolver;
  readonly maxBytes: number;
  private entries = new Map<string, Basis>();
  private receiverGrid: ReceiverGrid | null = null;
  bytes = 0;
  constructor(solver: GeometricAcousticSolver, maxBytes = 32 * 1024 * 1024) {
    this.solver = solver;
    this.maxBytes = maxBytes;
  }
  get(key: string) {
    const value = this.entries.get(key);
    if (value) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }
  put(key: string, value: Basis) {
    const bytes =
      value.direct.byteLength +
      value.reflected.byteLength +
      value.diffracted.byteLength;
    if (bytes > this.maxBytes || this.entries.has(key)) return;
    while (this.bytes + bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value!;
      const old = this.entries.get(oldest)!;
      this.bytes -=
        old.direct.byteLength +
        old.reflected.byteLength +
        old.diffracted.byteLength;
      this.entries.delete(oldest);
    }
    this.entries.set(key, value);
    this.bytes += bytes;
  }
  canReuse(q: GridRequest) {
    const key = gridKey(q),
      options = { ...DEFAULT_OPTIONS, ...q.options };
    return q.sources
      .filter((s) => s.enabled)
      .every((s) => this.entries.has(transferKey(key, s.position, options)));
  }
  receivers(q: GridRequest): ReceiverGrid {
    const key = gridKey(q);
    if (this.receiverGrid?.key === key) return this.receiverGrid;
    const regions = this.solver.scene.data.regions.filter(
      (r) => r.floorId === q.floorId,
    );
    const points = Array.from({ length: q.width * q.height }, (_, i) => {
      const x =
        q.bounds.minX + (((i % q.width) + 0.5) / q.width) * q.bounds.spanX;
      const z =
        q.bounds.minZ +
        ((Math.floor(i / q.width) + 0.5) / q.height) * q.bounds.spanZ;
      const region = regions.find(
        (r) =>
          pointInPolygon(x, z, r.polygon) &&
          !r.holes.some((h) => pointInPolygon(x, z, h)),
      );
      return region && q.receiverHeightM < region.heightM
        ? { x, y: region.polygon[0].y + q.receiverHeightM, z }
        : null;
    });
    return (this.receiverGrid = { key, points });
  }
  job(request: GridRequest) {
    return new CachedAcousticGridJob(this, request);
  }
}

export class CachedAcousticGridJob {
  readonly field: SpectralField;
  readonly cache: AcousticTransferCache;
  readonly options: SolverOptions;
  readonly sources: PointSoundSource[];
  readonly grid: ReceiverGrid;
  readonly stats = { cacheHits: 0, computedSources: 0, evaluatedReceivers: 0 };
  private started = performance.now();
  private basis: Basis[] = [];
  private sourceIndex = 0;
  private cell = 0;
  private current: Basis | null = null;
  private key = "";
  private unitSource: PointSoundSource[] = [];
  private finished = false;
  constructor(cache: AcousticTransferCache, request: GridRequest) {
    this.cache = cache;
    // Reuse validation and output contracts with the uncached batch solver.
    const job = new AcousticGridJob(cache.solver, request);
    this.field = job.field;
    this.sources = job.sources;
    this.options = { ...DEFAULT_OPTIONS, ...request.options };
    if (
      !Number.isFinite(this.options.soundSpeed) ||
      this.options.soundSpeed <= 0 ||
      !(this.options.maxPathLengthM > 0)
    )
      throw new Error("Invalid propagation options");
    this.grid = cache.receivers(request);
  }
  get progress() {
    return this.finished
      ? 1
      : (this.sourceIndex + this.cell / this.grid.points.length) /
          Math.max(1, this.sources.length);
  }
  step(maxReceivers = 24) {
    if (this.finished) return true;
    let work = 0;
    while (this.sourceIndex < this.sources.length) {
      const source = this.sources[this.sourceIndex];
      if (!this.current) {
        this.key = transferKey(
          this.grid.key,
          source.data.position,
          this.options,
        );
        const hit = this.cache.get(this.key);
        if (hit) {
          this.basis.push(hit);
          this.sourceIndex++;
          this.stats.cacheHits++;
          continue;
        }
        const n = this.grid.points.length * 8;
        this.current = {
          direct: new Float64Array(n),
          reflected: new Float64Array(n),
          diffracted: new Float64Array(n),
          counts: { direct: 0, reflected: 0, diffracted: 0 },
        };
        this.unitSource = [
          new PointSoundSource({
            ...source.data,
            spectrumDbAt1m: Array(8).fill(0),
          }),
        ];
        this.cell = 0;
        this.stats.computedSources++;
      }
      while (this.cell < this.grid.points.length) {
        const i = this.cell,
          receiver = this.grid.points[i];
        if (receiver) {
          if (work >= maxReceivers) return false;
          const result = this.cache.solver.evaluatePrepared(
            receiver,
            this.unitSource,
            this.options,
          );
          for (const kind of kinds) {
            this.current[kind].set(result[kind], i * 8);
            this.current.counts[kind] += result.pathCounts[kind];
          }
          this.stats.evaluatedReceivers++;
          work++;
        }
        this.cell++;
      }
      // Partial work is never stored; cancellation cannot poison the cache.
      this.cache.put(this.key, this.current);
      this.basis.push(this.current);
      this.current = null;
      this.cell = 0;
      this.sourceIndex++;
    }
    const f = this.field;
    for (let i = 0; i < this.grid.points.length; i++) {
      if (!this.grid.points[i]) continue;
      f.mask[i] = 1;
      f.cells++;
      let overall = 0;
      for (let b = 0; b < 8; b++) {
        let total = 0;
        for (const kind of kinds) {
          let sum = 0;
          for (let s = 0; s < this.sources.length; s++)
            sum +=
              this.basis[s][kind][i * 8 + b] * this.sources[s].bandEnergy[b];
          f[`${kind}Db`][i * 8 + b] = decibels(sum);
          total += sum;
        }
        f.bandDb[i * 8 + b] = decibels(total);
        overall += total;
      }
      f.db[i] = decibels(overall);
    }
    for (const basis of this.basis)
      for (const kind of kinds) f.pathCounts[kind] += basis.counts[kind];
    f.elapsedMs = performance.now() - this.started;
    return (this.finished = true);
  }
}

/** Lower spatial sampling only: the propagation physics and all eight bands stay
 * identical. Detailed receiver locations are recalculated after input settles. */
export function previewRequest(q: GridRequest, longestEdge = 12): GridRequest {
  const ratio = Math.min(1, longestEdge / Math.max(q.width, q.height));
  return {
    ...q,
    width: Math.max(1, Math.round(q.width * ratio)),
    height: Math.max(1, Math.round(q.height * ratio)),
  };
}
