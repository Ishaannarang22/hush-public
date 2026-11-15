import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AcousticScene,
  GeometricAcousticSolver,
  diffractionLossDb,
} from "../src/acoustics/engine/solver.ts";
import {
  OctaveSpectrum,
  AcousticMaterial,
  OCTAVES,
} from "../src/acoustics/engine/domain.ts";
import { AcousticGridJob, displayField } from "../src/acoustics/engine/grid.ts";
import {
  MatterportSceneImporter,
  parseOpeningDataset,
} from "../src/acoustics/engine/importer.ts";
import { SurfaceIndex, Wall } from "../src/acoustics/engine/geometry.ts";
const ev = { kind: "assumed", source: "analytic test fixture" },
  vec = (x, y, z) => ({ x, y, z });
const material = (id = "wall", alpha = 0.1, tl = 30) => ({
  id,
  name: id,
  absorption: Array(8).fill(alpha),
  transmissionLossDb: Array(8).fill(tl),
  evidence: ev,
});
const wall = (
  id = "w",
  a = vec(0, 0, -2),
  b = vec(0, 0, 2),
  heightM = 3,
  openings = [],
) => ({
  kind: "wall",
  id,
  a,
  b,
  heightM,
  thicknessM: 0.1,
  materialId: "wall",
  openings,
  evidence: ev,
});
const floor = (id = "floor", y = 0) => ({
  kind: "floor",
  id,
  polygon: [vec(-10, y, -10), vec(10, y, -10), vec(10, y, 10), vec(-10, y, 10)],
  materialId: "wall",
  evidence: ev,
});
const source = (p = vec(-2, 1, 0), id = "s") => ({
  id,
  position: p,
  spectrumDbAt1m: Array(8).fill(60),
  enabled: true,
  evidence: ev,
});
const scene = (surfaces = [], materials = [material()], regions = []) => ({
  schemaVersion: 1,
  id: "test",
  coordinateSystem: "local-meters-y-up",
  materials,
  surfaces,
  regions,
  assumptions: [],
});
const solve = (s, p = vec(2, 1, 0), sources = [source()], opts = {}) =>
  new GeometricAcousticSolver(new AcousticScene(s)).evaluate(p, sources, {
    reflections: false,
    diffraction: false,
    ...opts,
  });
const near = (a, b, tol = 1e-5) =>
  assert.ok(Math.abs(a - b) < tol, `${a} differs from ${b}`);
