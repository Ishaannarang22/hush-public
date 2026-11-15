import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  MatterportSceneImporter,
  parseOpeningDataset,
  type ImportOptions,
  type OpeningMeasurement,
} from "../src/acoustics/engine/importer.ts";
import {
  AcousticScene,
  GeometricAcousticSolver,
} from "../src/acoustics/engine/solver.ts";
import { AcousticGridJob, displayField } from "../src/acoustics/engine/grid.ts";
import {
  EnvironmentalSourceAdapter,
  TIME_BLOCKS,
  type SourceDataset,
  type TimeBlock,
} from "../src/acoustics/integration/sources.ts";
import type { ApiRoom } from "../src/acoustics/matterport.ts";
import {
  RoomEnergyModel,
  type EnergyProperty,
  type OutdoorWall,
} from "./room-energy.ts";

export type PipelineRequest = {
  modelId?: string;
  sourceInputs?: Record<string, unknown>;
  /** Unit profile edits (docs/UNIT_PROFILE.md); passed through to noisemodel.pipeline. */
  edits?: unknown[] | { schemaVersion: number; edits: unknown[] };
  buildingEdits?: unknown[] | { schemaVersion: number; edits: unknown[] };
  openings?: OpeningMeasurement[];
  scenario?: Partial<ImportOptions>;
  block?: TimeBlock;
  grid?: {
    resolution?: number;
    receiverHeightM?: number;
    reflections?: boolean;
    diffraction?: boolean;
  };
};
type StageResult = {
  modelId: string;
  property: EnergyProperty;
  rooms: ApiRoom[];
  survey: { openings: OpeningMeasurement[] } | null;
  labSources: SourceDataset;
  referenceTargets: unknown;
  outdoor: OutdoorWall[];
  warnings: string[];
  inputHash: string;
  emissionElapsedMs: number;
  sourceShapes: Record<string, number[]>;
  incidenceDb: number;
  [key: string]: unknown;
};
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** A fixed local process boundary; requests cannot specify programs or file paths. */
export function emissionStage(
  request: PipelineRequest,
  signal?: AbortSignal,
): Promise<StageResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.HUSH_PYTHON ?? "python3",
      ["-m", "noisemodel.pipeline"],
      {
        cwd: ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        signal,
        timeout: 30_000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      },
    );
    const chunks: Buffer[] = [];
    let bytes = 0,
      stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) {
        child.kill();
        reject(new Error("Model output exceeded 16 MB"));
      } else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", (code) => {
      try {
        const result = JSON.parse(Buffer.concat(chunks).toString());
        if (code !== 0 || result.error)
          throw new Error(result.error ?? "Emission model failed");
        resolve(result);
      } catch (error) {
        reject(
          new Error(
            error instanceof Error
              ? error.message
              : stderr || "Emission model failed",
          ),
        );
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

/** Reusable orchestrator: source providers -> emission model -> scene -> room balance -> optional grid. */
export class EnvironmentalNoisePipeline {
  async run(request: PipelineRequest = {}, signal?: AbortSignal) {
    if (!request || typeof request !== "object" || Array.isArray(request))
      throw new Error("Expected a request object");
    const started = performance.now(),
      block = request.block ?? "midday";
    if (!Object.hasOwn(TIME_BLOCKS, block))
      throw new Error("Unknown time block");
    const resolution = request.grid?.resolution ?? 24;
    if (!Number.isInteger(resolution) || resolution < 4 || resolution > 96)
      throw new Error("Grid resolution must be 4–96");
    const stage = await emissionStage(request, signal);
    signal?.throwIfAborted();
    const adapter = new EnvironmentalSourceAdapter(
      stage.labSources,
      stage.modelId,
    );
    const signature = createHash("sha256")
      .update(
        JSON.stringify({
          inputs: stage.inputHash,
          scenario: request.scenario,
          grid: request.grid,
          block,
        }),
      )
      .digest("hex");
    if (!stage.rooms.length)
      return {
        ...stage,
        runId: signature,
        generatedAt: new Date().toISOString(),
        roomTargets: stage.referenceTargets,
        method: "legacy broadband reference only",
        scene: null,
        grid: null,
        elapsedMs: performance.now() - started,
      };
    const options: ImportOptions = {
      wallMaterial: "plasterboard",
      floorMaterial: "floor",
      windowMaterial: "glass",
      doorsOpen: true,
      windowsOpen: false,
      assumedHeightM: 2.7,
      floorId: stage.rooms[0].floor?.id ?? "default",
      ...request.scenario,
    };
    for (const key of ["doorsOpen", "windowsOpen"] as const)
      if (typeof options[key] !== "boolean") throw new Error(`Invalid ${key}`);
    if (
      !Number.isFinite(options.assumedHeightM) ||
      options.assumedHeightM <= 0 ||
      options.assumedHeightM > 100
    )
      throw new Error("Invalid assumed room height");
    const openings = parseOpeningDataset(
      JSON.stringify({
        schemaVersion: 1,
        units: "meters",
        modelId: stage.modelId,
        openings: stage.survey?.openings ?? [],
      }),
      stage.modelId,
    ).openings;
    // Survey state is explicit when supplied; otherwise measured glass doors and windows start closed.
    if (!request.openings)
      for (const o of openings)
        o.state =
          o.kind === "window"
            ? options.windowsOpen
              ? "open"
              : "closed"
            : "closed";
    if (
      !stage.rooms.some((r) => (r.floor?.id ?? "default") === options.floorId)
    )
      throw new Error("No rooms on the requested floor");
    const imported = new MatterportSceneImporter().import(
      stage.modelId,
      stage.rooms,
      options,
      openings,
    );
    if (!imported.scene.regions.length)
      throw new Error("No rooms on the requested floor");
    const roomStarted = performance.now();
    const roomTargets = new RoomEnergyModel(imported.scene).run(
      stage.property,
      stage.rooms,
      stage.outdoor,
      Object.keys(TIME_BLOCKS),
      stage.incidenceDb,
      stage.sourceShapes,
    );
    const roomElapsedMs = performance.now() - roomStarted;
    let grid = null;
    if (request.grid) {
      const pts = imported.scene.regions.flatMap((r) => r.polygon);
      const xs = pts.map((p) => p.x),
        zs = pts.map((p) => p.z);
      const bounds = {
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
        spanX: Math.max(...xs) - Math.min(...xs),
        spanZ: Math.max(...zs) - Math.min(...zs),
      };
      const job = new AcousticGridJob(
        new GeometricAcousticSolver(new AcousticScene(imported.scene)),
        {
          bounds,
          width: resolution,
          height: resolution,
          receiverHeightM: request.grid.receiverHeightM ?? 1.2,
          floorId: options.floorId,
          sources: adapter.data.blocks[block],
          options: {
            reflections: request.grid.reflections ?? true,
            diffraction: request.grid.diffraction ?? true,
          },
        },
      );
      while (!job.step(1)) {
        signal?.throwIfAborted();
        await new Promise((resolve) => setImmediate(resolve));
      }
      const field = displayField(job.field, "A");
      grid = {
        ...field,
        db: Array.from(field.db),
        mask: Array.from(field.mask),
        bandDb: Array.from(field.bandDb),
        directDb: Array.from(field.directDb),
        reflectedDb: Array.from(field.reflectedDb),
        diffractedDb: Array.from(field.diffractedDb),
        real: undefined,
        imaginary: undefined,
        weighting: "A",
        units: "dBA",
        block,
        note: "Receiver-height slice; -120 dB is the numerical silence floor. Mask=0 is outside rooms. Aircraft events are excluded from this grid.",
      };
    }
    return {
      ...stage,
      runId: signature,
      generatedAt: new Date().toISOString(),
      scenario: options,
      openings,
      roomTargets,
      method: roomTargets.method,
      scene: imported.scene,
      counts: imported.counts,
      grid,
      warnings: [
        ...stage.warnings,
        ...imported.warnings,
        ...roomTargets.assumptions,
      ],
      coverage: {
        roomBalance: Object.keys(stage.sourceShapes),
        gridSourceIds: adapter.data.blocks[block].map((s) => s.id),
        omitted: adapter.data.omitted ?? [],
      },
      timings: {
        emissionsMs: stage.emissionElapsedMs,
        roomBalanceMs: roomElapsedMs,
        gridMs: grid?.elapsedMs ?? null,
      },
      elapsedMs: performance.now() - started,
    };
  }
}
