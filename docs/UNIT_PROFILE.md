# Unit profile and Quiet Score: integrator guide

Issue #36. Plan: `docs/UNIT_PROFILE_PLAN.md` on `codex/unit-profile-plan` (section numbers below refer to it).
The profile extends `noisemodel/`; it is not a second model. With no profile in use every existing output is
byte-identical to `main` (`tests/test_profile_regression.py`, both demo properties).

**Cross-check: within tolerance.** `docs/SCORE_CROSSCHECK.md` starts with `RESULT:` under Alejandro's interim
tolerance (plan 6a, decided 2026-11-14, to revisit after the demo).

- **Rules:** rank correlation 0.8 or better across ten separate addresses, and on HowLoud's scale a median gap
  of 2 points or less with no gap above 5.
- **Data:** twelve separate Houston addresses in `docs/score_crosscheck_lookups.json`: rank correlation 0.88,
  median gap 0.43, largest gap 1.96. Twelve distance points near the two demo roads are diagnostics and do
  not decide the status. The known limits are listed in the cross-check file.
- **No outdoor score:** no outdoor 0 to 100 score is computed or shown. The outdoor level stays in dB.
- **Outputs:** the pipeline (`scoreCrosscheck`), the report and the lab panel show a notice only while that
  file starts with `ALERT:`. It starts with `RESULT:` now, so no notice is shown.

**Limit (interim decision 2): the model counts only the roads it is given.** A unit far from any counted road
gets an outdoor level that is too low and a Quiet Score that is too generous. No background traffic is
added. Every `score` output carries this in `limits`, and the report and the panel show it.

## Pieces

| File | What it does |
|---|---|
| `noisemodel/profile_fields.yaml` | The field list: label, group, scope (building or unit), element, allowed values or `choices_from`, fill order, the input each value sets. Display names and the phase B mappings |
| `noisemodel/profile.py` | `build`, `apply`, `compare`, `worth_checking`, `merge_edits`, `ranges` |
| `noisemodel/score.py` | Quiet Score per room and per unit from a `noisemodel` result; `outdoor_dnl` (dB) for the cross-check. There is no outdoor 0 to 100 score |
| `noisemodel/crosscheck.py` | Tolerance logic, `status()` (reads the first line of `docs/SCORE_CROSSCHECK.md`), and a CLI that evaluates `docs/score_crosscheck_lookups.json`. No network calls; a HowLoud key, if a lookup script is ever added, comes only from a local `HOWLOUD_API_KEY` environment variable and is never committed |
| `assumptions.yaml` `score.*` | Anchors, unit weights, range rule and cross-check tolerances. All `placeholder`, for Alejandro |
| `samples/profile.zzvymDx5ty7.json` | The auto-filled profile of the demo apartment (no CoStar context) |
| `samples/edits.zzvymDx5ty7.example.json` | A made-up edits file |
| `web/src/acoustics/UnitProfilePanel.tsx` | The lab panel (plan section 10) |

## Fields

Each value comes from the first source in the field's `fill` list that has one: `scan` (the Matterport scan
or its window survey, as loaded into the property file), `costar` (the local context record), `map` (aerial
or traffic data, e.g. Vexcel storeys), `inferred` (worked out from another field), `assumed` (a stated
default). A client's change is `edited` and always wins.

| Field | Element | Values | Sets |
|---|---|---|---|
| `year_built` | building | number or null | `year_built`, and `era` unless the era is edited |
| `era` | building | `era_defaults.*` | the era wall, window and leak defaults |
| `storeys` | building | integer | top floor (roof for aircraft) |
| `unit_floor` | unit | integer, not above `storeys` | receiver height; 2000-onward upper-floor wall |
| `outside_wall_material` | building | rated `walls.*` | `wall_type` of every outside wall without its own value |
| `windows_open` | unit | closed, open | `window_open` of every operable window (all day: the model has no overnight-only state) |
| `exposure` | each side | outdoors, corridor, neighbouring_unit, unknown | moves the wall between `exterior_walls` and `other_boundary_walls` |
| `window_area_m2` | each outside wall | m2, with the door must fit the wall | `window_area_m2` |
| `window_type` | each outside wall with glass | rated `windows.*` | `window_type` |
| `wall_material` | each outside wall | rated `walls.*` | `wall_type` (beats the building value for that wall) |
| `door_material` | each outside door, and the entry door | rated `doors_exterior.*` | `door_type` |

