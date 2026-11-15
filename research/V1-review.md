# V1. Cold review of SOUND_MODEL.md and assumptions.yaml

Reviewer: V1 skeptic for issue #8, fresh context. Reviewed commit `30e3e13` on
`research/synthesis`. I read the issue's V1 section, the spec, `assumptions.yaml`,
`docs/NOISE_MODEL_PLAN.md` (v2) and `research/R1` to `R6`. I did not read the issue comments
or the PR conversation before writing this. All arithmetic below was redone from scratch in a
short Python script at full precision.

## Verdict

**Not ready for Gate 1 as written. 4 of 5 items fail. None of the fails is an arithmetic error.**

The arithmetic is right. Every intermediate number in the worked example, the era table, the
fix figures and the B1 and B9 claims reproduces to the displayed precision. The equations are
dimensionally consistent and the coupled-room solve is set up correctly.

The fails are about what the equations do outside the worked example:

- **Shielding terms stack with no overall cap.** Orientation, barrier, foliage and building rows
  are all subtracted with no cap on their total, and R2 E4 says not to stack orientation with
  building rows. A back wall can come out 40 dB below free field.
- **The leak term scales with window area,** so an all-glass wall gets NLR 15.8 dB. That is
  below every measured closed US room in R6.
- **DNL from block averages reads 1.03 dB high.** This is the method plan section 1.3 and the
  spec's own detailed-form note prescribe.
- **Some status labels are wrong.** Seven values are marked `sourced` or `calibrated` without
  support, and five values are missing from the yaml.
- **There are demo crashes and gaps.** No guard when every BTS mode is at the 45 dB floor
  (log of zero), no guard for window area bigger than wall area, no rule for rail or
  construction bearing, and the demo input is the City Hall pixel, not Yale St.

| # | Check | Result |
|---|---|---|
| 1 | Worked example recomputed | **PASS** (cosmetic nits only) |
| 2 | Units, signs, double counting | **FAIL** (shielding stack uncapped; berm cap discontinuous) |
| 3 | Placeholders, missing values, source spot-check | **FAIL** (31 placeholders listed; 5 values missing; 7 labels not supported) |
| 4 | Extreme inputs | **FAIL** on all-window (no-window optimistic but plausible; 85 dB passes) |
| 5 | Other demo risks | **FAIL** (DNL block bias, divide-by-zero, missing guards and rules) |

---

## 1. Worked example recomputed: PASS

Inputs as stated in spec section 5: L24 54.8, f_n 0.15, side wall (alpha 90), wall 3.703 x
2.865 m, 15% window, brick 40, double pane 23, f 0.01, V 56.68 m3, corridor 23.24 m3,
partition 8.0 m2 with a 1.6 m2 open door, T 0.5 s.

| Step | Spec | Mine (full precision) | Match |
|---|---|---|---|
| 1 Midday offset / level | +1.34 / 56.14 | +1.3354 / 56.1354 | yes |
| 2 Orientation | 3.01 | 3.0103 | yes |
| 4 Foliage r_f | 1.6 m, 0 dB | 1.6 m, 0 dB | yes |
| 5 L_wall | 53.13 | 53.1251 | yes |
| 6 S | 10.61 | 10.6091 | yes |
| 7 Window / opaque | 1.59 / 9.02 | 1.5914 / 9.0177 | yes |
| 8 Opaque term | 0.000902 | 0.000902 | yes |
| 9 Window term | 0.007976 | 0.007976 | yes |
| 10 Leak term | 0.015915 | 0.015914 | yes (last digit) |
| 11 T | 0.024793 | 0.024791 | yes |
| 12 Composite R | 26.31 | 26.314 | yes |
| 13 A_bed | 18.25 + 1.6 = 19.85 | 18.251 + 1.6 = 19.851 | yes |
| 14 10 log(S/A) | -2.72 | -2.721 | yes |
| 15 Bedroom from facade | 27.09 | 27.090 | yes |
| 16 P, R_part | 1.6202, 6.94 | 1.62024, 6.935 | yes |
| 17 A_corr | 7.48 + 1.6 = 9.08 | 7.483 + 1.6 = 9.083 | yes |
| 18 Couplings | 0.1784; 0.0816 | 0.17838; 0.08162 | yes |
| 19 1 - c c, gain | 0.98544, +0.06 | 0.98544, +0.0637 | yes |
| 20 Bedroom midday | 27.2 | 27.154 | yes |
| 21 Corridor midday | 19.7 | 19.667 | yes |
| Path shares | leak 64, window 32, wall 4 | 64.2, 32.2, 3.6 | yes |
| Block offsets | -3.98, +0.49, +1.34, +1.34, -0.56 | -3.979, +0.492, +1.335, +1.335, -0.555 | yes; they energy-average to L24 exactly |
| Bedroom blocks | 21.8, 26.3, 27.2, 27.2, 25.3 | 21.84, 26.31, 27.15, 27.15, 25.26 | yes |
| Bedroom L24, DNL | 25.82, 29.5 | 25.819, 29.529 (offset 3.7107) | yes |
| Door closed: R_part, bed, corridor | 20.55, 27.46, 7.2 | 20.552, 27.455, 7.19 | yes |
| NLR route check | 26.03 | 26.035 | yes |

