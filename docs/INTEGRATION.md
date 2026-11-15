# Integrating the noise model

For whoever connects the model to the app. Everything here was checked against the code
on `noise-model` (model version 0.2.0). The two example files named below run as written.

## 1. What it is

One function. It takes a description of a home and of the noise around it, and returns
the predicted sound level in every room for five time blocks, with the reason and a fix.

```
predict(property, sources, overrides=None, with_fixes=True) -> dict
```

All levels are A-weighted decibels (dBA). All lengths are metres, areas square metres.

## 2. Setup

Python 3.9 or newer. Two packages:

```
pip install numpy pyyaml
```

Run from the repo root, because the model reads `assumptions.yaml` from there.

## 3. Three ways to call it

**Command line.** Writes the result as JSON.

```
python -m noisemodel.predict samples/property.minimal.json samples/sources.minimal.json --out levels.json
```

Add `--report` to also write a readable report (default `docs/DEMO_RESULTS.md`, change
with `--report-path`). Add `--set key=value` (repeatable) for a what-if run, section 7.

**Python.**

```python
import json
from noisemodel.predict import predict

prop = json.load(open("samples/property.minimal.json"))
sources = json.load(open("samples/sources.minimal.json"))
result = predict(prop, sources)                    # about 0.1 s for a small home
fast = predict(prop, sources, with_fixes=False)    # a few ms; every room's "fix" is null
```

**From the web app.** The production build has no backend, so the simplest route is to
run the command above once per property, commit the output JSON, and import it as a
static file. For live what-if runs in development, call the command from the local dev
server and pass `--set` values.

## 4. Input 1: the property

Smallest valid file: `samples/property.minimal.json`. Full examples:
`samples/property.zzvymDx5ty7.json` (the demo apartment, built by the loader) and
`samples/property.yale.json` (written by hand).

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Any string. Copied to the output as `property_id` |
| `lat`, `lon` | yes | Decimal degrees. Required even when outdoor levels are typed in |
| `era.value` | no | `before_1960`, `1960_1979`, `1980_1999` or `2000_on`. Sets default wall, window and leak values |
| `year_built` | no | Used to pick the era when `era` is absent |
| `north_offset_deg` | no | Added to every wall azimuth. Use it to correct compass north in one place |
| `facade_point` | no | `{lat, lon}` of the exposed wall, if different from `lat`, `lon` |
| `unit_floor`, `storeys` | no | Floor of the unit (1 = ground) and building height in floors |
| `rooms[]` | yes | See below |
| `partitions[]` | no | See below. Without it, rooms with no exterior wall get no sound |

**Each room**

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique. The output uses the same id |
| `name`, `type` | no | Label, and a type such as `bedroom`. Bedrooms get the sleep check |
| `area_m2`, `height_m` | yes | Floor area and ceiling height |
| `volume_m3` | no | Defaults to area times height |
| `matterport_id` | no | Not read by the model. Keep it to match rooms in the 3D view |
| `exterior_walls[]` | yes | May be an empty list |

**Each exterior wall**

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique across the property |
| `azimuth_deg` | yes | Compass direction the outside face points. 0 north, 90 east |
| `area_m2` | yes | Whole wall, including windows and doors |
| `window_area_m2` | no | Total window area. `null` means 15% of the wall, with a wider range. `0` means no window |
| `window_type` | no | `single_pane`, `double_pane_1980_1999`, `double_pane_2000_on`, `double_pane_fixed`, `with_storm`, `laminated_acoustic` |
| `window_fixed` | no | `true` for sealed glass that cannot open |
| `window_open` | no | `true` to model the window open |
| `wall_type` | no | `vinyl_siding_2x4`, `vinyl_siding_2x6`, `aluminum_siding_2x6`, `eifs_stucco_2x6`, `cement_stucco_2x6`, `brick_veneer`, `fiber_cement_upper_floor`, `concrete_block` |
| `door_area_m2`, `door_type` | no | Exterior door. Types: `hollow_core`, `solid_core`, `sliding_glass`, `solid_core_storm` |

Any type left `null` is filled from the era defaults.

**Each partition** (a wall or floor shared by two rooms)

