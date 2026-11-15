import type { Plugin } from "vite";
import { EnvironmentalNoisePipeline } from "./pipeline.ts";

/** Local research endpoint. Production hosting needs a backend and authentication. */
export function noisePipelineApi(): Plugin {
  const active = new Set<AbortController>();
  return {
    name: "environmental-noise-pipeline",
    configureServer(server) {
      server.httpServer?.once("close", () => {
        for (const ac of active) ac.abort();
      });
      server.middlewares.use("/api/acoustics/run", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        const fail = (status: number, message: string) => {
          res.statusCode = status;
          res.end(JSON.stringify({ error: message }));
        };
        const host = req.headers.host ?? "";
        if (
          !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
          (req.headers.origin &&
            ![`http://${host}`, `https://${host}`].includes(req.headers.origin))
        ) {
          fail(403, "Local access only");
          return;
        }
        if (req.method !== "POST") {
          fail(405, "Use POST");
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          fail(415, "Expected JSON");
          return;
        }
        if (active.size >= 2) {
          fail(429, "Two calculations are already running; retry shortly.");
          return;
        }
        const ac = new AbortController();
        active.add(ac);
        const timeout = setTimeout(() => ac.abort(), 60_000);
        res.once("close", () => {
          if (!res.writableEnded) ac.abort();
        });
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 1024 * 1024) {
              fail(413, "Request exceeds 1 MB");
              return;
            }
            chunks.push(chunk);
          }
          const request = JSON.parse(Buffer.concat(chunks).toString());
          const result = await new EnvironmentalNoisePipeline().run(
            request,
            ac.signal,
          );
          if (!res.destroyed) res.end(JSON.stringify(result));
        } catch (error) {
          if (!res.destroyed)
            fail(
              ac.signal.aborted ? 408 : 400,
              error instanceof Error ? error.message : "Calculation failed",
            );
        } finally {
          clearTimeout(timeout);
          active.delete(ac);
        }
      });
    },
  };
}