Other numbers I recomputed and found correct: the era table (45.1, 41.5, 41.2, 38.2; NLR 19.9,
23.5, 23.8, 26.8), the A9 fixes (laminated 32.0, -9.2; storm 34.8; seal 37.4), the B9 5%-window
NLRs (27.9, 28.2), the B1 claim (plan rule: L24 +0.46, DNL offset 5.47 vs 3.71), the barrier
check (N 0.805, 12.24 dB), the branch joins (N 5.03 gives 20.00; N -0.1916 gives 0.00), the
orientation points (1.25, 3.01, 6.02, 10.0 at 162 deg) and the interior door composites
(15.03, 20.19).

Cosmetic nits, no change to any result:
- Step 2 shows the loss as "-3.01 dB", but `D_orient` is defined as positive and subtracted.
  The same goes for step 14's "- 2.72": the formula adds `10*log10(S/A)`, which is -2.72. Show
  the signs as the formula uses them.
- "29.0 dB (26.0 from the facade, 3.0 from orientation)": 26.03 + 3.01 = 29.04, but the total
  is 28.98. The missing 0.06 dB is the corridor return (step 19). Say so, or the parts will not
  add up for a reader.
- Section 6 B5 quotes R4's composite doors as 18.5 (hollow) and 21.4 (solid) before derating.
  With the spec's own geometry (1.6 m2 door, leaf = door minus the 0.0103 m2 gap) I get **18.4**
  and **21.3**. R4 used a 1.64 m2 leaf.

## 2. Units, signs and double counting: FAIL

Passes:
- Units are consistent throughout: `T_w`, `P_ij` and `A_i` in m2, `F` and `E` dimensionless
  energy, `c_ij` dimensionless, `N` dimensionless (3.21 per m times delta in m). Every loss is
  positive and subtracted.
- **BTS shielding.** R1 confirms BTS models only divergence and soft ground ([V3] p.8: shielding
  "is not considered"). Barrier, foliage and building rows are not double-counted against the map.
- **+3 incidence and the leak term.** R3 calibrated `f` with the same +3 and the same lab
  ratings, so the +3 is not counted twice. Leaving out a field derating is consistent with that
  calibration, but see item 4a for windowless walls.
- **Partitions and open doors.** An open doorway's area is added to A on both sides and also
  appears in `P_ij` at R = 0. That is the correct coupled-room energy balance (loss from the
  sending room, gain in the receiving room), not a double count. Each row of C sums to less than
  1 as long as partition transmission is smaller than the Sabine absorption, so the solve
  converges.
- **Aircraft.** OITC -3 is applied to walls, windows and roof but not to EWR doors or leaks.
  This is consistent (B6).

Fails:

**2a. The shielding terms stack with no total cap, and R2 says not to stack two of them.**
The spec, section 3.3, says:

> `L_wall = L_block - D_orient - D_barrier - D_foliage - D_rows`

