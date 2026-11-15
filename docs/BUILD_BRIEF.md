# Build brief: the noise model (demo scope, general loader)

For the agent that writes the code. Owner and reviewer: Alejandro.
Branch from `noise-model`. Everything you need is already on that branch.

## 1. What we are building, and what we are not

**Goal.** A small Python model that predicts how loud each room of one real home is, at
each time of day, and explains why. It has to be convincing as a prediction model. It
does not have to be a product.

**In scope.**
- The physics, end to end, for one property: Matterport model `zzvymDx5ty7`, the
  apartment the team's simulation on `main` already displays (`/lab` route).
- A loader that turns a saved Matterport Model API response into the model's input
  automatically, so the same code works on any scan that has room outlines.
- An export that the simulation on `main` can read.
- A clear printed report, a `levels.json`, tests, and a validation against measured rooms.

**Out of scope. Do not build these.**
- Calling any API from inside the model. The model reads saved files only. Fetching
  the Matterport response for `zzvymDx5ty7` once, and saving it to `samples/`, is a
  one-time setup step, not part of the model.
- A web server or any frontend. Do not change anything under `web/`.
- More properties. One optional second example is described in section 5.

If real data for something is missing, type in the value from the research file that
measured or derived it and record the source in the input file. Do not invent values.
The team rule is real data only: no made-up traffic, flights or construction sites in
the demo files. Made-up inputs are allowed in unit tests only.

## 2. Read these first, in this order

| File | Use it for |
|---|---|
| `SOUND_MODEL.md` | The equations and the worked example. This is the spec |
| `research/V1-review.md` | The reviewer's fixes to the spec. Section 4 below says which to apply |
| `assumptions.yaml` | Every number. Code reads numbers only from here |
| `research/R7-road-emission.md` | Road noise from traffic counts (equations E1 to E6) |
| `research/R9-time-blocks.md` | Share of traffic in each of the five time blocks |
| `research/R8-aircraft.md` | Aircraft event levels, the 737-800 fallback table, block Leq |
| `research/R10-window-geometry.md` and `research/R10-scripts/` | How to find compass north and measure windows from a scan |
| `docs/ACOUSTIC-LAB.md` and `web/src/acoustics/` | The team's simulation: its Matterport fields, its input types, its opening-survey shape |
| `research/R6-validation.md` | Nine measured US rooms to validate against |
| `research/R1` to `R5` | Background behind the spec. Read when a value is unclear |
| `docs/NOISE_MODEL_PLAN.md` section 1 | The proposed shapes of the three JSON files |

Where two documents disagree, the order of authority is: this brief, then
`research/V1-review.md`, then the newer research (R7 to R10), then `SOUND_MODEL.md`,
then the plan.

## 3. Deliverables

```
noisemodel/
  db.py            dB helpers (energy sum, energy mean)
  assumptions.py   loads assumptions.yaml, supports overrides by key
  outdoor.py       level at each exterior wall, per source, per hour
  facade.py        composite wall, window, door and leak; wall to room
  rooms.py         coupled room-to-room solve
  report.py        dominant path, fixes, DNL, flags, ranges
  matterport.py    saved Matterport Model API JSON to property.json, section 5
  export_lab.py    files for the simulation on main, section 7a
  predict.py       predict(property, sources, overrides=None) -> dict, and a command line
tests/
samples/matterport_model_zzvymDx5ty7.json   raw saved API response (no keys)
samples/windows.zzvymDx5ty7.json            the window survey, section 5
samples/property.zzvymDx5ty7.json           built by matterport.py, section 5
samples/sources.zzvymDx5ty7.json            hand-written, section 6
samples/levels.zzvymDx5ty7.json             the model's output
samples/lab_sources.zzvymDx5ty7.json        for the simulation, section 7a
samples/room_targets.zzvymDx5ty7.json       for the simulation, section 7a
docs/DEMO_RESULTS.md            the printed report, section 7
docs/VALIDATION.md              predicted versus measured, section 8
```

