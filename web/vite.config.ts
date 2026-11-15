import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { noisePipelineApi } from "./server/api.ts";
import { neighborhoodApi } from "./server/neighborhood.ts";
import { vexcelNeighborhoodApi } from "./server/vexcel.ts";
import { vehicleDataApi } from "./server/vehicle-data.ts";

function matterportLocalApi(env: Record<string, string>): Plugin {
  return {
    name: "matterport-local-api",
    configureServer(server) {
      server.middlewares.use("/api/property-context", async (req, res) => {
        const host = req.headers.host ?? "";
        if (
          !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
          (req.headers.origin &&
            !["http://" + host, "https://" + host].includes(req.headers.origin))
        ) {
          res.statusCode = 403;
          res.end("{}");
          return;
        }
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("{}");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        try {
          const data = JSON.parse(
            await readFile(
              resolve(
                process.cwd(),
                "../work/costar-kit/selected-acoustic-context.json",
              ),
              "utf8",
            ),
          );
          const properties = (data.properties ?? [])
            .filter((p: { matterportModelId: string }) =>
              ["zzvymDx5ty7", "D9CVkjeMoQx"].includes(p.matterportModelId),
            )
            .slice(0, 2)
            .map(
              (p: {
                matterportModelId: string;
                name: string;
                stories: number;
                constructionMaterial: string;
              }) => ({
                matterportModelId: p.matterportModelId,
                name: p.name,
                stories: p.stories,
                constructionMaterial: p.constructionMaterial,
              }),
            );
          res.end(JSON.stringify({ properties }));
        } catch {
          res.end(JSON.stringify({ properties: [] }));
        }
      });

      server.middlewares.use("/api/matterport", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        const host = req.headers.host ?? "";
        const origin = req.headers.origin;
        if (
          !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
          (origin &&
            origin !== `http://${host}` &&
            origin !== `https://${host}`)
        ) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Local access only" }));
          return;
        }
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("{}");
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/config") {
          res.end(
            JSON.stringify({
              sdkKey:
                env.MATTERPORT_SDK_KEY || env.VITE_MATTERPORT_SDK_KEY || "",
            }),
          );
          return;
        }
        if (!env.MATTERPORT_API_KEY || !env.MATTERPORT_API_TOKEN) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error: "Start the local server with Matterport API credentials.",
            }),
          );
          return;
        }
        let query: string;
        let variables: Record<string, string> = {};
        if (url.pathname === "/models") {
          query = 'query { models(query:"*") { results { id name } } }';
        } else if (
          url.pathname === "/model" &&
          /^[a-zA-Z0-9]{8,20}$/.test(url.searchParams.get("id") ?? "")
        ) {
          variables = { id: url.searchParams.get("id")! };
          query =
            "query($id:ID!) { model(id:$id) { id name rooms { id label floor { id sequence label } dimensions { height units } dimensionEstimates { height lowerElevation units } boundary { edges { id type thickness openings { id type width height lowerElevation relativeCenter } vertices { position { x y } } } } holes { edges { id type thickness openings { id type width height lowerElevation relativeCenter } vertices { position { x y } } } } } } }";
        } else {
          res.statusCode = 404;
          res.end("{}");
          return;
        }
        try {
          const response = await fetch(
            "https://api.matterport.com/api/models/graph",
            {
              method: "POST",
              signal: AbortSignal.timeout(20000),
              headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(`${env.MATTERPORT_API_KEY}:${env.MATTERPORT_API_TOKEN}`).toString("base64")}`,
              },
              body: JSON.stringify({ query, variables }),
            },
          );
          if (!response.ok)
            throw new Error(`Matterport returned HTTP ${response.status}`);
          const body = (await response.json()) as {
            errors?: { message: string }[];
            data?: unknown;
          };
          if (body.errors?.length)
            throw new Error(
              body.errors.map((e: { message: string }) => e.message).join("; "),
            );
          res.end(JSON.stringify(body.data));
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Matterport is unavailable",
            }),
          );
        }
      });
    },
  };
}
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    noisePipelineApi(),
    vehicleDataApi({ ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string,string>),
    neighborhoodApi({ ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string,string>),
    vexcelNeighborhoodApi({ ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string,string>),
    matterportLocalApi({
      ...loadEnv(mode, process.cwd(), ""),
      ...process.env,
    } as Record<string, string>),
  ],
  server: { host: "localhost", fs: { allow: [".."] } },
}));