It caps only `D_foliage + D_rows <= 10` and `D_barrier + D_foliage <= 20`. The orientation term
(up to 10) can therefore stack with a barrier (up to 20) and building rows (up to 10). A back
wall behind a 20 dB wall in a third row computes 10 + 20 + 10 = **40 dB** below free field. R2's
measured and simulated back-wall values are 7 to 13 dB. ISO 9613-2 caps double diffraction at
25 dB (R2 Values, `barrier.iso9613_cap_double`). R2 E4 also says: "Houses in the second and
later rows behind a first row get the FHWA building-row term (E6), not the orientation term."
The spec applies both.
**Fix:** follow R2 E4. Use either `D_rows` or `D_orient` on a given facade, never both, and cap
`D_orient + D_barrier + D_foliage + D_rows` at 25 dB (or 20, a placeholder either way).

**2b. The berm cap is discontinuous.** For `N >= 5.03` the spec gives "20 (wall); 23 for a
berm", but below 5.03 it gives only the wall formula. A berm therefore jumps from 20.0 to
23.0 dB at N = 5.03. R2 quotes eq. 15 as `20(1 + 0.15e)`, and its lower bound
`-0.1916 - 0.0635e` also depends on `e`, so the berm has its own curve that the spec leaves out.
**Fix:** either drop berms (no input marks one today) or state that berm values below N = 5.03
are unspecified.

**2c. The window-open rule subtracts orientation on top of a whole-house figure (minor).**
The spec says `F_i,s = 10^((L_wall,s - 12)/10)`. R3 E5 says the 12 dB is "a whole-room empirical
reduction measured against the free-field outdoor level". Starting from `L_wall` takes off up to
10 dB of orientation as well, so an open back window gives 22 dB, close to a closed front room
(about 24). This is a defensible refinement, but it departs from the source and should be
flagged as an S1 choice in section 6.C.

## 3. Placeholders, missing values and source spot-check: FAIL

### 3a. Every value marked `placeholder` (31)

1. `time.night_share.aviation` (0.15)
2. `outdoor.construction.allowed_hours` (07 to 20)
3. `outdoor.construction.hours_worked`
4. `propagation.orientation.multi_source_bearing_limit` (45 deg)
5. `propagation.dominant_road.search_radius` (300 m)
6. `propagation.dominant_road.osm_classes`
7. `propagation.dominant_road.min_reference_distance` (15 m)
8. `propagation.barrier.plus_foliage_cap` (20 dB)
9. `propagation.foliage.tree_cover_input`
10. `facade.window_fraction_default` (0.15)
11. `facade.default_era_when_year_unknown` (1980 to 1999)
12. `walls.uninsulated_offset` (-2)
13. `walls.concrete_block` (40)
14. `walls.roof` (era wall)
15. `leak_fraction.after_window_upgrade` (0.001)
16. `era_defaults.before_1960`
17. `era_defaults.1960_1979`
18. `era_defaults.1980_1999`
19. `era_defaults.2000_on`
20. `rooms.reverberation_time_by_type`
21. `rooms.height_default` (2.4 m)
22. `rooms.storey_height` (3.0 m)
23. `partitions.door_width` (0.81 m)
24. `partitions.derating.wood_floor` (8)
25. `partitions.derating.concrete` (8)
26. `partitions.derating.door_leaf` (5)
27. `solver.tolerance` (0.01 dB)
28. `solver.merge_coupling_limit` (0.5)
29. `reporting.plausible_output_range` (15 to 100)
30. `validation.case_error_limit` (5 dB)
31. `validation.mean_error_limit` (3 dB)

The demo depends directly on 10, 11, 16 to 19 and 26: every demo room uses the 15% window, the
1980 to 1999 era and (with a door closed) the door-leaf derating.

### 3b. Values used in SOUND_MODEL.md that are missing from assumptions.yaml

The yaml header says it holds "every value the model uses". These are missing:

1. **61 m (200 ft) tree-path limit.** Section 3.3 has `r_f = cover_fraction * min(distance_to_road, 61 m)`.
   No yaml key holds 61. It should be a placeholder.
