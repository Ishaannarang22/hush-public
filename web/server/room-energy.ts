import {
  A_WEIGHTING,
  OCTAVES,
  AcousticMaterial,
  energy,
  decibels,
  type SceneData,
  type WallData,
} from "../src/acoustics/engine/domain.ts";

const polygonArea = (p: { x: number; z: number }[]) =>
  Math.abs(
    p.reduce((s, v, i) => {
      const w = p[(i + 1) % p.length];
      return s + v.x * w.z - w.x * v.z;
    }, 0),
  ) / 2;
export function solvePositiveSystem(matrix: number[][], rhs: number[]) {
  const a = matrix.map((row, i) => [...row, rhs[i]]),
    n = rhs.length;
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++)
      if (Math.abs(a[i][k]) > Math.abs(a[pivot][k])) pivot = i;
    if (Math.abs(a[pivot][k]) < 1e-12)
      throw new Error(
        "Room energy balance is singular; provide absorbing or transmitting surfaces.",
      );
    [a[k], a[pivot]] = [a[pivot], a[k]];
    for (let i = k + 1; i < n; i++) {
      const scale = a[i][k] / a[k][k];
      for (let j = k; j <= n; j++) a[i][j] -= scale * a[k][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] =
      (a[i][n] -
        a[i].slice(i + 1, n).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) /
      a[i][i];
    if (x[i] < -1e-6) throw new Error("Invalid negative room energy");
    x[i] = Math.max(0, x[i]);
  }
  return x;
}
const SOURCE_SHAPES: Record<string, number[]> = {
  road: [0, 0, -2, -4, -7, -10, -14, -20],
  construction: [-5, -3, 0, 0, -2, -5, -8, -12],
  mechanical: [0, -1, -4, -7, -11, -16, -22, -28],
};
/** Broadband emissions -> assumed band shapes, normalized without changing dBA. */
export function bandEnergies(
  level: number,
  mode: string,
  shapes = SOURCE_SHAPES,
) {
  const shape = shapes[mode] ?? SOURCE_SHAPES.road;
  const weighted = shape.reduce((s, v, i) => s + energy(v + A_WEIGHTING[i]), 0);
  return shape.map((v) => (energy(level) * energy(v)) / weighted);
}
export type EnergyProperty = {
  rooms: { id: string; name?: string; exterior_walls: { id: string }[] }[];
  partitions: {
    room_a: string;
    room_b: string;
    edge_id?: string;
    kind?: string;
    area_m2: number;
  }[];
};
export type OutdoorWall = {
  wall: string;
  blocks: Record<string, { by_source: Record<string, number | null> }>;
};
/** Diffuse steady-state balance by octave: (A + outgoing transmission) E - P E_neighbor = F.
 * Aperture area transmits with tau=1 when open. No fixed open-window dB shortcut.
 * This room mean is an alternative prediction, never added to ray-path energies. */
