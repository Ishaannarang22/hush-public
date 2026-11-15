import { roomPolygon, type ApiRoom, type ApiEdge } from "../matterport.ts";
import { MATERIALS } from "./materials.ts";
import {
  distance,
  type SceneData,
  type WallData,
  type OpeningData,
  type Evidence,
} from "./domain.ts";
import { AcousticScene } from "./solver.ts";
export type ImportOptions = {
  wallMaterial: string;
  floorMaterial: string;
  windowMaterial: string;
  doorsOpen: boolean;
  windowsOpen: boolean;
  assumedHeightM: number;
  floorId: string;
  surfaceMaterials?: Record<string, string>;
};
export type OpeningMeasurement = {
  id: string;
  wallId: string;
  kind: "window" | "door" | "opening";
  centerFraction: number;
  widthM: number;
  heightM: number;
  lowerElevationM: number;
  evidence: Evidence;
  materialId?: string;
  doorType?: string;
  state?: "open" | "closed";
};
export type OpeningDataset = {
  schemaVersion: 1;
  modelId: string;
  units: "meters";
  openings: OpeningMeasurement[];
};
export type ImportedScene = {
  scene: SceneData;
  counts: {
    walls: number;
    windows: number;
    doors: number;
    openings: number;
    assumedHeights: number;
  };
  warnings: string[];
};
const measured = (note: string): Evidence => ({
  kind: "measured",
  source: "Matterport Model API",
  note,
});
function units(value: number | undefined, unit: string | undefined) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error("Invalid Matterport dimension");
  if (unit === "imperial") return value * 0.3048;
  if (unit === "metric") return value;
  throw new Error(`Unknown dimension units: ${unit}`);
}
export function parseOpeningDataset(
  text: string,
  modelId: string,
): OpeningDataset {
  const d = JSON.parse(text) as OpeningDataset;
  if (
    d.schemaVersion !== 1 ||
    d.modelId !== modelId ||
    d.units !== "meters" ||
    !Array.isArray(d.openings)
  )
    throw new Error(
      "Opening file must be version 1, metres, and match this modelId",
    );
  const ids = new Set<string>();
  for (const o of d.openings) {
    if (
      !o.id ||
      !o.wallId ||
      ids.has(o.id) ||
      !["window", "door", "opening"].includes(o.kind)
    )
      throw new Error("Invalid or duplicate opening ID/type");
    ids.add(o.id);
    if (o.materialId && !MATERIALS.some((m) => m.id === o.materialId))
      throw new Error(`Unknown opening material: ${o.materialId}`);
    if (o.state && !["open", "closed"].includes(o.state))
      throw new Error(`Invalid opening state: ${o.id}`);
    if (
      ![o.centerFraction, o.widthM, o.heightM, o.lowerElevationM].every(
        Number.isFinite,
      ) ||
      o.centerFraction < 0 ||
      o.centerFraction > 1 ||
      o.widthM <= 0 ||
      o.heightM <= 0
    )
      throw new Error(`Invalid opening dimensions: ${o.id}`);
    if (
      !o.evidence?.source ||
      !["measured", "assumed", "derived"].includes(o.evidence.kind)
    )
      throw new Error("Opening measurement provenance is required");
  }
  return d;
}
/** Adapter boundary: dimensional API fields are feet/metres as declared;
 * vector edges/openings use metres (Matterport vector-data contract). */
