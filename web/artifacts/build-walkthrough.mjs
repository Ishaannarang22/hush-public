import { rolldown } from "rolldown";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EnvironmentalNoisePipeline } from "../server/pipeline.ts";
const here = fileURLToPath(new URL("./", import.meta.url));
async function bundle(name) {
  const b = await rolldown({ input: here + name, platform: "browser" });
  const out = await b.generate({ format: "iife", minify: true });
  await b.close();
  return out.output[0].code.replace(/<\/script/gi, "<\\/script");
}
const pipeline = new EnvironmentalNoisePipeline();
const demo = JSON.parse(
  await readFile(
    new URL("../../samples/pipeline.environmental-demo.json", import.meta.url),
    "utf8",
  ),
);
delete demo.grid;
const pack = (r) => ({
  modelId: r.modelId,
  property: r.property,
  rooms: r.rooms,
  openings: r.openings,
  outdoor: r.outdoor,
  labSources: r.labSources,
  sourceShapes: r.sourceShapes,
  incidenceDb: r.incidenceDb,
});
const data = {
  builtAt: new Date().toISOString(),
  traffic: pack(await pipeline.run({})),
  multi: pack(await pipeline.run(demo)),
};
let html = await readFile(here + "model-walkthrough.html", "utf8");
html = html
  .replace("__DATA__", JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("__WORKER__", await bundle("walkthrough-worker.mjs"))
  .replace("__BUNDLE__", await bundle("walkthrough.mjs"));
const dest = process.argv[2];
if (!dest) throw Error("Pass an HTML output path");
await mkdir(dirname(resolve(dest)), { recursive: true });
await writeFile(dest, html);
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/model-walkthrough.html", import.meta.url),
  html,
);
console.log(
  `Built ${dest} (${Math.round(Buffer.byteLength(html) / 1024)} KiB); preview /model-walkthrough.html`,
);