Python 3.9 compatible. Dependencies: `numpy`, `pyyaml`, `pytest` only. The whole run must
take under two seconds:

```
python -m noisemodel.predict samples/property.zzvymDx5ty7.json samples/sources.zzvymDx5ty7.json --out samples/levels.zzvymDx5ty7.json --report --export-lab
```

`--set key=value` (repeatable) overrides any assumption or input for what-if runs, for
example `--set window.bed1-n.type=laminated_acoustic`.

## 4. Decisions already made (do not reopen these)

**From the review (`research/V1-review.md`). Apply all of these.**

| Review item | Decision |
|---|---|
| 2a shielding stack | On one wall use either the building-row term or the orientation term, never both. Cap the total of orientation, barrier, foliage and rows at 25 dB |
| 2b berm | Drop berms. Walls only |
| 2c open window | Keep the spec's rule. Note it as a modelling choice in the report |
| 3b missing values | Add the five missing keys to `assumptions.yaml` |
| 3c wrong labels | Correct the seven status labels the review lists |
| 4b all-glass wall | Apply the review's leak cap as written. Mark it `placeholder` |
| 5a DNL bias | Compute everything on 24 hourly values. Blocks are energy means of their hours. DNL comes from the hourly values |
| 5b below the map floor | No log of zero. Report `null` with a note |
| 5c window bigger than wall | Clamp, and add a warning to the output |
| 5d rail and construction bearing | Rail uses the nearest rail line. Construction uses the bearing to the site |
| 5g rush quieter than midday | Solved by using the R9 shares below |

**From the newer research.**

- **Road noise is computed from traffic counts, not read from the BTS map.** Use R7:
  TNM emission levels inside the RD-77-108 closed-form propagation, segment by segment,
  distance clamped at 15 m. R7 found the BTS map can read more than 10 dB too low a
  short way from a road, so the map is reported only as a comparison (`checks`), never
  used as the answer.
- **Time of day.** Hourly volume is the daily count times the R9 hourly share. Use the
  arterial table for ordinary streets and the freeway table for freeways. Apply R9's
  truck-share-by-hour values where R9 gives them.
- **Aircraft.** Use R8: closest point of approach, the ANP noise-versus-distance table,
  block Leq from summed event exposure. Unknown type means the 737-800 fallback table.
  `peak_dba` is the loudest single event after it passes through the facade. Aircraft
  ignore wall facing, barriers and trees, and use the facade ratings minus 3.
- **Windows come from a survey file, not a blanket assumption.** See section 5. The
  15% rule stays in the code only as the fallback when a wall has no survey entry.
- **Range.** Plus or minus 3 dB for rooms whose windows are measured, plus or minus 5 dB
  otherwise.

## 5. The demo property, and the loader that makes this general

**Demo property:** Matterport model `zzvymDx5ty7`. For this model the Model API returns
what it did not return for Yale St: each room's boundary edges with vertices and wall
thickness, and openings (doorways and other openings) with width, height, lower
elevation and position along the wall. The simulation on `main` already reads it; see
`web/src/acoustics/matterport.ts` (`ApiRoom`, `ApiEdge`, `ApiOpening`, `roomPolygon`)
and `web/src/acoustics/engine/importer.ts` for the exact fields and unit handling.
Use the same field names. Do not guess any.

**Step 1. Save the raw response once.** Fetch the model with the same query the
simulation uses and save it as `samples/matterport_model_zzvymDx5ty7.json`. Include the
address and geocoordinates. No keys in the file. From then on the model reads only this
file.

**Step 2. `noisemodel/matterport.py` builds `property.json` from it.** This is the
general part. It must work on any saved response that has room boundaries, with no
property-specific code.

- **Rooms:** id (keep the Matterport room id), label or type tag, floor polygon stitched
  from the boundary edges, floor area from the polygon, height (use the documented
  fallback and flag it when a height is missing), volume.
