import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EnvironmentalSourceAdapter,
  TIME_BLOCKS,
} from "../src/acoustics/integration/sources.ts";
import { acousticSource } from "../src/acoustics/demo.ts";
import { OctaveSpectrum } from "../src/acoustics/engine/domain.ts";
import {
  MatterportSceneImporter,
  parseOpeningDataset,
} from "../src/acoustics/engine/importer.ts";
import { AcousticScene } from "../src/acoustics/engine/solver.ts";
import { roomMeans } from "../src/acoustics/integration/comparison.ts";
const sample = (name) =>
  JSON.parse(
    fs.readFileSync(new URL(`../../samples/${name}`, import.meta.url), "utf8"),
  );
const modelId = "zzvymDx5ty7";
const raw = sample(`lab_sources.${modelId}.json`);
const rooms = sample(`matterport_model_${modelId}.json`).data.model.rooms;
const survey = sample(`windows.${modelId}.json`);
const options = {
  wallMaterial: "plasterboard",
  floorMaterial: "floor",
  windowMaterial: "glass",
  doorsOpen: true,
  windowsOpen: false,
  assumedHeightM: 2.7,
  floorId: rooms[0].floor.id,
};
const importScene = (extra) =>
  new MatterportSceneImporter().import(modelId, rooms, options, extra);

test("Alejandro export survives adapter without altering spectra, position, or provenance; volume edits scale it", () => {
  const adapter = new EnvironmentalSourceAdapter(raw, modelId);
  for (const block of Object.keys(TIME_BLOCKS)) {
    const demo = adapter.sources(block)[0],
      source = acousticSource(demo),
      original = raw.blocks[block][0];
    assert.deepEqual(source.position, original.position);
    assert.deepEqual(source.evidence, original.evidence);
    original.spectrumDbAt1m.forEach((v, i) =>
      assert.ok(Math.abs(source.spectrumDbAt1m[i] - v) < 1e-9),
    );
    const louder = acousticSource({ ...demo, level: demo.level + 6 });
    louder.spectrumDbAt1m.forEach((v, i) =>
      assert.ok(Math.abs(v - source.spectrumDbAt1m[i] - 6) < 1e-9),
    );
    const ref = raw.derivation[source.id];
    const r = Math.hypot(
      ...["x", "y", "z"].map((k) => source.position[k] - ref.receiver[k]),
    );
    const level =
      new OctaveSpectrum(source.spectrumDbAt1m).totalDb(true) -
      20 * Math.log10(r);
    assert.ok(Math.abs(level - ref.wall_level_dba[block]) < 0.1);
  }
});

test("provider-neutral imports accept all environmental point-source types and reject bad/mismatched data", () => {
  assert.throws(() => new EnvironmentalSourceAdapter(raw, "another-house"));
  for (const kind of [
    "road",
    "construction",
    "aircraft",
    "rail",
    "mechanical",
  ]) {
    const input = structuredClone(raw);
    input.blocks.midday[0].kind = kind;
    assert.equal(
      new EnvironmentalSourceAdapter(input, modelId).sources("midday")[0].kind,
      kind,
    );
  }
  for (const change of [
    (d) => d.blocks.midday.push(d.blocks.midday[0]),
    (d) => d.blocks.midday[0].spectrumDbAt1m.pop(),
    (d) => (d.blocks.midday[0].position.x = Infinity),
    (d) => delete d.blocks.midday[0].evidence,
    (d) => (d.blocks.midday[0].enabled = "false"),
  ]) {
    const input = structuredClone(raw);
    change(input);
    assert.throws(() => new EnvironmentalSourceAdapter(input, modelId));
  }
  const empty = structuredClone(raw);
  empty.blocks.midday = [];
  assert.deepEqual(
    new EnvironmentalSourceAdapter(empty, modelId).sources("midday"),
    [],
  );
});

test("real measured opening dimensions fit the scene; glass door and window use glass, open apertures transmit freely", () => {
  const extra = parseOpeningDataset(
    JSON.stringify(survey),
    modelId,
  ).openings.map((o) => ({ ...o, state: "closed" }));
  const imported = importScene(extra);
  assert.equal(imported.counts.windows, 1);
  const scene = new AcousticScene(imported.scene);
  for (const o of extra) {
    const wall = scene.surfaces.find((s) => s.data.id === o.wallId),
      opening = wall.data.openings.find((v) => v.id === o.id);
    assert.equal(opening.materialId, "glass");
    assert.equal(opening.state, "closed");
    const mid = {
      x: wall.data.a.x + (wall.data.b.x - wall.data.a.x) * o.centerFraction,
      y: o.lowerElevationM + o.heightM / 2,
      z: wall.data.a.z + (wall.data.b.z - wall.data.a.z) * o.centerFraction,
    };
    const offset = (sign) => ({
      x: mid.x + sign * wall.normal.x * 0.1,
      y: mid.y,
      z: mid.z + sign * wall.normal.z * 0.1,
    });
    assert.equal(scene.trace(offset(-1), offset(1))[0].opening.id, o.id);
    assert.ok(scene.transmission(offset(-1), offset(1))[3] < 0.1);
    const openScene = new AcousticScene(
      importScene(
        extra.map((v) => (v.id === o.id ? { ...v, state: "open" } : v)),
      ).scene,
    );
    assert.equal(openScene.transmission(offset(-1), offset(1))[3], 1);
  }
});

test("per-wall materials change only the selected wall; imported materials and state validate", () => {
  const baseline = importScene([]);
  const id = baseline.scene.surfaces.find((s) => s.kind === "wall").id;
  const changed = new MatterportSceneImporter().import(modelId, rooms, {
    ...options,
    surfaceMaterials: { [id]: "concrete" },
  });
  for (const wall of changed.scene.surfaces.filter((s) => s.kind === "wall"))
    assert.equal(wall.materialId, wall.id === id ? "concrete" : "plasterboard");
  const bad = structuredClone(survey);
  bad.openings[0].materialId = "magic";
  assert.throws(() => parseOpeningDataset(JSON.stringify(bad), modelId));
});

test("room comparisons average energy rather than decibels and exclude holes", () => {
  const bands = new Float32Array(16).fill(-120);
  bands[4] = 40;
  bands[12] = 60;
  const field = {
    width: 2,
    height: 1,
    minX: 0,
    minZ: 0,
    spanX: 2,
    spanZ: 1,
    mask: new Uint8Array([1, 1]),
    db: new Float32Array(2),
    bandDb: bands,
  };
  const region = {
    id: "r",
    polygon: [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 1 },
      { x: 0, z: 1 },
    ],
    holes: [],
  };
  assert.ok(
    Math.abs(roomMeans(field, [region]).r - 10 * Math.log10((1e4 + 1e6) / 2)) <
      1e-5,
  );
  region.holes = [
    [
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 1 },
      { x: 1, z: 1 },
    ],
  ];
  assert.ok(Math.abs(roomMeans(field, [region]).r - 40) < 1e-5);
});
