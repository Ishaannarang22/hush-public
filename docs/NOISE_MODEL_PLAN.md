# Noise model plan (version 2, aligned with the team plan)

Owner: Alejandro (noise model only).
Updated Sat 2026-11-14, about 04:00 ET. Deadline Sun 2026-11-15, 08:00 ET.

This is the detailed plan for one box in the team plan, [docs/PLAN.md](PLAN.md):
the noise model. Where the two disagree, the team plan wins. Version 1 of this file
used different file names and time blocks; this version replaces it.

---

> **Update, Sat 2026-11-14 morning.** Scope is now a demo of the model's capability on
> one property (2125 Yale St), with inputs written by hand. Research R1 to R10, the spec
> (`SOUND_MODEL.md`), `assumptions.yaml` and the cold review are all merged. The coding
> is done by Ishaan's agents from [docs/BUILD_BRIEF.md](BUILD_BRIEF.md), which overrides
> sections 4 and 5 below. The team contract is deferred: the model reads the section 1
> shapes, and only its input and output code changes if the team picks other names.

## 0. Where things stand

| Item | Status |
|---|---|
| Research R1 to R6 | Done, merged into `noise-model`, in `research/` |
| Team plan | On `main`, merged into `noise-model` |
| Contract files (`property.json`, `sources.json`, `levels.json`) | Draft only. Section 1 proposes exact shapes. Needs a yes from the pipeline and frontend owners |
| `SOUND_MODEL.md` (the approved spec) | Not written. Issue #8 |
| Research still missing | R7 road emission, R8 aircraft from tracks, R9 traffic by time block, R10 window shapes from the Matterport mesh |
| Code | None yet |

**Scope of this plan.** The model reads `property.json` and `sources.json` and writes
`levels.json`. It does not fetch data, parse Matterport or Vexcel, call APIs, or draw
anything. Those belong to the pipeline (Shreyansh) and the frontends (Ishaan, Chinmay,
Shreyansh).

**Three rules.**

1. One end-to-end path always works: a hand-written sample property and sample sources
   go in on day one and never break.
2. Every number in the code comes from `assumptions.yaml`, and every entry has a source
   and a status (`sourced`, `calibrated`, `placeholder`).
3. No model code before a human approves `SOUND_MODEL.md` (Gate 1).

---

## 1. The contract (proposal, to be agreed with the team)

The team plan names three files and describes them in words. The model needs exact
fields. This section proposes them. Fields the model cannot run without are marked
**required**. Everything else may be `null`, and the model then uses the stated fallback.

Time blocks, from the team plan, used everywhere:

| id | hours |
|---|---|
| `overnight` | 00 to 06 |
| `morning_rush` | 06 to 10 |
| `midday` | 10 to 16 |
| `evening_rush` | 16 to 20 |
| `evening` | 20 to 24 |

### 1.1 `property.json` (written by the pipeline, read by the model)

```json
{
  "id": "2125-yale-unit",
  "address": "2125 Yale St, Houston TX 77008",
  "lat": 29.8058666, "lon": -95.3993738,
  "year_built": null,
  "construction": null,
  "storeys": 1,
  "geometry_quality": "measured | estimated",
  "rooms": [
    {
      "id": "bed1", "name": "Bedroom 1", "type": "bedroom", "floor": 0,
      "area_m2": 19.8, "height_m": 2.87, "volume_m3": 56.8,
      "exterior_walls": [
        {
          "id": "bed1-n", "azimuth_deg": 0, "area_m2": 10.6,
          "wall_type": null,
          "window_area_m2": null, "window_type": null,
          "door_area_m2": 0, "door_type": null
        }
      ]
    }
  ],
  "partitions": [
    {
      "id": "p1", "room_a": "bed1", "room_b": "corridor", "area_m2": 8.0,
      "kind": "wall | floor",
      "partition_type": null,
      "door": "none | closed | open", "door_area_m2": 1.6, "door_type": null
    }
  ]
}
```

- **Required:** `lat`, `lon`, and per room `id`, `area_m2`, `height_m`. Per exterior wall
  `azimuth_deg` (compass direction the outside face points, 0 north, 90 east) and
  `area_m2`. Per partition `room_a`, `room_b`, `area_m2`.
- **Fallbacks when null:** `window_area_m2` becomes 15% of the wall area. `wall_type`,
  `window_type` and leak fraction come from `year_built` (table in section 2.3).
  `year_built` null means the 1980 to 1999 row. `partition_type` means an uninsulated
  2x4 stud wall. `door_type` means hollow core.