| Field | Required | Meaning |
|---|---|---|
| `id`, `room_a`, `room_b` | yes | The two room ids |
| `area_m2` | yes | Shared area |
| `kind` | no | `wall` (default) or `floor` |
| `partition_type` | no | `stud_wall`, `stud_wall_insulated`, `wood_floor`, `wood_floor_insulated`, `concrete_4in`, `concrete_6in` |
| `door` | no | `none`, `closed`, `open`, or `opening` (a doorway with no door) |
| `door_area_m2`, `door_type` | no | Door types: `door_hollow_core`, `door_solid_core` |

## 5. Input 2: the sources

Smallest valid file: `samples/sources.minimal.json`. Full example: `samples/sources.yale.json`.
Give at least one source. Everything is optional except that.

**Simple form: type in the outdoor level.**

```json
{"property_id": "x", "outdoor_levels_dba": {"road": 65.0, "rail": null, "aviation": null}}
```

Values are 24-hour average levels at the building. The model spreads them over the day
with a Texas traffic profile. Optional extras inside `outdoor_levels_dba`:
`road_bearing_deg` and `road_distance_m` (so walls facing away get quieter), and
`road_profile` (`arterial`, `freeway` or `hud`). A value of 45 or less is treated as absent.

**Detailed form: roads from traffic counts.** Used instead of the simple road value
whenever a road has an `aadt`.

| Field of `roads[]` | Required | Meaning |
|---|---|---|
| `id` | yes | Any string |
| `aadt` | yes | Vehicles per day |
| `speed_kmh` | yes | Travel speed |
| `geometry` | yes | Road centre line as `[[lon, lat], ...]` |
| `road_class` | no | `arterial` (default) or `freeway`. Picks the time-of-day profile |
| `medium_trucks_per_day`, `heavy_trucks_per_day` | no | Truck counts. Or give `truck_share` (0 to 1) |
| `ground` | no | `soft` (default) or `hard` |

**Other sources**

| Field | Shape |
|---|---|
| `flights[]` | `aircraft_type` (ICAO code, optional), `time` (ISO timestamp), `track` as `[[lon, lat, altitude], ...]`, optional `groundspeed_kt` |
| `construction[]` | `lat`, `lon`, `equipment` (list from: `excavator`, `jackhammer`, `dump_truck`, `concrete_mixer`, `crane`, `impact_pile_driver`, `concrete_saw`, `air_compressor`), `active_blocks` |
| `rail[]` | `geometry` as `[[lon, lat], ...]`; the level comes from `outdoor_levels_dba.rail` |
| `barriers[]` | `geometry`, `height_m` (or `path_difference_m` directly) |
| `tree_cover` | `{"fraction": 0 to 1}` |
| `building_rows` | `{"first_row_built_fraction": 0 to 1, "further_rows": n}` |
| `measured` | Field test mode, section 8 |

## 6. Output

A dict (or JSON file) with these top-level keys:

| Key | Contents |
|---|---|
| `property_id`, `model_version`, `era` | Echo of the run |
| `rooms[]` | One entry per room, below. This is what the heat map needs |
| `outdoor[]` | Per exterior wall: level in each time block by source, and each shielding loss in dB |
| `outdoor_free_field` | Per source: level per block, 24-hour level, daily score, before any shielding |
| `checks` | Road level from counts against the BTS map value, when both were given |
| `assumptions_used` | Every assumed input and every model value the run used, with its status |
| `warnings[]` | Plain-text notes. Show them or log them; they never stop a run |

**Each room**

| Field | Meaning |
|---|---|
| `id`, `name`, `type` | From the input |
| `blocks` | Keys `overnight` (00 to 06), `morning_rush` (06 to 10), `midday` (10 to 16), `evening_rush` (16 to 20), `evening` (20 to 24) |
| `blocks.<b>.dba` | Predicted level in that block. `null` when below 15 dBA or when there is no source |
| `blocks.<b>.range_dba` | `[low, high]` |
| `blocks.<b>.below_15_dba` | `true` when the level is under the model's floor |
| `blocks.<b>.by_source` | Level from each source: `road`, `rail`, `aircraft`, `construction` |
| `blocks.<b>.peak_dba` | Loudest single aircraft event. `null` without flight tracks |
| `blocks.<b>.dominant` | `{path, wall, source, share}`: the biggest way in, and its share of the energy (0 to 1) |
| `l24_dba` | 24-hour average |
| `dnl_dba` | Daily score with a 10 dB night penalty. Color rooms by this, or by a block's `dba` |
| `range_db` | 3 when the room's windows were measured, otherwise 5 |
| `exceeds_hud_45` | `true` when `dnl_dba` is above 45 |
| `night_dba`, `exceeds_who_30_night` | Overnight level and the sleep check |
| `paths_24h` | Share of daily energy by path, e.g. `"bed2-e:window": 0.88`, `"from:living": 0.01` |
| `sources_24h` | Share of daily energy by source |
| `fix` | `{action, target, delta_db, text}`: the best single fix. `null` if none helps or `with_fixes=False` |