- **Partitions:** an edge shared by two rooms is a partition between them. Area is edge
  length times height. A doorway or opening on that edge becomes the partition's door or
  open aperture, with its real width and height.
- **Exterior walls:** an edge that belongs to exactly one room is a boundary wall. Its
  azimuth comes from the edge direction and the model's compass bearing. Get the bearing
  the way R10 did (`geoLocationOf` on the origin and two axis points, saved in the raw
  file), not from the rotation quaternion.
- **Units:** follow the simulation's importer. ACOUSTIC-LAB.md notes that some
  dimensional fields are declared imperial while vector edges and openings are already
  in metres.
- **Boundary wall exposure.** In an apartment a boundary wall may face outdoors, a
  neighbour, or a corridor. The scan cannot tell. Each boundary wall gets
  `exposure: "outdoor" | "not_outdoor" | "unknown"`. Default rule: a boundary wall with
  a surveyed window is `outdoor`; a boundary wall carrying the entry door is
  `not_outdoor`; the rest are `unknown` and are treated as not exposed, with a warning
  that lists them. Any wall's exposure can be set in the survey file.

**Step 3. The window survey: `samples/windows.zzvymDx5ty7.json`.** Windows are not
labelled in this model's API response. Use the opening-import shape the simulation
already accepts (documented in `docs/ACOUSTIC-LAB.md`: `schemaVersion`, `modelId`,
`units`, and `openings` with `id`, `wallId`, `kind`, `centerFraction`, `widthM`,
`heightM`, `lowerElevationM`, `evidence`). One file then feeds both the simulation and
this model. Add two optional fields this model reads and the simulation can ignore:
`glazing` (a window type from `assumptions.yaml`) and `operable` (true or false).

Fill it by looking at the scan: the R10 elevation-render method
(`research/R10-scripts/`) if the MatterPak for this model is available, otherwise by
measuring in the Matterport viewer. Mark every entry `evidence.kind: "measured"` with
how it was measured, or `"assumed"` if it was estimated by eye. Do not carry
measurements over from Yale St. A wall with no survey entry and `exposure: "outdoor"`
falls back to the 15% rule and is listed in the report.

**Step 4. Year built and construction.** Unknown unless the raw response gives them. Use
the `2000 onward` defaults marked `assumed`, overridable from the command line.

**Optional second example, only if everything else is finished.** 2125 Yale St
(`D9CVkjeMoQx`), written by hand from `samples/R10_yale_*.csv`. It is the only property
with fully measured windows, so it is a useful second data point. It is not required.

## 6. The demo sources: `samples/sources.zzvymDx5ty7.json`

Write it by hand in the shape of plan section 1.2. Every value needs a `source` note.
Looking values up once to write this file is fine. The model itself never fetches.

- **Location.** Take the address and coordinates from the saved Matterport response.
  State the city. R9's time-of-day shares and R7's truck split are Texas data: if the
  property is not in Texas, use them anyway, and flag it in the report as an assumption.
- **Roads.** The nearest counted roads within 300 m, each with a daily count, truck
  share and speed from a public count source (for Houston, the TxDOT sources R7 used),
  as a short polyline. Give the station or record id for each count.
- **Aircraft.** Only if R8's data covers this location. Otherwise leave `flights`
  empty, put the BTS aviation value in `outdoor_levels_dba` as the simple form, and
  say so.
- **Construction.** Leave empty unless a real active site is known.
- **Trees and barriers.** None unless a saved data file supports a value.

## 7. The report: `docs/DEMO_RESULTS.md`

Generated by `--report`, then committed. It is what the judges and the team read, so
plain language and small tables. It must show:

1. **Room ranking.** Every room, quietest to loudest, with the daily score (DNL), the
   range, and pass or fail against HUD 45.
2. **Time of day.** One table: rooms down, the five time blocks across.
3. **Why.** For the three loudest rooms: the share of sound energy by path (window
   glass, frame leakage, wall, door, from which neighbouring room) and by source.