export class MatterportSceneImporter {
  import(
    modelId: string,
    rooms: ApiRoom[],
    options: ImportOptions,
    extra: OpeningMeasurement[] = [],
  ): ImportedScene {
    const warnings: string[] = [],
      walls = new Map<string, WallData>(),
      regions: SceneData["regions"] = [],
      horizontal: SceneData["surfaces"] = [];
    let assumedHeights = 0;
    const filtered = rooms.filter(
      (r) => (r.floor?.id ?? "default") === options.floorId,
    );
    for (const room of filtered) {
      const polygon = roomPolygon(room);
      if (polygon.length < 3) {
        warnings.push(`Room ${room.id}: incomplete boundary, skipped`);
        continue;
      }
      const measuredHeight=units(room.dimensions?.height, room.dimensions?.units);
      const estimatedHeight=units(room.dimensionEstimates?.height, room.dimensionEstimates?.units);
      const usableHeight=(value:number|undefined)=>value!==undefined&&Number.isFinite(value)&&value>0;
      const isAssumed=!usableHeight(measuredHeight)&&!usableHeight(estimatedHeight);
      const height=usableHeight(measuredHeight)?measuredHeight!:usableHeight(estimatedHeight)?estimatedHeight!:options.assumedHeightM;
      const base = units(room.dimensionEstimates?.lowerElevation, room.dimensionEstimates?.units) ?? 0;
      if (isAssumed) {
        assumedHeights++;
        warnings.push(`Room ${room.id}: height assumed ${height} m`);
      }
      const points = polygon.map((p) => ({ x: p.x, y: base, z: p.z })),
        holes = (room.holes ?? [])
          .map((h) => roomPolygon({ id: "hole", boundary: h }))
          .filter((p) => p.length >= 3)
          .map((p) => p.map((v) => ({ x: v.x, y: base, z: v.z })));
      regions.push({
        id: room.id,
        floorId: options.floorId,
        polygon: points,
        holes,
        heightM: height,
        evidence: measured(
          isAssumed
            ? "Plan measured; missing or nonpositive height assumed"
            : "Plan and height from dimensional data",
        ),
      });
      horizontal.push(
        {
          kind: "floor",
          id: `floor:${room.id}`,
          polygon: points,
          holes,
          materialId: options.floorMaterial,
          evidence: measured(
            "Horizontal plane from room elevation; material assumed",
          ),
        },
        {
          kind: "ceiling",
          id: `ceiling:${room.id}`,
          polygon: points.map((p) => ({ ...p, y: base + height })),
          holes: holes.map((h) => h.map((p) => ({ ...p, y: base + height }))),
          materialId: options.wallMaterial,
          evidence: {
            kind: "derived",
            source: "Room height + floor elevation",
            note: "Flat ceiling assumption",
          },
        },
      );
      const edges = [
        ...(room.boundary?.edges ?? []),
        ...(room.holes ?? []).flatMap((h) => h.edges),
      ];
      for (const edge of edges) {
        if (edge.type === "invisible") continue;
        if (edge.vertices.length !== 2) {
          warnings.push(`Invalid edge in room ${room.id}`);
          continue;
        }
        const id = edge.id ?? `${room.id}:edge:${edges.indexOf(edge)}`,
          a = {
            x: edge.vertices[0].position.x,
            y: base,
            z: edge.vertices[0].position.y,
          },
          b = {
            x: edge.vertices[1].position.x,
            y: base,
            z: edge.vertices[1].position.y,
          };
        const existing = walls.get(id);
        if (existing) {
          const top = Math.max(existing.a.y + existing.heightM, base + height),
            bottom = Math.min(existing.a.y, base);
          existing.a.y = bottom;
          existing.b.y = bottom;
          existing.heightM = top - bottom;
          continue;
        }
        const width = distance(a, b),
          openings = this.openings(edge, width, base, options, warnings);
        walls.set(id, {
          kind: "wall",
          id,
          a,
          b,
          heightM: height,
          thicknessM: edge.thickness ?? 0.12,
          materialId: options.surfaceMaterials?.[id] ?? options.wallMaterial,
          openings,
          evidence: measured(
            `Edge geometry; ${edge.thickness === undefined ? "thickness assumed 0.12 m" : "API thickness retained"}; material assumed`,
          ),
        });
      }
    }
    for (const o of extra) {
      const wall = walls.get(o.wallId);
      if (!wall)
        throw new Error(
          `Opening ${o.id} references unknown wall ${o.wallId} on selected floor`,
        );
      const opening: OpeningData = {
        id: o.id,
        kind: o.kind,
        centerM: o.centerFraction * distance(wall.a, wall.b),
        widthM: o.widthM,
        heightM: o.heightM,
        bottomM: o.lowerElevationM,
        state:
          o.state ??
          (o.kind === "opening" ||
          (o.kind === "window" ? options.windowsOpen : options.doorsOpen)
            ? "open"
            : "closed"),
        materialId:
          o.materialId ??
          (o.kind === "window" || o.doorType === "sliding_glass"
            ? options.windowMaterial
            : "door"),
        evidence: o.evidence,
      };
      wall.openings = wall.openings.filter((p) => p.id !== o.id);
      wall.openings.push(opening);
    }
    const openings = [...walls.values()].flatMap((w) => w.openings),
      scene: SceneData = {
        schemaVersion: 1,
        id: modelId,
        coordinateSystem: "local-meters-y-up",
        materials: MATERIALS.map((m) => ({ ...m })),
        surfaces: [...walls.values(), ...horizontal],
        regions,
        assumptions: [
          ...warnings,
          "Material assignments and transmission spectra are assumed, not measured assemblies.",
          "Door/window open state is a scenario assumption.",
          "Vertical walls, flat floors/ceilings, and no furniture geometry.",
          "A receiver-height slice is displayed on the floor; it is not pressure at floor level.",
          "First-order reflection and single-edge diffraction approximation; no room modes or late reverberation.",
        ],
      };
    new AcousticScene(scene); // fail visibly on invalid geometry before sending to a worker
    return {
      scene,
      counts: {
        walls: walls.size,
        windows: openings.filter((o) => o.kind === "window").length,
        doors: openings.filter((o) => o.kind === "door").length,
        openings: openings.filter((o) => o.kind === "opening").length,
        assumedHeights,
      },
      warnings,
    };
  }
  private openings(
    edge: ApiEdge,
    width: number,
    base: number,
    options: ImportOptions,
    warnings: string[],
  ): OpeningData[] {
    return (edge.openings ?? []).map((o) => {
      const kind =
        o.type === "window"
          ? "window"
          : o.type === "doorway"
            ? "door"
            : "opening";
      if (o.height === undefined || o.lowerElevation === undefined)
        warnings.push(
          `Opening ${o.id}: missing vertical dimensions; assumed height 2.1 m / floor elevation`,
        );
      return {
        id: o.id,
        kind,
        centerM: o.relativeCenter * width,
        widthM: o.width,
        heightM: o.height ?? 2.1,
        bottomM: o.lowerElevation ?? base,
        state:
          kind === "opening" ||
          (kind === "window" ? options.windowsOpen : options.doorsOpen)
            ? "open"
            : "closed",
        materialId: kind === "window" ? options.windowMaterial : "door",
        evidence: measured(
          "Vector opening dimensions in metres; lowerElevation is absolute model elevation",
        ),
      };
    });
  }
}