- `geometry_quality: "estimated"` widens the reported range.
- Room polygons, footprint and building height belong in this file for the frontend,
  but the model does not read them.

Known gap from R5: Matterport gives each room's floor area, total wall area, height,
width and depth. It does not say which walls are exterior, which way they face, or
which rooms touch. The pipeline has to supply that, by hand for the demo unit if needed.

### 1.2 `sources.json` (written by the pipeline, read by the model)

The model accepts two levels of detail for each source. The pipeline sends whichever it
has. The simple form keeps the demo alive if the detailed data is late.

```json
{
  "property_id": "2125-yale-unit",
  "roads": [
    {
      "id": "yale-st", "geometry": [[-95.3994, 29.8050], [-95.3994, 29.8070]],
      "blocks": {
        "morning_rush": {"vehicles_per_hour": 1400, "truck_share": 0.04, "speed_kmh": 50}
      }
    }
  ],
  "flights": [
    {
      "aircraft_type": "B738", "time": "2026-11-10T07:12:00-06:00",
      "track": [[-95.41, 29.82, 900], [-95.39, 29.80, 850]]
    }
  ],
  "construction": [
    {"lat": 29.8061, "lon": -95.3990, "equipment": ["excavator"], "active_blocks": ["morning_rush", "midday"]}
  ],
  "barriers": [
    {"kind": "wall | building", "geometry": [[-95.3995, 29.8055], [-95.3995, 29.8062]], "height_m": 3.0}
  ],
  "tree_cover": {"fraction": 0.2, "depth_m": 15},
  "outdoor_levels_dba": {
    "road": 61.0, "rail": null, "aviation": 48.0,
    "source": "BTS 2020 noise map, 24-hour LAeq, free field"
  }
}
```

- Detailed form: `roads`, `flights`, `construction`. The model computes the outdoor
  level per time block from them (section 2.1).
- Simple form: `outdoor_levels_dba`, one 24-hour level per mode. The model splits it
  into time blocks with a default daily profile.
- If both are present, the model uses the detailed form and reports the difference from
  the simple form as a check, which is what the team plan asks for.
- **Required:** at least one of the two forms for at least one source.

### 1.3 `levels.json` (written by the model, read by the frontends)

```json
{
  "property_id": "2125-yale-unit",
  "model_version": "0.1.0",
  "rooms": [
    {
      "id": "bed1",
      "blocks": {
        "overnight": {
          "dba": 31.2, "range_dba": [26.2, 36.2],
          "by_source": {"road": 30.1, "air": 24.5, "construction": null},
          "peak_dba": 44.0,
          "dominant": {"source": "road", "path": "window and frame leakage", "wall": "bed1-n", "share": 0.74}
        }
      },
      "dnl_dba": 40.4,
      "exceeds_hud_45": false,
      "night_dba": 31.2,
      "exceeds_who_30_night": true,
      "fix": {"action": "replace_window", "wall": "bed1-n", "delta_db": -9.2,
              "text": "Replace the street-facing window with laminated glass and new seals"}
    }
  ],
  "outdoor": [
    {"wall": "bed1-n", "blocks": {"overnight": {"road": 52.0, "air": 44.0, "construction": null}},
     "barrier_loss_db": 0, "foliage_loss_db": 0.8, "orientation_loss_db": 0}
  ],
  "assumptions_used": {"window.double_pane.oitc": 23, "leak_fraction.1980_1999": 0.01},
  "checks": {"road_detailed_minus_bts_db": 1.4}
}
```

`peak_dba` appears only when flight tracks are supplied. `dnl_dba` is computed from the
five blocks with the 10 dB night penalty on 22:00 to 07:00 (all of `overnight`, the last
two hours of `evening`, the first hour of `morning_rush`).

---

## 2. The model after research

All levels are A-weighted. Windows closed unless stated. Energy sums are linear:
`L_total = 10*log10(sum(10^(Li/10)))`. Full derivations and sources are in `research/`.

### 2.1 Outdoor level at each exterior wall, per source, per time block

**Roads, detailed form (starting hypothesis, R7 must confirm).** FHWA highway traffic
noise prediction model (FHWA-RD-77-108): a reference emission level per vehicle class
from speed, then adjustments for hourly volume, distance from the road, and how much of
the road the wall can see. Sum cars, medium trucks and heavy trucks.

