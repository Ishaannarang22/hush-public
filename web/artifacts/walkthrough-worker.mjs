import {
  AcousticScene,
  GeometricAcousticSolver,
} from "../src/acoustics/engine/solver.ts";
import { AcousticGridJob } from "../src/acoustics/engine/grid.ts";
let generation = 0;
self.onmessage = async ({ data }) => {
  const current = ++generation;
  try {
    const solver = new GeometricAcousticSolver(new AcousticScene(data.scene));
    const job = new AcousticGridJob(solver, data.request);
    while (!job.step(1)) {
      await new Promise((r) => setTimeout(r, 0));
      if (current !== generation) return;
    }
    self.postMessage({ id: data.id, field: job.field });
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e) });
  }
};