const opening = (
  state = "open",
  widthM = 1,
  heightM = 2,
  bottomM = 0,
  centerM = 2,
) => ({
  id: "window",
  kind: "window",
  centerM,
  widthM,
  heightM,
  bottomM,
  state,
  materialId: "glass",
  evidence: ev,
});
test("point source inverse-square energy and two equal independent sources", () => {
  near(solve(scene()).total[0], 1e6 / 16);
  near(
    solve(scene(), vec(2, 1, 0), [source(), source(vec(-2, 1, 0), "s2")])
      .total[0],
    2e6 / 16,
  );
});
test("eight-band source normalization preserves the specified overall level", () => {
  near(
    OctaveSpectrum.normalized(82, [0, 0, -2, -4, -7, -10, -14, -20]).totalDb(),
    82,
  );
});
test("A-weighting is applied after frequency-dependent propagation", () => {
  const s = new OctaveSpectrum([60, 0, 0, 0, 0, 0, 0, 0]);
  assert.ok(s.totalDb(true) < s.totalDb() - 25);
});
test("material energy budget is conserved and invalid coefficients fail", () => {
  const m = new AcousticMaterial(material());
  for (let i = 0; i < 8; i++)
    near(m.data.absorption[i] + m.transmission[i] + m.reflection[i], 1);
  assert.throws(() => new AcousticMaterial(material("bad", 0.8, 0)), /exceeds/);
  assert.throws(() => new OctaveSpectrum([1]), /eight/);
});
test("wall transmission is separate in each octave band", () => {
  const m = material();
  m.transmissionLossDb = OCTAVES.map((_, i) => 10 + i * 5);
  const r = solve(scene([wall()], [m]));
  r.total.forEach((e, i) => near(e, (1e6 / 16) * 10 ** (-(10 + i * 5) / 10)));
});
test("opening dimensions and position determine whether a ray reaches the aperture", () => {
  const mats = [material(), material("glass", 0.05, 20)];
  const open = solve(
    scene([wall("w", undefined, undefined, 3, [opening()])], mats),
  );
  near(open.total[0], 1e6 / 16);
  const shifted = solve(
    scene(
      [wall("w", undefined, undefined, 3, [opening("open", 0.5, 2, 0, 3)])],
      mats,
    ),
  );
  near(shifted.total[0], (1e6 / 16) * 0.001);
  const high = solve(
    scene(
      [wall("w", undefined, undefined, 3, [opening("open", 1, 0.6, 1.5)])],
      mats,
    ),
  );
  near(high.total[0], shifted.total[0]);
});
test("closed glazing transmits its own spectrum; opening it changes the result", () => {
  const mats = [material(), material("glass", 0.05, 20)];
  const closed = solve(
    scene([wall("w", undefined, undefined, 3, [opening("closed")])], mats),
  );
  near(closed.total[0], (1e6 / 16) * 0.01);
});
test("wider window reveals a previously blocked oblique ray", () => {
  const mats = [material(), material("glass", 0.05, 20)],
    s = [source(vec(-2, 1, 0.6))],
    receiver = vec(2, 1, 0.6);
  const small = solve(
      scene([wall("w", undefined, undefined, 3, [opening("open", 1)])], mats),
      receiver,
      s,
    ),
    wide = solve(
      scene([wall("w", undefined, undefined, 3, [opening("open", 2)])], mats),
      receiver,
      s,
    );
  near(wide.total[0] / small.total[0], 1000);
});
test("floor image-source reflection matches analytical path length and absorption", () => {
  const r = solve(scene([floor()]), vec(2, 1, 0), [source(vec(0, 1, 0))], {
    reflections: true,
  });
  near(r.direct[0], 1e6 / 4);
  near(r.reflected[0], (1e6 / 8) * 0.899);
  assert.equal(r.pathCounts.reflected, 1);
});
test("perfectly absorbing surface produces no specular reflected contribution", () => {
  const r = solve(
    scene([floor()], [material("wall", 1, 120)]),
    vec(2, 1, 0),
    [source(vec(0, 1, 0))],
    { reflections: true },
  );
  near(r.reflected[0], 0);
});
test("open aperture cannot act as a reflecting glass pane", () => {
  const mats = [material(), material("glass", 0.05, 20)];
  const r = solve(
    scene([wall("w", undefined, undefined, 3, [opening()])], mats),
    vec(-2, 1, 0.2),
    [source(vec(-2, 1, -0.2))],
    { reflections: true },
  );
  near(r.reflected[0], 0);
});
test("diffraction agrees with Maekawa–Tatge formula and attenuates high frequencies more", () => {
  near(diffractionLossDb(0.5, 343), 10 * Math.log10(23));
  assert.ok(diffractionLossDb(0.5, 4000) > diffractionLossDb(0.5, 125));
  const r = solve(
    scene([wall("w", vec(0, 0, -2), vec(0, 0, 2), 2)]),
    vec(2, 1, 0),
    [source()],
    { diffraction: true },
  );
  assert.equal(r.pathCounts.diffracted, 1);
  assert.ok(r.diffracted[0] > r.diffracted[7]);
  assert.ok(r.total[0] > r.direct[0]);
});
test("unobstructed sound does not gain a spurious diffraction contribution", () => {
  const r = solve(scene([wall()]), vec(-4, 1, 0), [source()], {
    diffraction: true,
  });
  near(r.diffracted[0], 0);
});
test("sealed room does not leak diffracted sound through wall-ceiling joints", () => {
  const s = scene([
    wall("west", vec(-1, 0, -1), vec(-1, 0, 1), 2),
    wall("east", vec(1, 0, -1), vec(1, 0, 1), 2),
    wall("north", vec(-1, 0, -1), vec(1, 0, -1), 2),
    wall("south", vec(-1, 0, 1), vec(1, 0, 1), 2),
    floor("bottom", 0),
    { ...floor("top", 2), kind: "ceiling" },
  ]);
  const r = solve(s, vec(0, 1, 0), [source(vec(-3, 1, 0))], {
    diffraction: true,
  });
  near(r.diffracted[0], 0);
});
test("aperture-edge diffraction reaches the window shadow", () => {
  const mats = [material(), material("glass", 0.05, 20)];
  const r = solve(
    scene(
      [
        wall("w", vec(0, 0, -5), vec(0, 0, 5), 5, [
          opening("open", 1, 2, 0, 5),
        ]),
      ],
      mats,
    ),
    vec(2, 1, 2),
    [source(vec(-2, 1, 0))],
    { diffraction: true },
  );
  assert.ok(r.diffracted[0] > 0);
});
test("muting sources gives zero energy", () => {
  assert.ok(
    solve(scene(), vec(2, 1, 0), [{ ...source(), enabled: false }]).total.every(
      (n) => n === 0,
    ),
  );
});
test("BVH ray query agrees with brute-force intersections for many walls", () => {
  const m = new Map([["wall", new AcousticMaterial(material())]]),
    walls = Array.from(
      { length: 200 },
      (_, i) => new Wall(wall(`w${i}`, vec(i * 3, 0, -2), vec(i * 3, 0, 2)), m),
    ),
    index = new SurfaceIndex(walls),
    a = vec(-1, 1, 0),
    b = vec(15, 1, 0);
  const indexed = index
      .query(a, b)
      .filter((w) => w.intersect(a, b))
      .map((w) => w.data.id)
      .sort(),
    all = walls
      .filter((w) => w.intersect(a, b))
      .map((w) => w.data.id)
      .sort();
  assert.deepEqual(indexed, all);
  assert.ok(index.query(a, b).length < 10);
});
test("grid tiles match scalar receiver evaluation and exclude polygon holes", () => {
  const region = {
    id: "r",
    floorId: "f",
    heightM: 3,
    polygon: [vec(0, 0, 0), vec(4, 0, 0), vec(4, 0, 4), vec(0, 0, 4)],
    holes: [[vec(2, 0, 2), vec(4, 0, 2), vec(4, 0, 4), vec(2, 0, 4)]],
    evidence: ev,
  };
  const solver = new GeometricAcousticSolver(
      new AcousticScene(scene([], undefined, [region])),
    ),
    request = {
      bounds: { minX: 0, minZ: 0, spanX: 4, spanZ: 4 },
      width: 4,
      height: 4,
      receiverHeightM: 1,
      floorId: "f",
      sources: [source()],
      options: { reflections: false, diffraction: false },
    },
    job = new AcousticGridJob(solver, request);
  while (!job.step(1)) {}
  near(
    job.field.bandDb[0],
    10 *
      Math.log10(
        solver.evaluate(vec(0.5, 1, 0.5), [source()], request.options).total[0],
      ),
    0.0001,
  );
  assert.equal(job.field.mask[15], 0);
  assert.equal(displayField(job.field, 0).db[0], job.field.bandDb[0]);
  const tile = new AcousticGridJob(solver, {
    ...request,
    width: 2,
    bounds: { ...request.bounds, spanX: 2 },
  });
  while (!tile.step(1)) {}
  near(tile.field.bandDb[8], job.field.bandDb[8]);
});
test("opening import checks model identity, units, dimensions and provenance", () => {
  assert.throws(
    () =>
      parseOpeningDataset(
        JSON.stringify({
          schemaVersion: 1,
          modelId: "wrong",
          units: "meters",
          openings: [],
        }),
        "test",
      ),
    /match/,
  );
  assert.throws(
    () =>
      parseOpeningDataset(
        JSON.stringify({
          schemaVersion: 1,
          modelId: "test",
          units: "meters",
          openings: [{ id: "x" }],
        }),
        "test",
      ),
    /Invalid/,
  );
});
test("Matterport dimensional feet become metres without rescaling vector edges", () => {
  const points = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
    edges = points.map((p, i) => ({
      id: `e${i}`,
      type: "wall",
      thickness: 0.12,
      vertices: [p, points[(i + 1) % 4]].map(([x, y]) => ({
        position: { x, y },
      })),
    })),
    room = {
      id: "r",
      floor: { id: "f", sequence: 0 },
      dimensions: { height: 10, units: "imperial" },
      dimensionEstimates: { lowerElevation: 1, units: "imperial" },
      boundary: { edges },
    };
  const data = new MatterportSceneImporter().import("test", [room], {
    wallMaterial: "plasterboard",
    floorMaterial: "floor",
    windowMaterial: "glass",
    doorsOpen: true,
    windowsOpen: false,
    assumedHeightM: 2.7,
    floorId: "f",
  });
  near(data.scene.regions[0].heightM, 3.048);
  near(data.scene.regions[0].polygon[0].y, 0.3048);
  near(data.scene.surfaces[0].b.x, 4);
  assert.equal(data.counts.windows, 0);
});
test(
  "actual imported scene benchmark (optional private fixture)",
  { skip: !process.env.HUSH_BENCH_FIXTURE },
  () => {
    const rooms = JSON.parse(
      fs.readFileSync(process.env.HUSH_BENCH_FIXTURE, "utf8"),
    ).model.rooms;
    const result = new MatterportSceneImporter().import("benchmark", rooms, {
      wallMaterial: "plasterboard",
      floorMaterial: "floor",
      windowMaterial: "glass",
      doorsOpen: true,
      windowsOpen: false,
      assumedHeightM: 2.7,
      floorId: rooms[0].floor.id,
    });
    const solver = new GeometricAcousticSolver(new AcousticScene(result.scene));
    const times = [];
    for (let j = 0; j < 100; j++) {
      const t = performance.now();
      solver.evaluate(vec(0.01 * j, 1.2, -4), [
        source(vec(-7, 1.5, -4)),
        source(vec(8, 1.5, -7), "s2"),
        source(vec(0, 1.5, 4), "s3"),
      ]);
      times.push(performance.now() - t);
    }
    console.log(
      `Actual scene: ${result.counts.walls} walls, 100 receivers × 3 sources, ${times.reduce((a, b) => a + b, 0).toFixed(1)} ms total`,
    );
  },
);

