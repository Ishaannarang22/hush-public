import { parentPort, workerData } from "node:worker_threads";
import {
  AcousticScene,
  GeometricAcousticSolver,
} from "../src/acoustics/engine/solver.ts";
import { AcousticGridJob } from "../src/acoustics/engine/grid.ts";
const solver = new GeometricAcousticSolver(new AcousticScene(workerData.scene));
parentPort.on("message", ({ tile, request }) => {
  try {
    const job = new AcousticGridJob(solver, request);
    while (!job.step(8)) {}
    const f = job.field;
    parentPort.postMessage(
      {
        tile,
        width: f.width,
        height: f.height,
        bounds: request.bounds,
        cells: f.cells,
        elapsedMs: f.elapsedMs,
        mask: f.mask,
        bandDb: f.bandDb,
      },
      [f.mask.buffer, f.bandDb.buffer],
    );
  } catch (e) {
    parentPort.postMessage({ error: e.message });
  }
});