4. **Fixes.** For the loudest bedroom: each fix tried, its effect in dB, and the best one.
5. **What-ifs.** Four short runs that show the model responds sensibly: windows open,
   bedroom door open, the same unit one block further from the road, and the same unit
   with 1980 to 1999 construction.
6. **Sleep.** Each bedroom's overnight level against the WHO 30 dBA guideline.
7. **Assumptions.** Every value marked `assumed` or `placeholder` that the run used.
8. **Check.** The road level from traffic counts next to the BTS map value.

## 7a. Export for the simulation on `main`

The team's simulation (`web/src/acoustics/`, described in `docs/ACOUSTIC-LAB.md`) traces
sound from point sources through the scene and draws a floor heat map. It does not read
per-room results. `--export-lab` writes two files it can use. Read
`web/src/acoustics/engine/domain.ts` first and match its types exactly.

**`lab_sources.<model>.json`: sound sources in the simulation's `SourceData` shape.**
One list per time block. For each outdoor source the model computed:

- `position`: in the simulation's local coordinates (metres, y up; the same frame the
  simulation builds from this Matterport model, including its handedness rule in
  `alignPolygon`). Place the source outside the exposed wall, along the wall's outward
  direction, at the real distance to the road when known.
- `spectrumDbAt1m`: eight octave-band levels, 63 Hz to 8 kHz. Take a traffic spectrum
  shape from the research (the reference transportation spectrum behind OITC that R3
  cites), scale it so its A-weighted sum equals the model's free-field level at the
  wall, then refer it back to 1 m from the source with the inverse-square law. If no
  sourced spectrum shape is found, use the simulation's own `road` shape from
  `web/src/acoustics/demo.ts` and mark it `assumed`.
- `evidence`: `kind: "derived"`, with a note that a point source stands in for a road.

**`room_targets.<model>.json`: this model's per-room predictions, for calibration.**
Keyed by Matterport room id: for each time block the predicted dBA and range, plus the
daily score. The simulation's owner will use these to compare against and adjust the
heat map. Use A-weighted levels, and state that in the file.

Add a short `docs/LAB_EXPORT.md` saying what the two files contain, the coordinate
frame, and the approximations. Tests: the files validate against the `domain.ts`
shapes, every spectrum's A-weighted sum plus distance correction reproduces the wall
level to 0.1 dB, and room ids match the saved Matterport response.

## 8. Validation: `docs/VALIDATION.md`

Run the facade part of the model on the nine measured rooms in
`research/R6-validation.md`. For each: measured outdoor-to-indoor reduction, predicted
reduction, difference. Report the mean error and the worst error. Where R6 does not
give a room's construction, use it as a range check only (21 to 32 dB) and say so.
Do not tune any value marked `sourced` to improve the fit. If you adjust a `calibrated`
value, state the before and after.

Add a sensitivity table: each main assumption moved by a realistic step, and the change
in the loudest bedroom.

## 8a. Field test mode (an addition; it must not change normal predictions)

Alejandro will test the model on a real room with his own sound-level readings. Add an
optional way to feed in a measured outdoor level and compare the prediction with a
measured indoor level. When these inputs are absent, the model behaves exactly as
before. A test must prove that: the demo output is identical with and without this
code path present.

**Input.** An optional `measured` block in `sources.json`:

```json
"measured": {
  "wall": "bed1-n",
  "mode": "ambient | speaker",
  "outdoor_dba": 68.0,
  "outdoor_position": "2m_from_wall | free_field",
  "speaker_angle_deg": 45,
  "indoor_dba": {"bed1": 43.5, "corridor": 31.0},
  "indoor_background_dba": {"bed1": 29.0, "corridor": 28.0},
  "note": "phone app, 10 minute averages, windows closed"
}
```

**What the model does with it.**

