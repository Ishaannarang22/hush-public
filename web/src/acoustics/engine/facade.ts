import { AcousticMaterial, decibels } from "./domain.ts";
export type FacadeOpening = {
  id: string;
  widthM: number;
  heightM: number;
  open: boolean;
  material: AcousticMaterial;
};
/** Diffuse-field composite transmission for measured facade areas. This can
 * consume width/height-only surveys without inventing spatial coordinates.
 * It is a facade reduction index, not an indoor SPL prediction or a grid. */
export class FacadeAssembly {
  readonly areaM2: number;
  readonly wall: AcousticMaterial;
  readonly openings: FacadeOpening[];
  constructor(
    widthM: number,
    heightM: number,
    wall: AcousticMaterial,
    openings: FacadeOpening[],
  ) {
    if (
      !Number.isFinite(widthM) ||
      !Number.isFinite(heightM) ||
      widthM <= 0 ||
      heightM <= 0
    )
      throw new Error("Invalid facade dimensions");
    this.areaM2 = widthM * heightM;
    this.wall = wall;
    this.openings = openings;
    for (const o of openings)
      if (
        !Number.isFinite(o.widthM) ||
        !Number.isFinite(o.heightM) ||
        o.widthM <= 0 ||
        o.heightM <= 0
      )
        throw new Error("Invalid facade opening dimensions");
    if (this.openingAreaM2 > this.areaM2)
      throw new Error("Opening area exceeds facade area");
  }
  get openingAreaM2() {
    return this.openings.reduce((sum, o) => sum + o.widthM * o.heightM, 0);
  }
  transmissionLossDb() {
    return this.wall.transmission.map(
      (t, b) =>
        -decibels(
          ((this.areaM2 - this.openingAreaM2) * t +
            this.openings.reduce(
              (sum, o) =>
                sum +
                o.widthM *
                  o.heightM *
                  (o.open ? 1 : o.material.transmission[b]),
              0,
            )) /
            this.areaM2,
        ),
    );
  }
}
