import {
  OctaveSpectrum,
  type SourceData,
  type Evidence,
} from "./engine/domain.ts";
export type DemoSource = {
  id: string;
  name: string;
  x: number;
  z: number;
  level: number;
  enabled: boolean;
  color: string;
  heightM?: number;
  spectrumDbAt1m?: number[];
  evidence?: Evidence;
  kind?: string;
};
/** Illustrative source shapes only. Real ingestion supplies measured per-octave
 * levels directly, with reference distance converted to 1 metre upstream. */
export function acousticSource(s: DemoSource): SourceData {
  const shapes: Record<string, number[]> = {
    road: [0, 0, -2, -4, -7, -10, -14, -20],
    works: [-5, -3, 0, 0, -2, -5, -8, -12],
    hvac: [0, -1, -4, -7, -11, -16, -22, -28],
  };
  return {
    id: s.id,
    position: { x: s.x, y: s.heightM ?? 1.5, z: s.z },
    enabled: s.enabled,
    spectrumDbAt1m: s.spectrumDbAt1m
      ? [...OctaveSpectrum.normalized(s.level, s.spectrumDbAt1m).values]
      : [
          ...OctaveSpectrum.normalized(
            s.level,
            shapes[s.id] ?? Array(8).fill(0),
          ).values,
        ],
    evidence: s.evidence ?? {
      kind: "assumed",
      source: s.spectrumDbAt1m
        ? "Supplied spectrum (unverified)"
        : "Hush demo profile",
      note: "Omnidirectional point source; not a calibrated traffic emission model",
    },
  };
}