2. **Default exterior door type.** Section 4 says "Default is hollow core". There is no yaml key.
3. **Default partition and interior door types** (2x4 stud wall, hollow-core leaf, both marked
   "(default)" in section 4). There is no yaml key.
4. **Interior door area or height.** Only `door_width` 0.81 m exists. The 1.6 m2 door area used in
   section 5 and the composite door rows comes from plan section 1.1 sample data.
5. **Vexcel roof-height choice** (structure value, 1.5 m uncertainty, section 7). Minor, and not
   used in any equation yet.

Also, `hourly_offset_day` and `hourly_offset_night` (1.34 and -3.98) are fixed numbers in the
yaml, but they are derived from `night_share`. If aviation's placeholder share ever changes,
these keys will be wrong for aviation. Compute them per mode in code, or key them by mode.

### 3c. Spot-check of status labels against R1 to R6 (25 checked; 7 not supported)

Supported as labelled (18): `night_share.road` 0.15 (R1, Indiana HUD slide, medium);
`bts.floor` 45 (R1 [V3] p.8 and the Esri item); `bts.receptor_height` 1.5 (R1 [V3] p.4); all 8
RCNM equipment rows (R1 Table 1 quotes match digit for digit); `barrier.cap_berm` 23 (R2 Fig. 8);
`building_rows` 3/5/0/1.5/10 (R2 p.34 quotes); `facade.aircraft_rating_offset` -3 (R3 NRC quote);
`windows_open_reduction` 12 (R3 EPA Table II); `walls.brick_veneer` 40 (R3 NRC); `windows.double_pane_2000_on`
22 (R3 Viwinco); `doors_exterior` 18/20/20/24 (R3 FAA Table 3-5, OCR); `partitions.stud_wall` 33 and
`derating.stud_wall` 8 (R4 CBD-239; TL1766 and NAIMA mean 8.3); `door_hollow_core` 21 (R4 NBS);
`leak_fraction` pre-2000 rows (R3 E3 calibration reproduces); `hud_interior_dnl` 45 and
`who_bedroom_night` 30 (R6 quotes); `closed_house_nlr` [18, 27] (R3 FAA quote).

Not supported as labelled (7):

| Key | Label | Problem | Should be |
|---|---|---|---|
| `facade.incidence_constant` (3) | sourced | R3 E1 says "The hemisphere average and the 2/pi road average are my derivation, not quoted text". ASTM E966 gives the plane-wave form only. | `derived` (or placeholder), with R3 E1 as the source |
| `facade.incidence_constant_line_source` (4.0) | sourced | Same derivation | `derived` |
| `propagation.orientation.back_wall_loss` (10) | calibrated | The yaml header defines `calibrated` as "tuned so the model matches measured field data". Nothing was tuned. R2 picked 10 from a 7 to 13 range. | `placeholder` (value inside a sourced range) |
| `reporting.range_default` (5) | calibrated | R6 calls it a judgement from the Swiss R2 and the FAA spread. No fit was made. | `placeholder` or `judgement` |
| `reporting.range_measured_windows` (3) | calibrated | Same | `placeholder` or `judgement` |
| `validation.bedroom_1990s_65db` [39, 43] | sourced | levels.htm gives only 24 dB NLR. The band is R6's own derivation (R6 conflict 1: "should land near 39 to 43"). | `derived` |
| `propagation.foliage.max_path` (200 m) | sourced | R2 says it came from a "search snippet, not opened" | `sourced`, low confidence, or placeholder |

Borderline, acceptable with a note: `orientation.side_wall_loss` is the hard-site formula, while
BTS assumes soft ground (R2 conflict 4). `windows.single_pane` 22 is a centre-of-glass value used
as a whole unit. `rooms.sabine_constant` has no URL. `time.blocks` is a team decision, not a source.

## 4. Extreme inputs on paper: FAIL (one of three)

The setup for all three cases is R3's bedroom: 4 x 3.5 x 2.4 m, one 9.6 m2 exterior wall,
A = 10.82 m2, 1980 to 1999 defaults, front wall, 65 dBA free field unless stated.

