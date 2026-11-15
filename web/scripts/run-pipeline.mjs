/** Node 24+. Run from web: npm run model -- --out ../outputs/model-run */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EnvironmentalNoisePipeline } from "../server/pipeline.ts";

const args = process.argv.slice(2),
  flags = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--request", "--out", "--model"].includes(args[i]) || !args[i + 1])
    throw new Error(
      "Usage: npm run model -- --out DIRECTORY [--request INPUT.json] [--model MODEL_ID]",
    );
  flags[args[i]] = args[i + 1];
}
if (!flags["--out"]) throw new Error("Specify --out DIRECTORY");
const request = flags["--request"]
  ? JSON.parse(await readFile(flags["--request"], "utf8"))
  : {};
if (flags["--model"]) request.modelId = flags["--model"];
request.grid ??= {
  resolution: 48,
  receiverHeightM: 1.2,
  reflections: true,
  diffraction: true,
};
const result = await new EnvironmentalNoisePipeline().run(request);
const out = resolve(flags["--out"]);
await mkdir(out, { recursive: true });
await writeFile(
  resolve(out, "run.json"),
  JSON.stringify(result, null, 2) + "\n",
);
if (result.scene) {
  await writeFile(
    resolve(out, "scene.json"),
    JSON.stringify(result.scene, null, 2) + "\n",
  );
  await writeFile(
    resolve(out, "sources.json"),
    JSON.stringify(result.labSources, null, 2) + "\n",
  );
}
const block = request.block ?? "midday";
const rows = Object.values(result.roomTargets.rooms)
  .map(
    (r) =>
      `| ${r.name} | ${r.blocks[block].dba?.toFixed(1) ?? "No modeled energy"} |`,
  )
  .join("\n");
await writeFile(
  resolve(out, "report.md"),
  `# Hush environmental noise run\n\nProperty: ${result.modelId}. ${result.method}. Time: ${block}.\n\n| Room | Predicted dBA |\n| --- | ---: |\n${rows}\n\nEmissions, geometry, material spectra, assumptions and the optional spatial field are in run.json. These are scenario estimates; the combined model has not been validated by the legacy field test.\n\n## Assumptions and coverage\n\n${result.warnings.map((w) => "- " + w).join("\n")}\n\nRun: ${result.runId}. Elapsed: ${result.elapsedMs.toFixed(0)} ms.\n`,
);
console.log(
  `Wrote ${out}/run.json and report.md (${result.elapsedMs.toFixed(0)} ms).`,
);