- Skips the outdoor-source step for that wall and uses `outdoor_dba` instead. All other
  walls get no outdoor sound in this run, so the test isolates one facade.
- `outdoor_position: "2m_from_wall"` already includes the facade reflection, so do not
  add the `+3` again. `"free_field"` uses the normal rule. Take the exact handling from
  R3 equation E1 and say in the output which was applied.
- `mode: "ambient"` uses the normal random-incidence constant. `mode: "speaker"` uses the
  single-direction constant from R3 E1, `6 + 10*log10(cos(angle))`, with the angle
  measured from straight-on to the wall.
- Everything after the wall is unchanged: composite facade, leaks, room absorption,
  room to room.
- If `indoor_background_dba` is given, subtract the background energy from the measured
  indoor level before comparing. If the measured level is less than 10 dB above the
  background, flag the room as "not reliable: too close to background".

**Output.** A `field_test` block in `levels.json` and a short section in the report:
for each measured room, the predicted level, the measured level (background-corrected),
the difference, and the predicted and measured outdoor-to-indoor reduction. State
whether the difference is inside the model's stated range for that room.

**Tests.** Identical demo output when `measured` is absent. A speaker at 0 degrees
reads 3.0 dB louder indoors than ambient at the same outdoor level. `2m_from_wall`
reads 3.0 dB quieter indoors than `free_field` at the same number. Background
subtraction: 43.5 measured with 29.0 background gives 43.3. A measured level 6 dB over
background is flagged.

Add a blank template, `samples/sources.fieldtest.template.json`, and a second one for
the room, `samples/property.fieldtest.template.json`, each with a comment field per
entry saying what to measure and how.

## 9. Tests

Write the tests before the model code, from `SOUND_MODEL.md` and this brief. If you can
use two agents, have one write the tests and a different one write the code. The code
author may not edit the tests without saying so in the pull request.

- **Worked example.** Reproduce `SOUND_MODEL.md` section 5 to 0.05 dB at every step the
  review's table lists.
- **Units.** Two equal levels add 3.01 dB. Barrier check case gives 12.24 dB. Sabine for
  33.6 cubic metres at 0.5 s gives 10.82.
- **Road.** R7's worked example: 66.4 dBA soft ground, 67.6 dBA hard ground.
- **Time.** The hourly shares sum to 1. The energy mean of the 24 hours equals the
  24-hour level.
- **Behaviour.** Bigger window is louder. More trees is quieter and the cap holds. A room
  with no exterior wall is quieter than every room that feeds it. Opening an interior
  door raises the quieter room. Aircraft ignore barriers and wall facing. Every fix has
  a negative effect in dB. A back wall is never more than 25 dB below the front.
- **Targets.** 1990s brick, 15% window, 65 dB outside gives 41.2 dBA. The four era rows
  give 45.1, 41.5, 41.2 and 38.2. An all-glass wall gives a reduction of at least 18 dB.
- **Loader.** A room outline stitches into a closed polygon. An edge shared by two rooms
  becomes one partition, not two. A boundary edge becomes one exterior wall. A doorway on
  a shared edge becomes that partition's door. The loader runs on a second, made-up
  floor plan in the tests, to show it has no property-specific code.
- **Robustness.** Level below the map floor, window larger than its wall, a room with no
  surfaces, missing year built: each gives a clear warning or a documented fallback and
  no crash. No NaN, and no value under 15 or over 100, in any output.

## 10. How to deliver

- One branch, `model/build`, cut from `noise-model`. Use git worktrees if more than one
  agent works at once, one worktree per agent, merged into `model/build`.
- Small commits. One pull request into `noise-model`. Do not merge it. Alejandro reviews.
- The pull request description lists: what was built, the test count and result, the
  validation mean and worst error, every assumption you had to add, and anything in
  this brief you could not do and why.

**Done when:** all tests pass, the command in section 3 runs in under two seconds, and
`docs/DEMO_RESULTS.md` and `docs/VALIDATION.md` are committed with real numbers.