Example, the bedroom in the minimal files (65 dBA road outside):

```json
"midday": {"dba": 42.79, "range_dba": [39.79, 45.79], "below_15_dba": false,
           "by_source": {"road": 42.79}, "peak_dba": null,
           "dominant": {"path": "frame leakage", "wall": "bedroom-south", "source": "road", "share": 0.642}}
```

with `dnl_dba` 44.78, `l24_dba` 41.17, and `fix.delta_db` -9.18 for replacing the window.

## 7. What-if runs (overrides)

Pass a dict as `overrides`, or `--set key=value` on the command line.

| Key | Example value | Effect |
|---|---|---|
| `window.<wall id>.type` | `laminated_acoustic` | Change a window type |
| `window.<wall id>.area_m2` | `2.5` | Change window area |
| `window.<wall id>.open` | `true` | Open a window |
| `window.<wall id>.fixed` | `true` | Mark glass as sealed |
| `window.<wall id>.leak_fraction` | `0.001` | Set frame leakage directly |
| `wall.<wall id>.type` | `brick_veneer` | Change a wall type |
| `door.<partition id>.state` | `open` | Open or close an interior door |
| `door.<partition id>.type` | `door_solid_core` | Change an interior door |
| `room.<room id>.<field>` | | Change any room field |
| `property.era` | `1980_1999` | Change the era defaults |
| any key in `assumptions.yaml` | `rooms.reverberation_time=0.4` | Change a model value |

Changing only a window's type keeps its old frame leakage. The model's own window fix
also renews the seals, which is why it helps more.

## 8. Field test mode

Add a `measured` block to the sources to compare a prediction with real readings. It is
ignored when absent, and normal results are unchanged. Blank templates:
`samples/property.fieldtest.template.json` and `samples/sources.fieldtest.template.json`.
The result appears under a top-level `field_test` key. A worked example is in
`fieldtests/hotel_speaker_test.md`.

## 9. Connecting it to the simulation on `main`

- **Room ids.** The model returns whatever `id` each room was given. Use the Matterport
  room id as `id` (or keep it in `matterport_id`) so results map onto the 3D rooms.
- **What `predict()` does not return.** No positions and no frequency bands. It gives one
  level per room per time block.
- **The export for the simulation.** Add `--export-lab` to the command line. It writes
  two more files next to `--out`: `lab_sources.<model>.json` (point sources in the
  simulation's `SourceData` shape, one list per time block, eight octave bands at 1 m,
  in the simulation's local coordinates) and `room_targets.<model>.json` (this model's
  per-room dBA per time block, keyed by Matterport room id). `docs/LAB_EXPORT.md`
  explains both, the coordinate frame and the approximations. Ready-made files for the
  demo apartment are in `samples/`, ending in `.zzvymDx5ty7.json`.
- **From a Matterport scan to the model's input.** `noisemodel/matterport.py` turns a
  saved Matterport Model API response, plus a window survey file in the simulation's
  opening-import shape, into the property input. Room ids are the Matterport room ids.
- **Suggested use.** Color each room by `dnl_dba` or by the selected block's `dba`, show
  `dominant` and `fix` in the room's panel, and use the per-room values as the
  calibration target for the simulation's field.

## 10. Things that will trip you up

- `lat` and `lon` are required, even with typed-in outdoor levels.
- `azimuth_deg` is the direction the wall's outside face points, not the direction it runs.
- With the simple form and no `road_bearing_deg`, every wall gets the full level, and a
  warning says so.
- A `dba` of `null` is a real answer ("too quiet to state"), not an error. Check
  `below_15_dba`.
- Bad ids in an override raise a `KeyError`. A window larger than its wall is clamped
  with a warning.
- Accuracy: within about 3 dB when windows are measured. It reads about 5 dB too loud
  for vinyl-sided houses (see `docs/VALIDATION.md`).
