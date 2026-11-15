import type { MaterialData } from "./domain.ts";
const reference =
  "https://github.com/LCAV/pyroomacoustics/blob/master/pyroomacoustics/data/materials.json";
function material(
  id: string,
  name: string,
  alpha: number[],
  tl: number[],
): MaterialData {
  return {
    id,
    name,
    absorption: alpha,
    transmissionLossDb: tl,
    evidence: {
      kind: "assumed",
      source: reference,
      note: "Generic absorption reference at 125–8000 Hz; 63 Hz held at 125 Hz. Transmission-loss spectrum is an illustrative engineering assumption, not a tested assembly rating. Material assignment is unverified.",
    },
  };
}
/** Tables are explicit assumptions and can be replaced per surface by measured
 * octave-band laboratory data. Absorption and transmission are separate inputs. */
export const MATERIALS: MaterialData[] = [
  material(
    "plasterboard",
    "Plasterboard partition",
    [0.15, 0.15, 0.1, 0.06, 0.04, 0.04, 0.05, 0.05],
    [12, 17, 23, 29, 34, 38, 40, 42],
  ),
  material(
    "concrete",
    "Concrete wall",
    [0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.05, 0.05],
    [25, 31, 37, 43, 49, 53, 56, 58],
  ),
  material(
    "floor",
    "Concrete floor",
    [0.01, 0.01, 0.03, 0.05, 0.02, 0.02, 0.02, 0.02],
    [30, 36, 42, 48, 54, 58, 60, 62],
  ),
  material(
    "carpet",
    "Carpet over slab",
    [0.09, 0.09, 0.08, 0.21, 0.26, 0.27, 0.37, 0.37],
    [30, 36, 42, 48, 54, 58, 60, 62],
  ),
  material(
    "glass",
    "Single glazing",
    [0.08, 0.08, 0.04, 0.03, 0.03, 0.02, 0.02, 0.02],
    [12, 17, 22, 27, 30, 28, 33, 37],
  ),
  material(
    "door",
    "Solid door",
    [0.14, 0.14, 0.1, 0.06, 0.08, 0.1, 0.1, 0.1],
    [10, 14, 18, 23, 27, 29, 31, 32],
  ),
];