export class RoomEnergyModel {
  readonly scene: SceneData;
  constructor(scene: SceneData) {
    this.scene = scene;
  }
  run(
    property: EnergyProperty,
    apiRooms: {
      id: string;
      boundary?: { edges: { id?: string }[] };
      holes?: { edges: { id?: string }[] }[];
    }[],
    outdoor: OutdoorWall[],
    blocks: string[],
    incidenceDb = 3,
    sourceShapes = SOURCE_SHAPES,
  ) {
    const rooms = this.scene.regions,
      n = rooms.length,
      index = new Map(rooms.map((r, i) => [r.id, i]));
    const materials = new Map(
      this.scene.materials.map((m) => [m.id, new AcousticMaterial(m)]),
    );
    const walls = new Map(
      this.scene.surfaces
        .filter((s) => s.kind === "wall")
        .map((w) => [w.id, w as WallData]),
    );
    const wallIds = new Map(
      apiRooms.map((r) => [
        r.id,
        new Set(
          [
            ...(r.boundary?.edges ?? []),
            ...(r.holes ?? []).flatMap((h) => h.edges),
          ].map((e) => e.id),
        ),
      ]),
    );
    const area = (w: WallData) =>
      Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) * w.heightM;
    for (const wall of walls.values()) {
      const os = wall.openings;
      if (
        os.reduce((sum, o) => sum + o.widthM * o.heightM, 0) >
        area(wall) + 0.05
      )
        throw new Error(`Excess opening area on wall ${wall.id}`);
      for (let i = 0; i < os.length; i++)
        for (let j = i + 1; j < os.length; j++) {
          const a = os[i],
            b = os[j];
          const horizontal =
            Math.min(a.centerM + a.widthM / 2, b.centerM + b.widthM / 2) -
            Math.max(a.centerM - a.widthM / 2, b.centerM - b.widthM / 2);
          const vertical =
            Math.min(a.bottomM + a.heightM, b.bottomM + b.heightM) -
            Math.max(a.bottomM, b.bottomM);
          if (horizontal > 1e-6 && vertical > 1e-6)
            throw new Error(`Overlapping openings ${a.id} and ${b.id}`);
        }
    }
    const patch = (w: WallData, bottom: number, top: number) => {
      const lo = Math.max(w.a.y, bottom),
        hi = Math.min(w.a.y + w.heightM, top);
      const total =
        Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) * Math.max(0, hi - lo);
      const openings = w.openings.map((o) => ({
        o,
        area:
          o.widthM *
          Math.max(
            0,
            Math.min(hi, o.bottomM + o.heightM) - Math.max(lo, o.bottomM),
          ),
      }));
      return {
        opaque: Math.max(
          0,
          total - openings.reduce((sum, p) => sum + p.area, 0),
        ),
        openings,
      };
    };
    const transmission = (
      w: WallData,
      b: number,
      bottom: number,
      top: number,
    ) => {
      const p = patch(w, bottom, top);
      return (
        p.opaque * materials.get(w.materialId)!.transmission[b] +
        p.openings.reduce(
          (s, { o, area }) =>
            s +
            area *
              (o.state === "open"
                ? 1
                : materials.get(o.materialId)!.transmission[b]),
          0,
        )
      );
    };
    const all: Record<string, Record<string, number[]>> = {};
    for (const block of blocks)
      all[block] = Object.fromEntries(
        rooms.map((r) => [r.id, Array(8).fill(0)]),
      );
    for (let band = 0; band < 8; band++) {
      const matrix = Array.from({ length: n }, () => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        const r = rooms[i];
        let absorption = 0;
        for (const s of this.scene.surfaces) {
          if (s.kind === "wall") continue;
          if (s.id !== `floor:${r.id}` && s.id !== `ceiling:${r.id}`) continue;
          absorption +=
            (polygonArea(s.polygon) -
              (s.holes ?? []).reduce((a, h) => a + polygonArea(h), 0)) *
            materials.get(s.materialId)!.data.absorption[band];
        }
        for (const wid of wallIds.get(r.id) ?? []) {
          const wall = walls.get(wid!);
          if (!wall) continue;
          const p = patch(wall, r.polygon[0].y, r.polygon[0].y + r.heightM);
          absorption +=
            p.opaque * materials.get(wall.materialId)!.data.absorption[band];
          absorption += p.openings.reduce(
            (s, { o, area }) =>
              s +
              area *
                (o.state === "open"
                  ? 0
                  : materials.get(o.materialId)!.data.absorption[band]),
            0,
          );
        }
        matrix[i][i] = absorption;
      }
      const coupled = new Set<string>();
      for (const p of property.partitions ?? []) {
        const i = index.get(p.room_a),
          j = index.get(p.room_b);
        if (i === undefined || j === undefined || i === j) continue;
        const key = [
          Math.min(i, j),
          Math.max(i, j),
          p.edge_id ?? `${p.kind}:${p.area_m2}`,
        ].join(":");
        if (coupled.has(key)) continue;
        coupled.add(key);
        const wall = walls.get(p.edge_id ?? "");
        const value = wall
          ? transmission(
              wall,
              band,
              Math.max(rooms[i].polygon[0].y, rooms[j].polygon[0].y),
              Math.min(
                rooms[i].polygon[0].y + rooms[i].heightM,
                rooms[j].polygon[0].y + rooms[j].heightM,
              ),
            )
          : p.kind === "opening"
            ? p.area_m2
            : 0;
        matrix[i][i] += value;
        matrix[j][j] += value;
        matrix[i][j] -= value;
        matrix[j][i] -= value;
      }
      const boundary: { i: number; wallId: string; area: number }[] = [];
      for (const r of property.rooms) {
        const i = index.get(r.id);
        if (i === undefined) continue;
        for (const w of r.exterior_walls) {
          const wall = walls.get(w.id);
          if (!wall) continue;
          const t = transmission(
            wall,
            band,
            rooms[i].polygon[0].y,
            rooms[i].polygon[0].y + rooms[i].heightM,
          );
          matrix[i][i] += t;
          boundary.push({ i, wallId: w.id, area: t });
        }
      }
      for (const block of blocks) {
        const rhs = Array(n).fill(0);
        for (const w of boundary) {
          const levels =
            outdoor.find((row) => row.wall === w.wallId)?.blocks[block]
              ?.by_source ?? {};
          for (const [mode, level] of Object.entries(levels)) {
            if (level != null)
              rhs[w.i] +=
                bandEnergies(level, mode, sourceShapes)[band] *
                w.area *
                energy(incidenceDb);
          }
        }
        const answer = solvePositiveSystem(matrix, rhs);
        rooms.forEach((r, i) => {
          all[block][r.id][band] = answer[i];
        });
      }
    }
    return {
      schemaVersion: 1,
      modelId: this.scene.id,
      weighting: "A",
      units: "dBA",
      method: "octave room energy balance",
      rooms: Object.fromEntries(
        rooms.map((r) => [
          r.id,
          {
            name: property.rooms.find((p) => p.id === r.id)?.name ?? r.id,
            blocks: Object.fromEntries(
              blocks.map((block) => {
                const bands = all[block][r.id];
                const total = bands.reduce(
                  (s, e, b) => s + e * energy(A_WEIGHTING[b]),
                  0,
                );
                return [
                  block,
                  {
                    dba: total > 0 ? decibels(total) : null,
                    bandDb: bands.map((e) => (e > 0 ? decibels(e) : null)),
                    range_dba: null,
                  },
                ];
              }),
            ),
          },
        ]),
      ),
      assumptions: [
        "Diffuse steady-state room energy, not pressure interference or a reverberation time simulation.",
        "Per-band material spectra and source shapes are assumed unless replaced.",
        "No seal leakage, flanking transmission, or roof aircraft path is added without corresponding geometry.",
        "Unclassified apartment boundaries absorb sound but do not inject external or neighboring-unit noise.",
        "Diffuse-field assumptions are weakest at low frequencies and in small, non-diffuse rooms.",
        "Room mean and ray-grid predictions are alternatives; their energies are not summed.",
      ],
      octaves: OCTAVES,
    };
  }
}
