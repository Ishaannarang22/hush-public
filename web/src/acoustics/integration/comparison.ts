import { displayField, type SpectralField } from "../engine/grid.ts";
import { pointInPolygon } from "../engine/geometry.ts";
import { decibels, energy, type RegionData } from "../engine/domain.ts";
/** Spatial energy mean of the selected receiver slice, always total A-weighted.
 * This is a diagnostic against a room-average model, not automatic calibration. */
export function roomMeans(field: SpectralField | null, regions: RegionData[]) {
  const result: Record<string, number | null> = {};
  if (!field) return result;
  const weighted = displayField(field, "A");
  for (const region of regions) {
    let sum = 0,
      count = 0;
    for (let y = 0; y < field.height; y++)
      for (let x = 0; x < field.width; x++) {
        const index = y * field.width + x;
        if (!field.mask[index]) continue;
        const px = field.minX + ((x + 0.5) * field.spanX) / field.width;
        const pz = field.minZ + ((y + 0.5) * field.spanZ) / field.height;
        if (
          !pointInPolygon(px, pz, region.polygon) ||
          region.holes.some((h) => pointInPolygon(px, pz, h))
        )
          continue;
        sum += energy(weighted.db[index]);
        count++;
      }
    result[region.id] = count ? decibels(sum / count) : null;
  }
  return result;
}