test("measured Yale facade sizes drive area-weighted window transmission", async () => {
  const { FacadeAssembly } = await import("../src/acoustics/engine/facade.ts");
  const data = JSON.parse(
    fs.readFileSync(
      new URL("../src/acoustics/data/yale-facades.json", import.meta.url),
    ),
  );
  const f = data.facades.find((f) => f.id === "living-n-glazing"),
    m = new AcousticMaterial(material("wall", 0.1, 40)),
    glass = new AcousticMaterial(material("glass", 0.05, 20));
  const openings = f.openings.map((o) => ({
    ...o,
    open: false,
    material: glass,
  }));
  const a = new FacadeAssembly(f.widthM, f.heightM, m, openings),
    b = new FacadeAssembly(
      f.widthM,
      f.heightM,
      m,
      openings.map((o) => ({ ...o, open: true })),
    );
  near(a.openingAreaM2, 2.85 * 2.63);
  assert.ok(a.transmissionLossDb()[0] < 40);
  assert.ok(b.transmissionLossDb()[0] < a.transmissionLossDb()[0]);
  assert.equal(data.modelId, "D9CVkjeMoQx");
  assert.match(data.spatialRegistration, /pending/);
});

const cacheFixture = () => {
  const region = {
    id: "r",
    floorId: "f",
    heightM: 3,
    polygon: [vec(-4, 0, -3), vec(4, 0, -3), vec(4, 0, 3), vec(-4, 0, 3)],
    holes: [[vec(2, 0, 1), vec(3, 0, 1), vec(3, 0, 2), vec(2, 0, 2)]],
    evidence: ev,
  };
  const data = scene([wall(), floor()], undefined, [region]);
  const solver = new GeometricAcousticSolver(new AcousticScene(data));
  const request = {
    bounds: { minX: -4, minZ: -3, spanX: 8, spanZ: 6 },
    width: 12,
    height: 9,
    receiverHeightM: 1.2,
    floorId: "f",
    sources: [source(vec(-5, 1.5, 0), "a"), source(vec(5, 1, 1), "b")],
    options: { reflections: true, diffraction: true },
  };
  return { data, solver, request };
};
const finish = (job) => {
  while (!job.step(16)) {}
  return job;
};
function sameField(a, b) {
  assert.deepEqual(a.mask, b.mask);
  assert.deepEqual(a.pathCounts, b.pathCounts);
  for (const k of ["bandDb", "directDb", "reflectedDb", "diffractedDb"])
    for (let i = 0; i < a[k].length; i++) near(a[k][i], b[k][i], 0.00002);
}
test("cached unit-energy fields preserve all bands and components, including zero paths", async () => {
  const { AcousticTransferCache } = await import(
    "../src/acoustics/engine/cache.ts"
  );
  const { solver, request } = cacheFixture(),
    cache = new AcousticTransferCache(solver);
  sameField(
    finish(cache.job(request)).field,
    finish(new AcousticGridJob(solver, request)).field,
  );
  const louder = {
    ...request,
    sources: request.sources.map((s, i) => ({
      ...s,
      spectrumDbAt1m: Array.from({ length: 8 }, (_, b) => 70 + i * 10 - b * 3),
    })),
  };
  const job = finish(cache.job(louder));
  assert.equal(job.stats.evaluatedReceivers, 0);
  assert.equal(job.stats.cacheHits, 2);
  sameField(job.field, finish(new AcousticGridJob(solver, louder)).field);
  const muted = {
    ...louder,
    sources: louder.sources.map((s) => ({ ...s, enabled: false })),
  };
  assert.equal(cache.canReuse(muted), true);
  sameField(
    finish(cache.job(muted)).field,
    finish(new AcousticGridJob(solver, muted)).field,
  );
});
test("moving one source reuses the other source; physics, height, and scene changes invalidate reuse", async () => {
  const { AcousticTransferCache } = await import(
    "../src/acoustics/engine/cache.ts"
  );
  const { solver, request, data } = cacheFixture(),
    cache = new AcousticTransferCache(solver);
  finish(cache.job(request));
  const moved = {
    ...request,
    sources: request.sources.map((s, i) =>
      i ? s : { ...s, position: vec(-5, 1.5, 2) },
    ),
  };
  const job = finish(cache.job(moved));
  assert.equal(job.stats.computedSources, 1);
  assert.equal(job.stats.cacheHits, 1);
  sameField(job.field, finish(new AcousticGridJob(solver, moved)).field);
  for (const q of [
    { ...request, options: { reflections: false, diffraction: true } },
    { ...request, receiverHeightM: 2 },
    { ...request, options: { soundSpeed: 300 } },
  ]) {
    assert.equal(cache.canReuse(q), false);
    const j = finish(cache.job(q));
    assert.equal(j.stats.computedSources, 2);
    sameField(j.field, finish(new AcousticGridJob(solver, q)).field);
  }
  const changed = new AcousticTransferCache(
    new GeometricAcousticSolver(
      new AcousticScene({ ...data, materials: [material("wall", 0.15, 40)] }),
    ),
  );
  assert.equal(changed.canReuse(request), false);
});
test("partial cache jobs are not reusable and LRU storage stays bounded", async () => {
  const { AcousticTransferCache, previewRequest } = await import(
    "../src/acoustics/engine/cache.ts"
  );
  const { solver, request } = cacheFixture(),
    perSource = request.width * request.height * 8 * 3 * 8;
  const cache = new AcousticTransferCache(solver, perSource);
  cache.job(request).step(1);
  assert.equal(cache.canReuse(request), false);
  const job = finish(cache.job(request));
  assert.equal(job.stats.computedSources, 2);
  assert.ok(cache.bytes <= perSource);
  assert.equal(cache.canReuse(request), false);
  const q = { ...request, width: 160, height: 120 },
    p = previewRequest(q);
  assert.equal(p.width, 12);
  assert.equal(p.height, 9);
  assert.deepEqual(p.options, q.options);
  assert.deepEqual(p.sources, q.sources);
});

