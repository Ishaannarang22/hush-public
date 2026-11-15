import test from "node:test";
import assert from "node:assert/strict";
import { EnvironmentalNoisePipeline } from "../server/pipeline.ts";
import {
  RoomEnergyModel,
  bandEnergies,
  solvePositiveSystem,
} from "../server/room-energy.ts";
import { energy, A_WEIGHTING } from "../src/acoustics/engine/domain.ts";

const evidence = { kind: "assumed", source: "Analytical test fixture" };
const material = {
  id: "test",
  name: "Test assembly",
  absorption: Array(8).fill(0.2),
  transmissionLossDb: Array(8).fill(10),
  evidence,
};
const polygon = [
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 2, y: 0, z: 2 },
  { x: 0, y: 0, z: 2 },
];
const scene = {
  schemaVersion: 1,
  id: "box",
  coordinateSystem: "local-meters-y-up",
  materials: [material],
  assumptions: [],
  regions: [
    { id: "r", floorId: "f", polygon, holes: [], heightM: 2, evidence },
  ],
  surfaces: [
    {
      kind: "floor",
      id: "floor:r",
      polygon,
      holes: [],
      materialId: "test",
      evidence,
    },
    {
      kind: "wall",
      id: "w",
      a: polygon[0],
      b: polygon[1],
      heightM: 2,
      thicknessM: 0.1,
      materialId: "test",
      openings: [],
      evidence,
    },
  ],
};
const prop = {
  rooms: [{ id: "r", exterior_walls: [{ id: "w" }] }],
  partitions: [],
};
const api = [{ id: "r", boundary: { edges: [{ id: "w" }] } }];
const outdoor = [
  { wall: "w", blocks: { midday: { by_source: { road: 60 } } } },
];
const runRoom = (s) =>
  new RoomEnergyModel(s).run(prop, api, outdoor, ["midday"], 0).rooms.r.blocks
    .midday;
test("one-room energy balance matches hand calculation: E=T*S*Eout/(A+T*S)", () => {
  const result = runRoom(scene);
  // 4 m² floor + 4 m² wall: A=1.6; facade transmission area=0.4.
  const expected = 60 + 10 * Math.log10(0.4 / (1.6 + 0.4));
  assert.ok(Math.abs(result.dba - expected) < 1e-9);
});
test("open aperture uses its area; larger opening transmits more energy", () => {
  const small = structuredClone(scene),
    large = structuredClone(scene);
  const opening = {
    id: "o",
    kind: "window",
    centerM: 1,
    widthM: 0.5,
    heightM: 1,
    bottomM: 0,
    state: "open",
    materialId: "test",
    evidence,
  };
  small.surfaces[1].openings = [opening];
  large.surfaces[1].openings = [{ ...opening, widthM: 1 }];
  assert.ok(runRoom(small).dba > runRoom(scene).dba);
  assert.ok(runRoom(large).dba > runRoom(small).dba);
});
test("frequency-dependent transmission survives into room bands", () => {
  const changed = structuredClone(scene);
  changed.materials[0].transmissionLossDb = [10, 10, 10, 10, 40, 40, 40, 40];
  const base = runRoom(scene),
    modified = runRoom(changed);
  assert.equal(base.bandDb[0], modified.bandDb[0]);
  assert.ok(modified.bandDb[7] < base.bandDb[7] - 29);
});
test("two-room balance conserves injected energy and solves feedback, not sequential attenuation", () => {
  const s = structuredClone(scene);
  s.regions.push({ ...s.regions[0], id: "r2" });
  s.surfaces.push({ ...s.surfaces[0], id: "floor:r2" });
  const p = structuredClone(prop);
  p.rooms.push({ id: "r2", exterior_walls: [] });
  p.partitions.push({
    room_a: "r",
    room_b: "r2",
    edge_id: "open",
    kind: "opening",
    area_m2: 1,
  });
  const r = new RoomEnergyModel(s).run(
    p,
    [...api, { id: "r2", boundary: { edges: [] } }],
    outdoor,
    ["midday"],
    0,
  ).rooms;
  const first = energy(r.r.blocks.midday.dba),
    second = energy(r.r2.blocks.midday.dba);
  // A1+exterior escape=2; A2=.8; injected=.4*1e6. Internal exchange cancels.
  assert.ok(Math.abs(2 * first + 0.8 * second - 0.4 * energy(60)) < 1e-6);
  assert.ok(Math.abs(first / second - 1.8) < 1e-9);
  assert.throws(() => solvePositiveSystem([[0]], [1]), /singular/);
});
test("band shapes preserve broadband A-weighted energy", () => {
  for (const mode of ["road", "construction", "aircraft", "rail", "mechanical"])
    assert.ok(
      Math.abs(
        bandEnergies(60, mode).reduce(
          (s, e, i) => s + e * energy(A_WEIGHTING[i]),
          0,
        ) - energy(60),
      ) < 1e-8,
    );
});
test("complete measured apartment run responds to sources and opening states and produces a grid", async () => {
  const p = new EnvironmentalNoisePipeline();
  const baseline = await p.run({ grid: { resolution: 8 } });
  assert.equal(baseline.counts.walls, 29);
  assert.equal(baseline.counts.windows, 1);
  assert.equal(Object.keys(baseline.roomTargets.rooms).length, 5);
  assert.ok(baseline.grid.cells > 50);
  assert.ok(baseline.grid.pathCounts.direct > 0);
  const opened = await p.run({
    openings: baseline.openings.map((o) => ({ ...o, state: "open" })),
  });
  const bedroom = Object.keys(baseline.roomTargets.rooms).find(
    (id) => baseline.roomTargets.rooms[id].name === "Bedroom",
  );
  assert.ok(
    opened.roomTargets.rooms[bedroom].blocks.midday.dba >
      baseline.roomTargets.rooms[bedroom].blocks.midday.dba + 5,
  );
  const silent = await p.run({ sourceInputs: {} });
  assert.ok(
    Object.values(silent.roomTargets.rooms).every((r) =>
      Object.values(r.blocks).every((b) => b.dba === null),
    ),
  );
  assert.equal(silent.labSources.blocks.midday.length, 0);
  assert.notEqual(silent.runId, baseline.runId);
});
test("Yale explicitly reports no spatial coverage and invalid requests fail", async () => {
  const p = new EnvironmentalNoisePipeline();
  const yale = await p.run({ modelId: "D9CVkjeMoQx" });
  assert.equal(yale.scene, null);
  assert.match(yale.method, /legacy/);
  await assert.rejects(() => p.run({ block: "noon" }), /time block/);
  await assert.rejects(
    () => p.run({ grid: { resolution: 10000 } }),
    /resolution/,
  );
  await assert.rejects(
    () => p.run({ scenario: { floorId: "missing" } }),
    /No rooms/,
  );
});
