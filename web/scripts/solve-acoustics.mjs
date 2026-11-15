/** Streaming multi-core batch runner. No browser, credentials, or network needed.
 * node scripts/solve-acoustics.mjs scene.json request.json output.ndjson [workers=2] [tile=32] */
import fs from "node:fs";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import {
  AcousticScene,
  GeometricAcousticSolver,
} from "../src/acoustics/engine/solver.ts";
import { AcousticGridJob } from "../src/acoustics/engine/grid.ts";
const [sceneFile, requestFile, outFile, workersArg = "2", tileArg = "32"] =
  process.argv.slice(2);
if (!outFile)
  throw new Error(
    "Usage: node scripts/solve-acoustics.mjs scene.json request.json output.ndjson [workers] [tile]",
  );
const scene = JSON.parse(fs.readFileSync(sceneFile, "utf8")),
  request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
const count = Number(workersArg),
  size = Number(tileArg);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > availableParallelism() ||
  !Number.isInteger(size) ||
  size < 1 ||
  size > 256
)
  throw new Error(
    "Worker count must fit local CPU capacity; tile size is 1–256",
  );
if (
  !Number.isInteger(request.width) ||
  !Number.isInteger(request.height) ||
  request.width < 1 ||
  request.height < 1
)
  throw new Error("Invalid full grid dimensions");
new AcousticGridJob(new GeometricAcousticSolver(new AcousticScene(scene)), {
  ...request,
  width: Math.min(size, request.width),
  height: Math.min(size, request.height),
});
const out = fs.createWriteStream(outFile, { flags: "wx" });
await once(out, "open");
const write = async (value) => {
  if (!out.write(JSON.stringify(value) + "\n")) await once(out, "drain");
};
await write({
  schemaVersion: 1,
  modelId: scene.id,
  bandsHz: [63, 125, 250, 500, 1000, 2000, 4000, 8000],
  request,
  assumptions: scene.assumptions,
  tileSize: size,
});
const workers = [],
  columns = Math.ceil(request.width / size),
  total = columns * Math.ceil(request.height / size);
let next = 0,
  completed = 0;
// Results stream in completion order with integer offsets. Memory is bounded by
// worker count × tile size, not by total property area or receiver-grid size.
try {
  await Promise.all(
    Array.from({ length: Math.min(count, total) }, async () => {
      const worker = new Worker(
        new URL("./acoustic-tile-worker.mjs", import.meta.url),
        { workerData: { scene } },
      );
      workers.push(worker);
      while (next < total) {
        const id = next++,
          x = (id % columns) * size,
          y = Math.floor(id / columns) * size,
          width = Math.min(size, request.width - x),
          height = Math.min(size, request.height - y),
          b = request.bounds;
        const tileRequest = {
          ...request,
          width,
          height,
          bounds: {
            minX: b.minX + (x / request.width) * b.spanX,
            minZ: b.minZ + (y / request.height) * b.spanZ,
            spanX: (width / request.width) * b.spanX,
            spanZ: (height / request.height) * b.spanZ,
          },
        };
        const reply = once(worker, "message");
        worker.postMessage({ tile: { id, x, y }, request: tileRequest });
        const [result] = await reply;
        if (result.error) throw new Error(result.error);
        await write({
          ...result,
          mask: Array.from(result.mask),
          bandDb: Array.from(result.bandDb),
        });
        completed++;
      }
    }),
  );
  await write({ complete: true, tiles: completed });
  out.end();
  await once(out, "finish");
  console.log(
    `Completed ${completed} tiles with ${workers.length} local workers.`,
  );
} finally {
  await Promise.all(workers.map((w) => w.terminate()));
  out.destroy();
}
