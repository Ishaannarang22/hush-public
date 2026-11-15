# Export for the simulation (`--export-lab`)

```
python -m noisemodel.predict samples/property.zzvymDx5ty7.json samples/sources.zzvymDx5ty7.json --out samples/levels.zzvymDx5ty7.json --report --export-lab
```

writes two files next to `--out` (or into `--export-dir`). Code: `noisemodel/export_lab.py`. The simulation (`web/src/acoustics/`, `docs/ACOUSTIC-LAB.md`) is not changed.

## `samples/lab_sources.zzvymDx5ty7.json`

Point sources for the simulation, one list per time block (`blocks.overnight`, `morning_rush`, `midday`, `evening_rush`, `evening`; hours in `blockHours`). Every entry has exactly the `SourceData` fields of `web/src/acoustics/engine/domain.ts`:

| Field | Value |
|---|---|
| `id` | `road:<road id>`, the same in every block |
| `position` | `{x, y, z}` in metres, see the frame below |
| `spectrumDbAt1m` | eight unweighted octave-band sound pressure levels at 1 m, 63 Hz to 8 kHz |
| `enabled` | `true` |
| `evidence` | `kind: "derived"`, the model version, block and reference wall, and a note that a point source stands in for a road |

`derivation` gives, per source, the reference wall, the model's level at that wall per block, the distance used, the receiver point, and the levels at the other exposed walls. `omitted` lists sources that could not be placed (aircraft, or a property whose walls have no plan coordinates, such as Yale St).

How each source is made:

1. The model is run with that one source only (`outdoor.wall_levels`), so its level at each exposed wall is the model's own: road emission from counts (R7), time of day (R9), and orientation, barrier, foliage and building-row losses. It is the incident level outside the wall, without the facade reflection.
2. The reference wall is the exposed wall where that source is loudest. The source sits outside the middle of that wall, along the wall's outward normal, at the model's distance from the facade point to the road (24.4 m for S Greenhouse Rd). Height: 1.5 m above the floor (the simulation's default source height in `demo.ts`), lowered by the storeys below the unit.
3. The spectrum has the simulation's own `road` shape from `demo.ts` (0, 0, -2, -4, -7, -10, -14, -20 dB), scaled so that its A-weighted total at 1 m, minus `20 log10(r)`, equals the wall level. `r` is the distance from the source to the receiver point: the middle of the wall at the 1.2 m listening height. The tests check this to 0.1 dB in every block.

## `samples/room_targets.zzvymDx5ty7.json`

This model's per-room predictions, keyed by Matterport room id (`rooms.<id>`), for comparing and calibrating the heat map. For each room: its name, and for each time block the level `dba` and the range `range_dba` (plus or minus 3 dB where the room's exterior windows and doors were measured, 5 otherwise), plus `l24_dba` and the daily score `dnl_dba`. All levels are **A-weighted** equivalent levels (dBA) inside the room, with windows and doors as modelled; `null` means below the 15 dBA reporting floor.

## Coordinate frame

The simulation's scene frame, built by `MatterportSceneImporter` (`engine/importer.ts`): metres, y up, `x` = Matterport plan `x`, `z` = Matterport plan `y`, `y` = model elevation (the scan floor is near 0). The demo sources and the solver grid in `AcousticLab.tsx` use this same frame. `alignPolygon` and the overlay's `flipZ` may mirror `z` only when drawing on the Showcase 3D view; positions here are in the unmirrored solver frame, so they need no change before going into a `GridRequest`.

For this model, plan `+x` points to 354.0 deg and `+y` to 264.1 deg (from saved `geoLocationOf` samples). The exposed walls face 84 deg (east-north-east); the source lies at plan `y` about -32.3 m, outside them.

## Approximations

- A point source stands in for a road, which is a line source: it falls off 6 dB per doubling of distance instead of about 3 to 4.5, so it matches the model only near the reference wall. Walls far along the facade, or around a corner, will read differently in the simulation than in this model; `derivation.other_walls_dba` gives the model's value there.
- The spectrum shape is assumed. No research file gives the band values of the OITC reference transportation spectrum (ASTM E1332) that R3 cites, so the brief's fallback is used: the simulation's `road` profile. Only the A-weighted total comes from the model.
- The source is placed along the wall normal, not on the real bearing to the road (106 deg here, 22 deg off the normal). Shielding by orientation is already in the wall level.
- Aircraft are not exported: a flyover is not a ground point source. None are in this run.
- Room targets include the model's room-to-room coupling, door and window states and absorption. The simulation's heat map is a receiver slice without reverberant build-up, so a level difference between the two is expected before calibration.
