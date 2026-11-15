import { AcousticScene, GeometricAcousticSolver } from "./engine/solver.ts";
import {
  AcousticTransferCache,
  previewRequest,
  type CachedAcousticGridJob,
} from "./engine/cache.ts";
import type { GridRequest } from "./engine/grid.ts";
import type { SceneData } from "./engine/domain.ts";
type Compute = {
  type: "compute";
  id: number;
  revision: number;
  request: GridRequest;
};
let cache: AcousticTransferCache | null = null;
let revision = -1,
  epoch = 0;
let latest: Compute | null = null;
let running: "preview" | "detail" | null = null;
let refineTimer: ReturnType<typeof setTimeout> | undefined;
// Yield to incoming input without nested timer clamping between every chunk.
// https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
const channel = new MessageChannel();
const tasks: (() => void)[] = [];
channel.port1.onmessage = () => tasks.shift()?.();
function yieldTask(task: () => void) {
  tasks.push(task);
  channel.port2.postMessage(null);
}

function reset() {
  epoch++;
  latest = null;
  running = null;
  clearTimeout(refineTimer);
}
function fail(error: unknown, id?: number) {
  running = null;
  self.postMessage({
    type: "error",
    revision,
    id,
    error: error instanceof Error ? error.message : "Calculation failed",
  });
  if (latest) startPreview();
}
function run(message: Compute, phase: "preview" | "detail", q: GridRequest) {
  const token = epoch;
  let job: CachedAcousticGridJob;
  try {
    job = cache!.job(q);
  } catch (e) {
    fail(e, message.id);
    return;
  }
  running = phase;
  const tick = () => {
    if (token !== epoch) return;
    try {
      const done = job.step(24);
      if (!done) {
        if (phase === "detail")
          self.postMessage({
            type: "progress",
            revision,
            id: message.id,
            progress: job.progress,
          });
        yieldTask(tick);
        return;
      }
      const result = job.field;
      const complete =
        phase === "detail" ||
        (q.width === message.request.width &&
          q.height === message.request.height);
      self.postMessage(
        {
          type: "result",
          revision,
          id: message.id,
          phase: complete ? "detail" : "preview",
          result,
          stats: job.stats,
        },
        {
          transfer: [
            result.real.buffer,
            result.imaginary.buffer,
            result.db.buffer,
            result.mask.buffer,
            result.bandDb.buffer,
            result.directDb.buffer,
            result.reflectedDb.buffer,
            result.diffractedDb.buffer,
          ],
        },
      );
      running = null;
      if (latest) {
        startPreview();
        return;
      }
      if (!complete)
        refineTimer = setTimeout(() => {
          if (token === epoch && !running && !latest)
            run(message, "detail", message.request);
        }, 180);
    } catch (e) {
      fail(e, message.id);
    }
  };
  tick();
}
function startPreview() {
  if (!latest || !cache) return;
  const message = latest;
  latest = null;
  if (cache.canReuse(message.request)) run(message, "detail", message.request);
  else run(message, "preview", previewRequest(message.request));
}
self.onmessage = (event) => {
  const message = event.data as
    | { type: "scene"; scene: SceneData; revision: number }
    | Compute
    | { type: "cancel" };
  if (message.type === "cancel") {
    reset();
    return;
  }
  if (message.type === "scene") {
    reset();
    revision = message.revision;
    try {
      cache = new AcousticTransferCache(
        new GeometricAcousticSolver(new AcousticScene(message.scene)),
      );
      self.postMessage({ type: "ready", revision });
    } catch (e) {
      cache = null;
      fail(e);
    }
    return;
  }
  if (message.revision !== revision) return;
  if (!cache) {
    fail(new Error("Scene is not ready"), message.id);
    return;
  }
  clearTimeout(refineTimer);
  latest = message;
  // Finish the small live preview so continuous dragging cannot starve the
  // renderer. Keep only the newest queued input; abandon obsolete refinement.
  if (running === "preview") return;
  if (running === "detail") {
    epoch++;
    running = null;
  }
  startPreview();
};
