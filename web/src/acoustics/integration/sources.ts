import {
  OctaveSpectrum,
  PointSoundSource,
  type SourceData,
} from "../engine/domain.ts";
import type { DemoSource } from "../demo.ts";

export const TIME_BLOCKS = {
  overnight: "Overnight · 00–06",
  morning_rush: "Morning rush · 06–10",
  midday: "Midday · 10–16",
  evening_rush: "Evening rush · 16–20",
  evening: "Evening · 20–24",
} as const;
export type TimeBlock = keyof typeof TIME_BLOCKS;
export type SourceKind =
  | "road"
  | "construction"
  | "aircraft"
  | "rail"
  | "mechanical"
  | "other";
export const SOURCE_COLORS: Record<SourceKind, string> = {
  road: "#edb979",
  construction: "#f47d6b",
  aircraft: "#bda3ff",
  rail: "#9bbaed",
  mechanical: "#72c8c0",
  other: "#d1c9a4",
};
export type EnvironmentalSource = SourceData & {
  kind?: SourceKind;
  name?: string;
};
export type SourceDataset = {
  schemaVersion: 1;
  modelId: string;
  coordinateSystem: "local-meters-y-up";
  blocks: Record<TimeBlock, EnvironmentalSource[]>;
  derivation?: Record<string, { name?: string; mode?: string }>;
  omitted?: string[];
};
/** Provider-neutral adapter. External traffic providers must convert their data
 * into emissions upstream; neither traffic speed nor congestion is a sound level.
 * Sources here are equivalent point emitters for a time block, not flyover tracks. */
export class EnvironmentalSourceAdapter {
  readonly data: SourceDataset;
  constructor(input: unknown, modelId: string) {
    const d = input as SourceDataset;
    if (
      !d ||
      d.schemaVersion !== 1 ||
      d.modelId !== modelId ||
      d.coordinateSystem !== "local-meters-y-up"
    )
      throw new Error(
        "Source file must match this home, version 1, and local-meters-y-up.",
      );
    for (const block of Object.keys(TIME_BLOCKS) as TimeBlock[]) {
      const sources = d.blocks?.[block];
      if (!Array.isArray(sources) || sources.length > 64)
        throw new Error(`Expected 0–64 sources in ${block}.`);
      const ids = new Set<string>();
      for (const source of sources) {
        if (
          typeof source.id !== "string" ||
          !source.id ||
          ids.has(source.id) ||
          typeof source.enabled !== "boolean"
        )
          throw new Error("Invalid or duplicate source.");
        if (
          !source.evidence?.source ||
          !["measured", "derived", "assumed"].includes(source.evidence.kind)
        )
          throw new Error("Every source needs provenance.");
        if (source.kind && !Object.hasOwn(SOURCE_COLORS, source.kind))
          throw new Error("Unknown source kind.");
        ids.add(source.id);
        new PointSoundSource(source);
      }
    }
    this.data = structuredClone(d);
  }
  sources(block: TimeBlock): DemoSource[] {
    return this.data.blocks[block].map((s) => {
      const hint =
        s.kind ?? this.data.derivation?.[s.id]?.mode ?? s.id.split(":")[0];
      const kind: SourceKind = Object.hasOwn(SOURCE_COLORS, hint)
        ? (hint as SourceKind)
        : "other";
      return {
        id: s.id,
        name: s.name ?? this.data.derivation?.[s.id]?.name ?? s.id,
        x: s.position.x,
        z: s.position.z,
        heightM: s.position.y,
        level: new OctaveSpectrum(s.spectrumDbAt1m).totalDb(),
        spectrumDbAt1m: [...s.spectrumDbAt1m],
        enabled: s.enabled,
        evidence: { ...s.evidence },
        kind,
        color: SOURCE_COLORS[kind],
      };
    });
  }
}