**4a. No windows. Plausible but optimistic.**
- Brick veneer: T = 9.6 x 10^-4 = 0.00096 m2 and R = 40.0. L = 65 + 3 - 40 - 0.52 = **27.5 dBA**,
  NLR 37.5 dB.
- Vinyl siding (24): **43.5 dBA**, NLR 21.5.

The vinyl result is reasonable. The brick result is above the FAA "18 to 27" range for existing
homes and near FAA's "40 dB practical maximum". The reason is that the leak term exists only
per opening, so a windowless wall gets pure lab OITC with no field correction at all. R6 quotes
FHWA: field walls are "on the average, 4 dB lower than laboratory values". With R = 36 the
answer is **31.5 dBA (NLR 33.5)**, which is more believable. Adding that 4 dB to opaque walls
everywhere moves the calibrated 1990s room by only 0.23 dB (41.2 to 41.4), so it barely
disturbs R3's calibration. This is not a fail on its own: the case is rare in a room-level
model, and the direction of the error is known.

A related case is a room with no exterior wall at all. The corridor with its door closed gives
7.2 dBA (section 5). The physics is right, but real interior rooms also get flanking paths,
which the model leaves out. Show such rooms as "below 15" rather than a precise number (agrees
with spec 6.C2).

**4b. A wall that is all window. FAIL: physically too loud.**
1980 to 1999, all 9.6 m2 glazed:
- Window term: 9.6 x 10^-2.3 = 0.0481 m2.
- Leak term: 0.01 x 9.6 = 0.096 m2. That is a 31 x 31 cm open hole.
- Composite R = 18.24 dB.
- L = 65 + 3 - 18.24 - 0.52 = **49.2 dBA**, so NLR **15.8 dB**. The leak is 67% of the energy.

Other eras: before 1960 is 49.6 (NLR 15.4), 2000 onward is 46.1 (NLR 18.9), and a fixed picture
unit (25) is 48.7.

An NLR of 15.8 dB with every window closed is below every closed-window US room in R6 (minimum
21.5; C1 DR/K, "one exterior facade with a large window area", measured 22.2). It is below the
FAA range for existing dwellings (18 to 27) and even below FHWA "light frame, ordinary sash" (20).
It sits barely above the EPA *open-window* warm-climate figure (12). The cause is that
`f * sum S_k` grows linearly with glass area. R3 calibrated f at 15% glazing, and its own physical
basis (R3 E4) is air leakage of *operable* sash. A large glazed wall is mostly fixed glass with
little or no air leakage.

**Fix (placeholder):** cap the leak area per wall at the calibrated amount,
`f * min(sum S_k, 0.15 * S_w)`, or apply f to operable window area only. With the cap, the
all-glass 1990s wall gives **45.6 dBA (NLR 19.4)**, inside the FAA range. The 15% case is
unchanged, so the calibration still holds.

**4c. 85 dBA outside. PASS.** The model is linear, so every result moves up by exactly 20 dB:
- 1990s bedroom 61.2 dBA; before 1960, 65.1 dBA. Window open: 73 dBA.
- If 85 is the BTS L24: outdoor DNL 88.7, bedroom DNL 64.9, night 57.2. HUD and WHO both flag
  it, as they should.

NLR does not depend on level for airborne transmission, so this is physically right. R1
conflict 8 notes that BTS pixels on the freeway itself read 85 to 99 dBA, so 85 at a facade
means a house next to a freeway. That is extreme but real.

Note that the service maximum is 124.9 dBA (R1). A pixel sampled inside a roadway cell could
push a room past the 100 dBA output bound. Sampling "at the facade point" (R1 E1) must never
land in a roadway cell.

## 5. Other things that would give a wrong number in the demo: FAIL

**5a. DNL from block averages is biased 1.03 dB high.**
Plan section 1.3 says "`dnl_dba` is computed from the five blocks with the 10 dB night penalty
on 22:00 to 07:00 (... the last two hours of `evening`, the first hour of `morning_rush`)". The
spec repeats this for the detailed form: "each hour takes its block's level". The spec's own
block offsets, expanded that way, give DNL = **L24 + 4.74**, not L24 + 3.71. The night hours
06-07, 22-23 and 23-24 take the block mean, which includes the louder day hours, and then get
the 10 dB penalty on top.