Choices are read from `assumptions.yaml`: every key of the section with a numeric rating (keys ending
`_offset`, `walls.roof` and `doors_exterior.default` are not materials). Adding a rated entry adds a choice
with no code change. Interior doors and walls are not profile fields.

Sides: the scanned outdoor walls (`scan`), the entry-door wall (`inferred` as the shared corridor), and walls
the survey could not classify (`unknown`, `assumed`, treated as not outdoors). Walls the survey derived as
interior are not listed. Yale's property file has no geometry for its boundary walls, so only its outdoor
walls are listed.

## The edits file

```json
{"schemaVersion": 1, "modelId": "zzvymDx5ty7", "edits": [
  {"field": "window_type", "target": "wall:z6q9f2tfcd3aumsmgkzh94ssb", "value": "laminated_acoustic",
   "edited_by": "resident", "edited_at": "2026-11-14T19:40:00-05:00"}]}
```

`target` is `wall:<wall id>` for per-element fields and omitted for unit and building fields. Edits are
applied in field order (building, unit, sides, then per-element), so a wall override beats the building
value whatever order they were made in. A later edit of the same field wins; the value it replaced stays in
the log. A manager's building edits (`buildingEdits`) keep only building-scope fields and are applied before
the unit's own edits, so they reach every unit of the building.

Impossible edits are rejected with a plain message (a window larger than its wall, a unit floor above the
building, a value that is not a choice). Unlikely ones (laminated glass before 1980, a scanned window wall
marked as not outdoors) are applied and flagged.

## Pipeline

`POST /api/acoustics/run` and `python -m noisemodel.pipeline` take two optional keys, `edits` and
`buildingEdits` (a list or an edits document; at most 200).

- Every response adds `profile` (fields, labels, notes, `dataChanges`), `score` and `scoreCrosscheck`.
  Every other key is unchanged when `edits` is absent.
- With `edits` (an empty list counts) the profile is "in use": the property, room predictions, lab sources and
  the eight-band room balance are computed from the edited property, and the response adds `baseline`,
  `changes`, `totalChange`, `worthChecking`, `editsRejected` and `editFlags`.

The score uses the `noisemodel` room levels only. The eight-band room balance and the grid see the edited
walls and openings through the property, but their numbers never enter the score (AGENTS.md).

## Command line

```sh
python -m noisemodel.predict samples/property.zzvymDx5ty7.json samples/sources.zzvymDx5ty7.json \
    --report --report-path /tmp/report.md --profile --edits samples/edits.zzvymDx5ty7.example.json \
    [--building-edits building.json] [--context work/costar-kit/selected-acoustic-context.json] \
    [--profile-out /tmp/profile.json]
```

`--profile` adds `profile`, `score`, `score_crosscheck`, `worth_checking` (and with edits `baseline_score`,
`changes`, `total_change`) to levels.json, and "Unit profile" and "Before and after" sections to the report.
Without `--profile` the output is exactly as before.

## Score

- Bedrooms: overnight level (00-06), 100 at 20 dBA, 0 at 50 dBA (WHO 30 scores 67). Other rooms: DNL, 100 at
  30, 0 at 60 (HUD 45 scores 50). Linear and clamped.
- Unit: 60% the lowest-scoring bedroom, 40% the largest living room; one of them alone if the other is missing.
- Range (plan section 4): a room's level range is +/- 3 dB once the window type and exposure of its walls are
  `scan`, `costar`, `map` or `edited`, else +/- 5 dB. The levels' own `range_db` is unchanged.

## CoStar context (phase B)

`DatasetRepository.context()` still reads `work/costar-kit/selected-acoustic-context.json` (ignored by Git) and
now passes through `yearBuilt`, `renovationYear`, `amenities`, `unitFloor` and `listingFeatures` when a record
has them; a record without them returns exactly what it did before. The local file today has stories and
construction class only, so the profile marks year built, unit floor and windows `assumed` until that record
is extended. Construction class sets the building wall material as `inferred` (Masonry: brick veneer,
concrete: concrete block); other classes fall through to the era default. Listing features set values only
when present; a missing feature is never a "no". Tests use `tests/fixtures/context.made_up.json`.

## Not built (phases D and E, waiting on issue #37)

Building sources (gym, pool, elevator, corridor, neighbours) and the corridor path of the entry door; party
wall and floor ratings; through-wall air conditioners; room finish beyond the default reverberation time;
the "Improve it" upgrade list with score changes; picking walls by clicking the 3D view (the panel uses the
list). Amenities are read from the context but not shown as questions until building sources exist.
