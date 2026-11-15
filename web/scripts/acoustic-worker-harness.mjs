// Runs the actual browser worker protocol in Node for cancellation/cache tests.
import { parentPort } from "node:worker_threads";
globalThis.self = {
  postMessage(message, options) {
    parentPort.postMessage(message, options?.transfer);
  },
};
await import("../src/acoustics/field.worker.ts");
parentPort.on("message", (data) => self.onmessage({ data }));