For the demo bedroom that is **30.6 dB instead of 29.5**. If a developer follows plan 1.3 in the
simple form, every DNL reads 1.03 dB high, and HUD 45 flags trip about 1 dB early. Section 3.2
correctly says to use hourly values for the simple form, but the plan contradicts it.

**Fix:** state in both documents that DNL always comes from 24 hourly values. For the detailed
form, split `morning_rush` at 07:00 and `evening` at 22:00 (or have R9 supply hourly values) so
no block straddles a DNL boundary.

**5b. log10(0) when no mode is above the BTS floor.** The spec drops a mode whose pixel is
exactly 45.0. If every mode is 45.0 and there is no construction, then `sum_s E_i,s = 0` and
`10*log10(0)` fails or returns -inf. A quiet Houston street can hit this.
**Fix:** report "below the 45 dBA mapped floor outdoors" with a null `dba`. For an upper bound,
run the room at 45.

**5c. Negative opaque area.** `S_op = S_w - sum S_k` has no guard. Hand-entered demo geometry
with window area larger than wall area gives a negative transmission term and a wrong or NaN
level. **Fix:** clamp, and flag the input.

**5d. Rail and construction have no bearing rule.** Section 3.3 applies orientation to road, rail
and construction, but defines `alpha` only against "the dominant road" picked from OSM highway
classes. No rule picks the dominant rail line (OSM `railway=rail`) or uses the bearing to a
construction site. At City Hall rail is 51.2 dBA (R1), so rail is a live source in the demo city.
**Fix:** state that alpha for rail uses the nearest `railway=rail` way, and that alpha for
construction uses the bearing to the site point.

**5e. The demo input is not the demo address.** The worked example uses the City Hall road pixel
(54.8) "standing in until the Yale St pixel is decoded". BTS changes by more than 1 dB per 30 m
near major roads (R1 conflict 8), so the demo bedroom level is unknown until that pixel is
decoded. A major road may well be within the 300 m search radius. I have not verified which
road wins the dominant-road test at 29.8059, -95.3994, and that choice sets alpha for every wall.
**Fix:** decode the Yale St pixels (per mode, at each facade) and rerun section 5 before the
demo.

**5f. The unit's height and facade are unknown.** R5 says the unit is in a building of about 5
storeys, with no data on floor or facade. Plan 1.1's sample sets `storeys: 1`. BTS is a 1.5 m
receptor over soft ground. An upper-floor unit loses part of that ground attenuation and has
more line of sight, so it may read several dB above BTS. The size of that is unsourced and the
model has no height term. Aircraft roof exposure also depends on whether the unit is on the top
floor. The spec lists the facade gap in section 7, but not the receptor-height bias. Add it to
section 7, and keep the demo at +/- 5 dB.

**5g. Rush blocks read quieter than midday.** In the simple form `morning_rush` (+0.49) is below
`midday` (+1.34), because the flat HUD profile gives every day hour the same level. A demo chart
labelled "rush hour" that dips below midday will draw questions. This is not wrong given the
inputs, but either label it as a flat-profile estimate until R9 lands or hide the block names in
the simple form.

## Summary of corrected figures

| Where | Spec | Corrected | Why |
|---|---|---|---|
| Demo bedroom DNL if computed from blocks (plan 1.3) | 29.5 | 30.6 | 5a; use hourly values |
| Simple-form DNL offset via blocks | 3.71 | 4.74 | 5a |
| All-glass 1990s wall, 65 dBA out | 49.2 dBA (NLR 15.8) | 45.6 dBA (NLR 19.4) with the leak area capped | 4b |
| Windowless brick wall | 27.5 dBA (NLR 37.5) | about 31.5 dBA (NLR 33.5) with the FHWA 4 dB field derate | 4a |
| Largest total shielding on one wall | 40 dB | at most 25 dB (cap) and orientation or rows, not both | 2a |
| R4 composite doors before derating (6.B5) | 18.5 / 21.4 | 18.4 / 21.3 | 1, nit |
| Status of 7 yaml keys | sourced or calibrated | derived or placeholder | 3c |
