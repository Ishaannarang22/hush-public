/** Versioned, JSON-safe contracts. All coordinates and dimensions are metres,
 * right-handed local x/y/z with y up. No geographic degrees enter the solver. */
export const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000] as const;
export const A_WEIGHTING = [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1, -1.1] as const;
export type Vec = { x: number; y: number; z: number };
export type Evidence = {
  kind: "measured" | "assumed" | "derived";
  source: string;
  note?: string;
};
export type MaterialData = {
  id: string;
  name: string;
  absorption: number[];
  transmissionLossDb: number[];
  evidence: Evidence;
};
export type OpeningData = {
  id: string;
  kind: "window" | "door" | "opening";
  centerM: number;
  widthM: number;
  bottomM: number;
  heightM: number;
  state: "open" | "closed";
  materialId: string;
  evidence: Evidence;
};
export type WallData = {
  kind: "wall";
  id: string;
  a: Vec;
  b: Vec;
  heightM: number;
  thicknessM: number;
  materialId: string;
  openings: OpeningData[];
  evidence: Evidence;
};
export type FloorData = {
  kind: "floor" | "ceiling";
  id: string;
  polygon: Vec[];
  holes?: Vec[][];
  materialId: string;
  evidence: Evidence;
};
export type SurfaceData = WallData | FloorData;
export type RegionData = {
  id: string;
  floorId: string;
  polygon: Vec[];
  holes: Vec[][];
  heightM: number;
  evidence: Evidence;
};
export type SceneData = {
  schemaVersion: 1;
  id: string;
  coordinateSystem: "local-meters-y-up";
  materials: MaterialData[];
  surfaces: SurfaceData[];
  regions: RegionData[];
  assumptions: string[];
};
export type SourceData = {
  id: string;
  position: Vec;
  spectrumDbAt1m: number[];
  enabled: boolean;
  evidence: Evidence;
};
export type SolverOptions = {
  reflections: boolean;
  diffraction: boolean;
  soundSpeed: number;
  maxPathLengthM: number;
};
export const DEFAULT_OPTIONS: SolverOptions = {
  reflections: true,
  diffraction: true,
  soundSpeed: 343,
  maxPathLengthM: Infinity,
};
export const v = (x: number, y: number, z: number): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec, b: Vec) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec, k: number) => v(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec, b: Vec) => length(sub(a, b));
export const unit = (a: Vec) => scale(a, 1 / length(a));
export const cross = (a: Vec, b: Vec) =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const energy = (db: number) => 10 ** (db / 10);
export const decibels = (e: number) => 10 * Math.log10(Math.max(1e-12, e));
export function finite(n: number, label: string) {
  if (!Number.isFinite(n)) throw new Error(`${label} must be finite`);
  return n;
}
export function validVec(p: Vec, label = "Position") {
  if (!p) throw new Error(`${label} missing`);
  finite(p.x, label);
  finite(p.y, label);
  finite(p.z, label);
}
export class OctaveSpectrum {
  readonly values: ReadonlyArray<number>;
  constructor(values: number[]) {
    if (!Array.isArray(values) || values.length !== OCTAVES.length)
      throw new Error(
        "Exactly eight octave-band values (63–8000 Hz) are required",
      );
    values.forEach((n) => finite(n, "Band value"));
    this.values = Object.freeze([...values]);
  }
  totalDb(aWeighted = false) {
    return decibels(
      this.values.reduce(
        (sum, db, i) => sum + energy(db + (aWeighted ? A_WEIGHTING[i] : 0)),
        0,
      ),
    );
  }
  static normalized(totalDb: number, shapeDb: number[]) {
    const shape = new OctaveSpectrum(shapeDb),
      offset = totalDb - shape.totalDb();
    return new OctaveSpectrum(shape.values.map((x) => x + offset));
  }
}
export class AcousticMaterial {
  readonly data: MaterialData;
  readonly transmission: number[];
  readonly reflection: number[];
  constructor(data: MaterialData) {
    new OctaveSpectrum(data.absorption);
    new OctaveSpectrum(data.transmissionLossDb);
    this.data = data;
    this.transmission = data.transmissionLossDb.map((tl, i) => {
      const a = data.absorption[i];
      if (a < 0 || a > 1 || tl < 0)
        throw new Error(`Invalid material coefficients: ${data.id}`);
      const t = energy(-tl);
      if (a + t > 1 + 1e-8)
        throw new Error(
          `Absorbed + transmitted energy exceeds one: ${data.id}`,
        );
      return t;
    });
    this.reflection = this.transmission.map((t, i) =>
      Math.max(0, 1 - data.absorption[i] - t),
    );
  }
}
export class PointSoundSource {
  readonly data: SourceData;
  readonly bandEnergy: number[];
  constructor(data: SourceData) {
    validVec(data.position);
    const s = new OctaveSpectrum(data.spectrumDbAt1m);
    this.data = data;
    this.bandEnergy = s.values.map(energy);
  }
}