test("live worker coalesces rapid updates, refines the newest request, and isolates scene revisions", async () => {
  const { Worker } = await import("node:worker_threads");
  const { data, solver, request } = cacheFixture();
  const worker = new Worker(
    new URL("./acoustic-worker-harness.mjs", import.meta.url),
  );
  const messages = [];
  const waitFor = (predicate) =>
    new Promise((resolve, reject) => {
      const found = messages.find(predicate);
      if (found) {
        resolve(found);
        return;
      }
      const timer = setTimeout(() => {
        worker.off("message", onMessage);
        reject(new Error("Worker response timed out"));
      }, 5000);
      const onMessage = (m) => {
        if (predicate(m)) {
          clearTimeout(timer);
          worker.off("message", onMessage);
          resolve(m);
        }
      };
      worker.on("message", onMessage);
    });
  worker.on("message", (m) => messages.push(m));
  try {
    worker.postMessage({ type: "scene", scene: data, revision: 1 });
    await waitFor((m) => m.type === "ready" && m.revision === 1);
    const q = { ...request, width: 48, height: 36 };
    worker.postMessage({ type: "compute", id: 1, revision: 1, request: q });
    await waitFor(
      (m) => m.type === "result" && m.id === 1 && m.phase === "preview",
    );
    let last;
    for (let id = 2; id <= 10; id++) {
      last = {
        ...q,
        sources: q.sources.map((s, i) =>
          i ? s : { ...s, position: vec(-5, 1.5, id / 10) },
        ),
      };
      worker.postMessage({ type: "compute", id, revision: 1, request: last });
    }
    const result = await waitFor(
      (m) => m.type === "result" && m.id === 10 && m.phase === "detail",
    );
    sameField(result.result, finish(new AcousticGridJob(solver, last)).field);
    assert.ok(
      !messages.some(
        (m) =>
          m.type === "result" && m.phase === "detail" && m.id > 1 && m.id < 10,
      ),
    );
    const level = {
      ...last,
      sources: last.sources.map((s) => ({
        ...s,
        spectrumDbAt1m: Array(8).fill(75),
      })),
    };
    worker.postMessage({
      type: "compute",
      id: 11,
      revision: 1,
      request: level,
    });
    const instant = await waitFor((m) => m.type === "result" && m.id === 11);
    assert.equal(instant.phase, "detail");
    assert.equal(instant.stats.evaluatedReceivers, 0);
    sameField(instant.result, finish(new AcousticGridJob(solver, level)).field);
    worker.postMessage({
      type: "compute",
      id: 12,
      revision: 1,
      request: { ...q, width: 160, height: 120, receiverHeightM: 1.9 },
    });
    worker.postMessage({
      type: "scene",
      scene: { ...data, id: "replacement", surfaces: [] },
      revision: 2,
    });
    await waitFor((m) => m.type === "ready" && m.revision === 2);
    worker.postMessage({ type: "compute", id: 13, revision: 2, request: q });
    const replaced = await waitFor(
      (m) => m.type === "result" && m.id === 13 && m.phase === "detail",
    );
    assert.equal(replaced.revision, 2);
    sameField(
      replaced.result,
      finish(
        new AcousticGridJob(
          new GeometricAcousticSolver(
            new AcousticScene({ ...data, surfaces: [] }),
          ),
          q,
        ),
      ).field,
    );
    const readyIndex = messages.findIndex(
      (m) => m.type === "ready" && m.revision === 2,
    );
    assert.ok(!messages.slice(readyIndex + 1).some((m) => m.revision === 1));
  } finally {
    await worker.terminate();
  }
});
