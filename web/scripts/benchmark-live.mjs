// Optional private local scene, exported by the lab. Nothing is uploaded.
// node scripts/benchmark-live.mjs scene.json request.json
import fs from "node:fs";
import {
  AcousticScene,
  GeometricAcousticSolver,
} from "../src/acoustics/engine/solver.ts";
import { AcousticGridJob } from "../src/acoustics/engine/grid.ts";
import {
  AcousticTransferCache,
  previewRequest,
} from "../src/acoustics/engine/cache.ts";
const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const request = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const solver = new GeometricAcousticSolver(new AcousticScene(scene));
const cache = new AcousticTransferCache(solver);
function run(label, job) {
  const start = performance.now();
  while (!job.step(24)) {}
  console.log(
    JSON.stringify({
      label,
      ms: +(performance.now() - start).toFixed(2),
      cells: job.field.cells,
      ...job.stats,
    }),
  );
  return job.field;
}
run("original full grid", new AcousticGridJob(solver, request));
run("cold live preview", cache.job(previewRequest(request)));
run("cold detailed grid", cache.job(request));
const level = {
  ...request,
  sources: request.sources.map((s) => ({
    ...s,
    spectrumDbAt1m: s.spectrumDbAt1m.map((db) => db + 3),
  })),
};
run("level change at full detail", cache.job(level));
for (let i = 1; i <= 5; i++) {
  const moved = {
    ...level,
    sources: level.sources.map((s, j) =>
      j ? s : { ...s, position: { ...s.position, x: s.position.x + i * 0.15 } },
    ),
  };
  run(`move one source preview ${i}`, cache.job(previewRequest(moved)));
}