**Roads, simple form.** BTS 2020 road layer value at the wall (24-hour LAeq, free field,
no shielding included). Split into blocks with a daily traffic profile (R9). Until R9
lands: day blocks = L24 + 1.3, `overnight` = L24 - 4.0 (HUD's 15% night share, from R1).

**Aircraft, detailed form (starting hypothesis, R8 must confirm).** For each flight, the
closest point of the track to the building gives a slant distance. A noise-versus-distance
curve for that aircraft type gives the event's exposure level. Sum events per block.
The loudest event in the block is `peak_dba`.

**Aircraft, simple form.** BTS aviation layer, same split as roads (placeholder).

**Construction.** FHWA RCNM: `L = Lmax_at_50ft + 10*log10(usage_factor)
- 20*log10(distance_ft / 50)`. Use the measured ("Actual") level where it exists.
Active blocks only.

**Then, for road and construction only (not aircraft):**

| Term | Rule after research | Source |
|---|---|---|
| Wall facing | Facing the source 0, side wall -3.0, back wall -10 (range 7 to 13) | R2 |
| Barrier | FHWA barrier formula (Kurze-Anderson form) at 550 Hz, cap 20 dB | R2, equation E1 |
| Trees | 0.05 dB per metre of tree path (ISO 9613-2), cap 10 dB | R2 |

Aircraft noise arrives from above: every wall gets the full level, and the roof counts
as an exterior surface for top-floor rooms.

### 2.2 Through the wall into the room (confirmed by R3)

```
tau    = [ S_wall*10^(-R_wall/10) + sum(S_i*10^(-R_i/10)) + sum(f*S_i) ] / S
R      = -10*log10(tau)
L_room = L_outdoor + 3 - R + 10*log10(S / A)
A      = 0.161 * V / T        with T = 0.5 s
```

`S_i` are window and door areas, `f` is the leak fraction (leak area per unit of opening
area, with no sound blocking). Ratings are OITC. For aircraft, subtract 3 from the
ratings (R3). With a window open, skip this and use a flat 12 dB reduction.

### 2.3 Defaults by year built (R3)

| Era | Wall (OITC) | Window (OITC) | Leak fraction `f` | 65 dB outside gives |
|---|---|---|---|---|
| before 1960 | siding on 2x4 (24) | single pane (22) | 0.01 | 45.1 dBA |
| 1960 to 1979 | brick veneer (40) | single pane (22) | 0.01 | 41.5 dBA |
| 1980 to 1999 | brick veneer (40) | double pane (23) | 0.01 | 41.2 dBA |
| 2000 onward | brick veneer (40) | double pane (22) | 0.001 (low confidence) | 38.2 dBA |

Exterior doors: hollow core 18, solid core 20, sliding glass 20.
Upgrades for the fix search: storm window 27, laminated acoustic 35. Any window
replacement also resets `f` to 0.001.

### 2.4 Room to room (corrected by R4)

```
L_recv = L_send - (STC - 8) + 10*log10(S_partition / A_recv)
```

Stud wall STC 33 (36 insulated). Hollow-core door 21, solid core 30, any door with a
normal gap underneath about 21. Wood floor between storeys 38. An open doorway blocks
nothing, and its area counts as absorption in the room the sound leaves. Solve all rooms
together as one energy balance, not one after another.

### 2.5 Reported values

- Range: plus or minus 5 dB by default. Plus or minus 3 dB only when window areas and
  types are measured (R6).
- HUD test: indoor DNL above 45. Sleep line: `overnight` level above WHO's 30 dBA.
- Dominant path: the largest term in the room's energy sum.
- Fix: rerun with one change at a time and report the biggest drop.

### 2.6 What to expect (use these as test targets)

- 1990s brick, 15% window, 65 dB outside: 39 to 43 dBA inside (R3 gives 41.2).
- Outdoor-to-indoor reduction for any closed pre-2000 house: 18 to 27 dB.
- Nine measured US rooms (R6): reductions of 21.5 to 31.7 dB, median 24.9.
- Brick must not be much quieter than siding when the windows are the same.
- Adding an exterior door to a room costs 4 to 6 dB.

---

## 3. Who does what

| Work | Owner |
|---|---|
| Noise model: physics, `assumptions.yaml`, tests, `predict()` | Alejandro |
| Research and anything computation-heavy | Ishaan's agents, by tagging @Ishaannarang22 on an issue |
| `property.json` and `sources.json` from real data | Pipeline (Shreyansh) |
| Reading `levels.json`, 3D views, heat map | Frontends (Ishaan, Chinmay, Shreyansh) |
| Gate approvals | Alejandro |

---

## 4. Next steps, in order

| # | Step | Owner | Blocks |
|---|---|---|---|
| 1 | Agree the three file shapes in section 1 | Whole team | Everything |
| 2 | Synthesis: write `SOUND_MODEL.md` and `assumptions.yaml`, then a cold review (issue #8) | Ishaan's agents | Gate 1 |
| 3 | R7 road emission, R8 aircraft from tracks, R9 traffic by time block | Ishaan's agents | Detailed outdoor form only |
| 4 | R10 window areas from the Matterport mesh | Ishaan's agents | Measured windows only |
| 5 | **Gate 1:** Alejandro approves the spec | Alejandro | All code |
| 6 | Phase 0: sample `property.json` and `sources.json` for the demo unit, by hand | Alejandro | Build |
| 7 | Build (section 5) | Alejandro's agents | |
| 8 | Verify: hand check, sensitivity sweep, the nine R6 cases | Ishaan's agents for the sweep | Gate 2 |
| 9 | **Gate 2:** tests green on the sample files | Alejandro | Hand-over |
| 10 | Swap in the pipeline's real files | Pipeline and Alejandro | |

Steps 2, 3 and 4 run in parallel. Step 3 does not block the build: the simple outdoor
form works without it, and the detailed form slots in behind the same function.

---

## 5. Build plan (after Gate 1)

One git worktree per agent. A worktree is a separate folder on its own branch of the
same repo, so agents cannot overwrite each other. Each ends in a pull request into
`noise-model`.

```
noisemodel/
  db.py            dB helpers
  acoustics.py     composite loss, barrier, foliage, Sabine
  outdoor.py       sources.json to a level per wall, per source, per block
  indoor.py        wall to room, room to room, dominant path, fixes
  io.py            read and validate property.json and sources.json, write levels.json
  predict.py       predict(property, sources, overrides=None) and a command line
tests/
samples/           property.sample.json, sources.sample.json
assumptions.yaml
```

| Agent | Worktree and branch | Owns | Starts |
|---|---|---|---|
| T1 tests | `model/tests` | `tests/` | First, from `SOUND_MODEL.md` only |
| A physics | `model/indoor` | `db.py`, `acoustics.py`, `indoor.py` | After T1 |
| B outdoor | `model/outdoor` | `outdoor.py` | After T1 |
| C input and output | `model/io` | `io.py`, `predict.py` | After T1 |

Agents A, B and C may not edit `tests/`. The core runs on Python 3.9 with `numpy` and
`pyyaml` only.

**Tests T1 must write.**

- Unit: two equal levels add 3 dB. Barrier check case gives 12.2 dB. 30 m of trees
  gives 1.5 dB and the cap holds. The 33.6 cubic metre room gives A = 10.8.
- Behaviour: bigger window is louder. More trees is quieter. A room with no exterior
  wall is quieter than the rooms feeding it. `overnight` is quieter than `midday` for
  road noise. Opening an interior door raises the quieter room. Aircraft ignore
  barriers and wall facing. Every fix has a negative `delta_db`.
- Targets: everything in section 2.6.
- Output: `levels.json` matches section 1.3, with no NaN and no value under 15 or
  over 100.

**Done when:** `pytest` is green and this runs in under a second:

```
python -m noisemodel.predict samples/property.sample.json samples/sources.sample.json --out levels.json
```

---

## 6. Risks

| Risk | Response |
|---|---|
| Contract not agreed in time | Build against section 1 as written; adapt `io.py` only |
| No measured window areas | 15% rule, range plus or minus 5 dB, shown in the UI |
| Flight-track noise curves not found in time | BTS aviation layer for the average, no `peak_dba` |
| Road counts missing for a street | BTS road layer for that property |
| CoStar year built unreachable (R5) | 1980 to 1999 defaults, editable in the UI |
| Demo unit cannot be placed in its building (R5) | Pipeline sets wall facings by hand for the demo |
| Judges ask "is this accurate?" | The nine measured R6 rooms and the stated range |

## 7. What the model does not do

One broadband number per room, not a spectrum. No neighbour noise through shared walls.
No terrain. Averages per time block, plus aircraft peaks only. It ranks rooms and flags
problems; it does not replace a measurement.
