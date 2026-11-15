# R3. Facade transmission and the leak calibration

Research for issue #4. Scope: US housing, Houston as the demo city. No model code here.
Every number has a URL or is marked `unsourced`. Values derived by arithmetic from sourced
inputs are marked `calibrated` or `derived` and show their working.

## Answer

The section 2.2 equation is right in form. ASTM E966 confirms that the indoor level depends on
the free-field outdoor level, the element's transmission loss, `10*log10(S/A)` and a constant.
For random-incidence traffic noise that constant works out to `+3`. Lab ratings alone
(NRC-measured brick veneer wall OITC 40, typical residential window OITC 22 to 23) predict
36.7 dBA in the plan's 1990s bedroom at 65 dB outside. US field data for closed houses say
otherwise: 20 to 25 dB typical, 18 to 27 dB overall (FAA/Wyle). EPA gives 24 dB for warm
climates and FHWA gives 25 dB for masonry with single glazing. So real houses are 3 to 8 dB
louder than lab ratings predict. A leak term of about 1% of window area (R = 0) closes that gap
for all pre-2000 eras and puts the 1990s brick house at **41.2 dBA**, inside the 40 to 47 target.
The 1% also lines up with NRC's air-leakage equation for windows: 1% is about half the current
code maximum window air leakage. For 2000-onward houses no US field measurement was found, so
0.1% is a low-confidence fallback. With windows open, use a 10 to 12 dB total reduction (FHWA,
EPA warm climate) instead of the facade calculation.

## Values

Confidence: high = primary source, measured, directly applicable; medium = primary source but
modeled, or measured on a near-equivalent assembly; low = indirect, extrapolated or calibrated
on thin data.

### Exterior walls

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| wall.vinyl_siding_2x6_insulated.oitc | 25 | OITC | https://nrc-publications.canada.ca/eng/view/accepted/?id=361fd5c8-82ff-4c50-ba7b-d9f6739fef25 | Table II: "Base wall ... 25" (vinyl siding on 11 mm OSB, 140 mm studs at 406 mm, glass fibre in cavity, 13 mm gypsum) | high |
| wall.vinyl_siding_2x4_insulated.oitc | 24 | OITC | same as above | "reduction of the OITC rating from 25 to 24" (89 mm studs, same spacing) | high |
| wall.2x4_vs_2x6.delta | -1 to -4 | OITC points | same as above | "results for 89-mm wood stud walls are 1 to 4 OITC points lower" | high |
| wall.aluminum_siding_2x6.oitc | 25 | OITC | same as above | Table II: "Aluminum siding 0 25" | high |
| wall.acrylic_stucco_EIFS_2x6.oitc | 27 | OITC | same as above | "increased to 27 when vinyl siding is replaced by acrylic (EIF) stucco" | high |
| wall.cement_stucco_2x6.oitc | 29 | OITC | same as above | "and to 29 when a heavier cement stucco exterior is used" | high |
| wall.brick_veneer_2x6.oitc | 40 | OITC | same as above | "adding brick as the outer layer ... OITC rating which is increased to 40" | high |
| wall.cavity_insulation_type.delta | +0 to +2 | OITC points | same as above | "OITC rating of 34 for the glass fiber insulation increased to 35 for the cellulose ... 36 for the mineral fiber" | high |
| wall.brick_houston_modern.oitc / stc (modeled) | 48 / 53 | OITC / STC | https://repository.gatech.edu/server/api/core/bitstreams/124b4a58-8706-4fc8-9139-9b18ed96233e/content | Table 3.4: "Hot Humid Houston 1st 53 48" | medium (Insul model, not a test) |
| wall.brick_houston_older_2x4.oitc / stc (modeled) | 46 / 52 | OITC / STC | same as above | Table 4.2: "Houston1st_HotHumid_Brick 53 48 52 46" | medium (model) |
| wall.fibercement_houston_2nd_floor.oitc / stc (modeled) | 37 / 46 | OITC / STC | same as above | Table 3.4: "Hot Humid Houston 2nd 46 37" | medium (model) |
| wall.fibercement_older_2x4.oitc / stc (modeled) | 33 / 44 | OITC / STC | same as above | Table 4.2: "Houston2nd_HotHumid_Fibercement 46 37 44 33" | medium (model) |
| wall.wood_siding_mean_modern.oitc / stc (modeled) | 35 / 40 | OITC / STC | same as above | Table 4.2: "MEAN WOOD 40 35 38 31" | low (model; 1 inch board sidings in cold climates) |
| wall.wood_siding_mean_older.oitc / stc (modeled) | 31 / 38 | OITC / STC | same as above | same row as above | low |
| wall.vinyl_aluminum_mean_older.oitc / stc (modeled) | 25 / 36 | OITC / STC | same as above | Table 4.2: "MEAN VINYL/ALUMINUM 38 28 36 25" | low |
| wall.stucco_mean_older.oitc / stc (modeled) | 38 / 46 | OITC / STC | same as above | Table 4.2: "MEAN STUCCO 47 42 46 38" | low |
| wall.type_matters_little | qualitative | n/a | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf | "noise reduction varies only slightly with the type of wall, roof, and floor construction" | high |
| wall.concrete_block.oitc | not found | OITC | https://www.cmha.org/resource/tek-13-04a/ | "for concrete masonry walls, heavier walls have higher OITC values" (table is an image, not read) | n/a |
| oitc.meaning | A-weighted level reduction for a reference transport spectrum | dB | https://nrc-publications.canada.ca/eng/view/accepted/?id=361fd5c8-82ff-4c50-ba7b-d9f6739fef25 | "essentially the A-weighted level reduction with a standard source spectrum" | high |
| oitc.aircraft_spectrum_offset | about -3 | dB | same as above | "Using an aircraft noise spectrum ... led to reduced overall level ratings of about 3 dB" | high |

### Windows

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| window.double_pane_1/8_1/2air_1/8_single_hung.oitc / stc | 22 / 27 | OITC / STC | https://www.viwinco.com/cambridge-performance-data/ | "Single-Hung ... 1/8" annealed, 1/2" spacer, 1/8" annealed ... 27 ... 22" | high (manufacturer test of whole unit) |
| window.double_pane_slider.oitc / stc | 22 / 27 | OITC / STC | same as above | "2-Lite Slider ... 27 ... 22" | high |
| window.double_pane_picture_fixed.oitc / stc | 25 / 31 | OITC / STC | same as above | "Picture ... 31 ... 25" | high |
| window.wood_slider_3/13/3.oitc | 22 | OITC | https://repository.gatech.edu/server/api/core/bitstreams/124b4a58-8706-4fc8-9139-9b18ed96233e/content | "Wood Slider (WS, OITC 22)" (NRC IBANA-Calc lab data, two 3 mm panes, 13 mm air) | high |
| window.vinyl_double_slider_3/13/3.oitc | 23 | OITC | same as above | "Vinyl Double Slider (VDS, OITC 23)" | high |
| window.aluminum_casement_3/13/3.oitc | 23 | OITC | same as above | "Aluminum Casement (AlC, OITC 23)" | high |
| window.double_pane_plus_storm_1in.oitc | 27 | OITC | same as above | "VDS with Storm Window, 1 Airgap (VDS1SW, OITC 27)" | high |
| window.alum_casement_plus_storm_1in.oitc | 25 | OITC | same as above | "AlC with Storm Window, 1 Airgap (AlC1SW, OITC 25)" | high |
| window.alum_casement_plus_storm_3in.oitc | 30 | OITC | same as above | "AlC with Storm Window, 3 Airgap (AlC3SW, OITC 30)" | high |
| window.single_pane_3mm.oitc / stc (centre of glass) | 22 / 28 | OITC / STC | https://guardianglass.com/content/dam/guardianindustriesholdings/collateral/usca/brochure_expert_series_EN_doc1_acoustics_2020.pdf | Table 2: "Single Pane 3 mm 22 28" | medium (glass only, no frame or leaks) |
| window.single_pane_6mm.oitc / stc (centre of glass) | 28 / 30 | OITC / STC | same as above | "6 mm 28 30" | medium |
| window.laminated_3_pvb_3.oitc / stc (centre of glass) | 28 / 32 | OITC / STC | same as above | "3 mm : Standard 0.030" PVB : 3 mm 28 32" | medium |
| window.laminated_acoustic_6_pvb_6.oitc / stc (centre of glass) | 35 / 40 | OITC / STC | same as above | "6 mm : Acoustic 0.060" PVB : 6 mm 35 40" | medium |
| window.dual_laminated_acoustic_IG.oitc / stc (centre of glass) | 38 / 48 | OITC / STC | same as above | "Acoustic 0.060" PVB ... 1/2" Air ... Acoustic 0.060" PVB ... 38 48" | medium |
| window.lab_to_site_loss | up to 6 | dB | same as above | "A potential 6 dB performance loss between a laboratory test specimen and a site-installed panel" | medium |
| window.openable_vs_sealed.stc_loss | 3 to 5 | STC points | https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd240_e.html | "For a window with good weatherstripping, the STC is usually from 3 to 5 lower" | high |
| window.storm_effect_field | +4 | dB NR | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf | "The effect of adding storm windows is to increase the noise reduction by about 4 dB" | high |
| window.condition_effect_field | about 2 | dB NR | same as above | "The difference between poor and good conditions is on the order of 2 dB" | high |
| window.code_air_leakage_max (2000s IECC/IRC wording) | 1.5 (0.3) | L/s per m2 (cfm per ft2) at 75 Pa | https://lawfilesext.leg.wa.gov/Law/WAC/WAC%20%2051%20%20TITLE/WAC%20%2051%20-%2011R%20CHAPTER/WAC%20%2051%20-%2011R-40240.htm | "no more than 0.3 cfm per square foot (1.5 L/s/m2)" | medium (Washington's adoption of the model-code text; Texas adopts the IRC energy chapter, see below) |

### Exterior doors (aircraft-spectrum EWR, close to OITC in intent)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| door.hollow_core.ewr (poor / good weatherstrip) | 18 / 19 | dB EWR | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf | Table 3-5: "HC NO 18 19" | medium (OCR of a 1992 scan) |
| door.solid_core_wood.ewr | 20 / 21 | dB EWR | same as above | Table 3-5: "SC NO 20 21" | medium |
| door.sliding_glass.ewr | 20 / 23 | dB EWR | same as above | Table 3-5: "SGD NO 20 23" | medium |
| door.solid_core_plus_storm.ewr | 24 / 25 | dB EWR | same as above | Table 3-5: "SC YES 24 25" | medium |
| door.room_with_exterior_door.field_penalty | 4 to 6 | dB less NR | same as above | "noise reduction for rooms with an exterior door is 4 to 6 dB less" | high |
| door.steel_insulated.oitc | not found | | | | n/a |

### Measured outdoor-to-indoor reductions of real houses (windows closed unless stated)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| nlr.fhwa.all_windows_open | 10 | dB | https://www.fhwa.dot.gov/Environment/noise/regulations_and_guidance/analysis_and_abatement_guidance/polguide02.cfm | Table 6: "All Open 10dB" | high |
| nlr.fhwa.light_frame_ordinary_sash_closed | 20 | dB | same as above | "Light Frame Ordinary Sash (closed) 20dB" | high |
| nlr.fhwa.light_frame_storm_windows | 25 | dB | same as above | "Storm Windows 25dB" | high |
| nlr.fhwa.masonry_single_glazed | 25 | dB | same as above | "Masonry Single Glazed 25dB" | high |
| nlr.fhwa.masonry_double_glazed | 35 | dB | same as above | "Double Glazed 35dB" | medium (see Conflicts) |
| nlr.fhwa.windows_assumed_open | rule | | same as above | "windows shall be considered open unless there is firm knowledge" they stay closed | high |
| nlr.epa.warm_climate_open / closed | 12 / 24 | dB | https://nonoise.org/library/levels/levels.htm (copy of EPA 550/9-74-004, 1974) | Table II: "Warm Climate 12dB 24dB" | high |
| nlr.epa.cold_climate_open / closed | 17 / 27 | dB | same as above | "Cold Climate 17dB 27dB" | high |
| nlr.epa.national_open / closed | 15 / 25 | dB | same as above | "Approximate National Average 15dB 25dB" | high |
| nlr.faa.typical_unmodified_house | 20 to 25 | dB | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf | "A more typical, unmodified dwelling might provide 20 to 25 dB of noise reduction" | high |
| nlr.faa.well_insulated_closed_house | 30 | dB | same as above | "acoustically well-insulated home that is kept closed can provide 30 dB" | high |
| nlr.faa.range_existing_dwellings | 18 to 27 | dB | same as above | "lies generally in the range 18 to 27 dB depending only on the type of windows and doors" | high |
| nlr.faa.practical_max | 40 | dB | same as above | "not usually practical to try to provide more than 40 dB of NLR" | high |
| nlr.nrc.toronto_new_houses.lab_prediction_error | within 1 | dB | https://repository.gatech.edu/server/api/core/bitstreams/124b4a58-8706-4fc8-9139-9b18ed96233e/content | "measured overall A-weighted noise level reductions matched the predictions within 1 dB" | medium (secondary report of NRC validation; Canadian new houses) |
| hud.interior_goal | 45 | dB DNL | https://www.law.cornell.edu/cfr/text/24/51.101 | "shall not exceed a day-night average sound level of 45 decibels" | high |
| hud.extra_attenuation_65_70 / 70_75 | 5 / 10 | dB beyond typical construction | https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.104 | "a minimum of 5 decibels additional sound attenuation" (and 10 dB for 70 to 75) | high |
| hud.baseline_assumes_open_windows | rule | | same as above | "buildings as commonly constructed in the area, and requiring open windows for ventilation" | high |
| hud.typical_construction_reduction | 20 (implied by 65 dB acceptable minus 45 dB goal) | dB | `unsourced` as a stated number (HUD Noise Guidebook could not be downloaded) | none | low |

### Houston construction context

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| gulf_coast.survey_1989.wall_mix (Corpus Christi, 1,900 homes) | brick or brick and siding 40, siding 34, manufactured 12, stucco 11, block 2 | % | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf | "Brick/Brick & Siding 40% Siding (wood, aluminum, etc.) 34%" | medium (nearest Gulf Coast survey; not Houston) |
| gulf_coast.survey_1989.windows | aluminum 77, wood 21, jalousie 2; storm windows 0 | % | same as above | "Windows: Aluminum (incl MH) 77% Wood 21% Jalousie 2% Storm Windows & Doors: 0%" | medium |
| gulf_coast.survey_1989.slab_foundation | 72 | % | same as above | "Foundation: Slab 72%" | medium |
| houston.modern_construction | brick first floor, fiber cement second floor | | https://repository.gatech.edu/server/api/core/bitstreams/124b4a58-8706-4fc8-9139-9b18ed96233e/content | Table 4.1: "Hot Humid Houston1 3.5" Brick" and "Houston2 5/16" Fibercement" | medium |
| older_homes.framing | 2x4 at 16 in | | same as above | "almost all older homes were constructed with 2x4 framing, 16 OC" | medium |
| texas.state_energy_code_start | 2001-09-01, IRC energy chapter as of 2001-05-01 | date | https://tcss.legis.texas.gov/resources/HS/htm/HS.388.htm | "International Residential Code, as it existed on May 1, 2001, is adopted as the energy code" | high |
| houston.window_glazing_by_era | not found | | | | n/a |

### Calibrated values (this file, from the sourced values above)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| leak_fraction.pre_1960 | 0.01 | m2 leak per m2 opening, R = 0 | calibrated here, target FHWA light frame 20 dB | see Equations, E3 | low to medium |
| leak_fraction.1960_1979 | 0.01 | same | calibrated here, target EPA warm closed 24 dB | see E3 | medium |
| leak_fraction.1980_1999 | 0.01 | same | calibrated here, target EPA warm closed 24 dB / FHWA masonry 25 dB | see E3 | medium |
| leak_fraction.2000_on | 0.001 | same | calibrated here, target top of the FAA range, 27 dB (no US field data for new homes found) | see E3 | low |
| windows_open.total_reduction | 12 (range 10 to 15) | dB, outdoor free-field to indoor | EPA warm climate 12; FHWA 10; EPA national 15 | see E5 | medium |

## Equations

### E1. Facade to room (confirms the `+3` and `10*log10(S/A)` terms)

```
L_room = L_ff - R_facade + 10*log10(S / A) + C
C      = 6 + 10*log10(cos(theta))        single plane wave at angle theta (ASTM E966)
C      = +3                               random incidence, e.g. traffic from many directions
C      = 6 + 10*log10(2/pi) = +4.0        long straight road, horizontal angles evenly spread (derived)
A      = 0.161 * V / T
```

- `L_ff`: free-field outdoor A-weighted level at the facade position, with the house absent
  (no facade reflection). dB. The BTS map value after R2's corrections is this quantity.
- `R_facade`: composite transmission loss of the room's exterior surfaces (E2). dB. OITC is used
  as the broadband A-weighted R.
- `S`: exterior facade area of the room seen from inside. m2. `A`: room absorption. m2 sabins.
  `V`: room volume, m3. `T`: reverberation time, s.
- `theta`: angle of incidence from the facade normal.

Source and reasoning. ASTM E966-18a scope (https://store.astm.org/e0966-18a.html): the incident
intensity "is reduced by cos(θ) when the sound is not incident normal to the surface", and
for a plane wave "the resulting sound intensity in this direction is 4 times that due to
diffuse-field sound of the same level"; "These factors are reflected by the cos(θ) and 6 dB
terms in Eq 6." So E966 has `+6 + 10*log10(cos theta)` in the free-field form. For random
incidence, averaging `cos theta` over a hemisphere weighted by solid angle gives 1/2, which is
-3 dB, so C = +3. That matches the plan. (The hemisphere average and the 2/pi road average are
my derivation, not quoted text. ISO 12354-3 and ISO 16283-3 could not be read, see Not found.)
The `10*log10(S/A)` term is the standard receiving-room term. The Georgia Tech/FAA thesis
(URL above) defines it with "S is the surface area sound is being transmitted through" and
"A is the total absorption in the receiving room".

Worked example (plan bedroom 4 x 3.5 x 2.4 m, one exterior wall 4 x 2.4 m):
V = 33.6 m3, T = 0.5 s, A = 0.161 * 33.6 / 0.5 = 10.82 m2, S = 9.6 m2,
10*log10(9.6 / 10.82) = -0.52 dB. With L_ff = 65 and C = +3:
L_room = 65 + 3 - 0.52 - R_facade = 67.48 - R_facade.

### E2. Composite facade with leak term (plan section 2.2 and 2.4, kept)

```
tau_facade = [ S_wall*10^(-R_wall/10) + sum_i S_i*10^(-R_i/10) + sum_i f(era)*S_i*10^(0) ] / S
R_facade   = -10*log10(tau_facade)
```

- `S_wall`: opaque wall area, m2. `S_i`: area of opening i (window, door), m2. `S` = total.
- `R_wall`, `R_i`: OITC (or EWR for doors), dB.
- `f(era)`: leak fraction, dimensionless (leak area in m2 per m2 of opening, R = 0).

Worked example (1990s brick, 15% window, sourced values only):
S_window = 1.44 m2, S_wall = 8.16 m2, R_wall = 40 (NRC brick veneer), R_window = 23
(IBANA vinyl double slider), f = 0.01.

| term | value (m2) |
|---|---|
| wall: 8.16 * 10^(-4.0) | 0.000816 |
| window: 1.44 * 10^(-2.3) | 0.007217 |
| leak: 0.01 * 1.44 * 1 | 0.014400 |
| sum / 9.6 = tau | 0.002337 |

R_facade = -10*log10(0.002337) = 26.31 dB.
L_room = 67.48 - 26.31 = **41.2 dBA**. This passes the done criterion (40 to 47).
Lab ratings only (f = 0): tau = 0.008033 / 9.6 = 0.000837, R = 30.77 dB, L_room = 36.7 dBA,
which fails the criterion. The leak term is the largest single path here, so the UI should
report it as part of the window path ("window and frame leakage").

### E3. Leak calibration from measured field NLR

```
NLR_field = L_ff - L_room                        (how FAA, EPA and FHWA report it)
R_needed  = NLR_target + C + 10*log10(S/A)
f         = ( S * 10^(-R_needed/10) - [S_wall*10^(-R_wall/10) + sum S_i*10^(-R_i/10)] ) / sum S_i
```

Worked example, 1980 to 1999 brick, target NLR 24 (EPA warm climate, closed):
R_needed = 24 + 3 - 0.52 = 26.48 dB. S * 10^(-2.648) = 9.6 * 0.002249 = 0.02159 m2.
Minus lab terms 0.008033 gives 0.01356 m2. Divided by 1.44 m2 gives f = 0.0094, rounded to 0.01.

Era results for the plan bedroom (15% window, 65 dB outside):

| era (Houston default) | wall, OITC | window, OITC | target NLR (source) | f needed | f recommended | L_room lab only | L_room with f |
|---|---|---|---|---|---|---|---|
| before 1960 | wood or vinyl siding, 2x4, 24 | single pane sash, 22 | 20 (FHWA light frame, ordinary sash) | 0.0088 | 0.01 | 43.9 | 45.1 |
| 1960 to 1979 | brick veneer, 40 | single pane aluminum, 22 | 24 (EPA warm, closed) | 0.0081 | 0.01 | 37.6 | 41.5 |
| 1980 to 1999 | brick veneer, 40 | double pane aluminum or vinyl, 23 | 24 (EPA warm, closed) | 0.0094 | 0.01 | 36.7 | 41.2 |
| 2000 onward | brick veneer (fiber cement on upper floors, OITC 37), 40 | double pane low-e vinyl, 22 | 27 (top of FAA 18 to 27 range) | 0.0006 | 0.001 | 37.6 | 38.2 |

Sensitivity of the 1990s case to the target: NLR 25 (FHWA masonry single glazed) gives
f = 0.0063 and 40.0 dBA. NLR 20 (HUD implied, FHWA light frame) gives f = 0.032 and 45.0 dBA.
Every value in the FAA 20 to 25 dB "typical" band lands inside 40 to 47.

Behaviour checks with f = 0.01 (before 2000) and 0.001 (2000 onward), 65 dB outside:

| case | 5% window | 15% window | 30% window |
|---|---|---|---|
| before 1960 | 44.1 | 45.1 | 46.3 |
| 1960 to 1979 | 37.1 | 41.5 | 44.4 |
| 1980 to 1999 | 36.8 | 41.2 | 44.1 |
| 2000 onward | 34.1 | 38.2 | 41.0 |

The implied field NLRs span 18.7 to 30.9 dB, which sits in the FAA 18 to 27 dB range for existing
homes and its 30 dB "well-insulated" figure. Two field checks pass:
- Adding a 1.9 m2 solid-core door (EWR 20) with the same 1% leak to the 1990s room raises it from
  41.2 to 45.5 dBA (+4.3 dB). FAA says rooms with an exterior door have 4 to 6 dB less NR.
- Fix "replace window with laminated acoustic glazing (OITC 35) and new seals (f = 0.001)":
  32.0 dBA, a 9.2 dB gain. Fix "seal only" (OITC 23, f = 0.001): 37.4 dBA, a 3.8 dB gain.

### E4. Physical meaning of f: NRC air-leakage equation

Quirt, NRC Canadian Building Digest 240 (https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd240_e.html):

```
delta_STC = 10*log10[ 1 + 0.012 * (L/S) * 10^(STC/10) ]
```

`L`: window air leakage, L/s at 75 Pa. `S`: window area, m2. STC: sealed-window rating.
Rearranged, `10^(-R_leaky/10) = 10^(-R/10) + 0.012*(L/S)`. That is exactly the plan's leak term with

```
f = 0.012 * q        q = L/S in L/s per m2 at 75 Pa
```

Worked example: f = 0.01 means q = 0.83 L/s per m2 (0.16 cfm/ft2). That is about half the
current model-code maximum of 1.5 L/s per m2 (0.3 cfm/ft2). f = 0.001 means q = 0.08 L/s per m2,
a tight new window. Caveat: Quirt's equation is written for STC. Using it for A-weighted traffic
is an extrapolation (low confidence). It does give `f` a physical basis, and it could later
take window air-leakage test data directly. Recommendation: keep `f(era)` from E3 as the
calibrated default, and document E4 as its meaning and a future input.

### E5. Windows open (later toggle)

```
L_room(open) = L_ff - D_open        D_open = 12 dB (EPA warm climate); range 10 (FHWA) to 15 (EPA national)
```

Worked example: 65 dB outside gives 53 dBA (range 50 to 55). This is a whole-room empirical
reduction measured against the free-field outdoor level, so do not also add `+3` or
`10*log10(S/A)`. When a window is open, the open sash dominates the facade, so the reduction
does not depend much on the wall.

## Conflicts

1. **Brick wall OITC: 42 (plan) vs 40 (NRC measured) vs 48 (Georgia Tech Insul model).** We take
   the NRC laboratory measurement (40, 2x6 studs) because it is a real test. The Insul model
   overpredicts brick and stucco compared with NRC tests of similar walls (48 vs 40, and
   38 to 43 vs 27 to 29). For 2x4 walls NRC reports 1 to 4 points lower, but for brick on 2x4 no
   test was found. The choice barely matters: with a 15% OITC 23 window, the wall moving from 37 to
   43 changes the room by under 0.3 dB with the leak term (41.3 to 41.1 dBA).
2. **Window OITC: 26 (plan) vs 22 to 23 (tests).** Manufacturer whole-unit tests (Viwinco 22) and
   NRC lab data (IBANA 22 to 23) are lower than the plan's 26. We take 22 to 23. Single-pane 3 mm
   glass (22, centre of glass) and thin double pane (22 to 23) rate about the same in OITC,
   because thin double glazing has a low-frequency mass-air-mass resonance. So the unknown
   single-vs-double split by era matters little acoustically.
3. **Lab prediction vs field.** NRC's IBANA validation on new Toronto houses matched measured
   A-weighted NLR within 1 dB with no leak term. US field data (FAA 20 to 25 typical, EPA 24
   warm) are 3 to 8 dB below lab-only predictions for older houses. Both can hold: new,
   well-sealed cold-climate houses vs aged warm-climate houses with aluminum sliders and no
   storm windows (0% storms in the Gulf Coast survey). We take the US field data for pre-2000 Houston and near-zero
   leakage for 2000 onward.
4. **FHWA "masonry, double glazed 35 dB".** Lab-only composites with residential double-pane units
   (OITC 22 to 23) give only about 25 to 32 dB NLR (30% to 5% window), so 35 dB cannot be
   reached even with zero leakage. The FHWA row most likely means true double windows with a wide air space (like the
   OITC 30 storm-window case). We do not use it for standard insulating glass.
5. **HUD baseline.** The implied HUD baseline is about 20 dB (65 dB acceptable outside, 45 dB
   goal inside). It is defined for buildings "requiring open windows for ventilation", which would
   point to an open-window number (FHWA 10, EPA 12). We do not use HUD as a calibration target.
   We use the closed-window measurements (FAA, EPA, FHWA). The 20 dB figure appears only as the
   upper-leak sensitivity case (45.0 dBA).
6. **Storm-window effect.** FAA field data say storms add about 4 dB. In E2 a storm only changes
   the window R (23 to 27), and with a 1% leak still present that gives only 0.9 dB. Adding a
   storm also seals the sash, so the fix search should reset `f` to the 2000-onward value when a
   storm or replacement window is applied (OITC 27 with f = 0.001 gives 34.8 dBA, a 6.4 dB gain).
   This is a modeling choice, `unsourced`.
7. **Placeholder leak fractions (4/3/2/1%) vs calibrated (1/1/1/0.1%).** The plan's era-graded
   placeholders are not supported by the sourced data. Once sourced wall and window ratings are
   used, the field data need about 1% for every pre-2000 era. The age penalty comes through the
   weaker wall and window types instead. Older houses are still louder: 45.1 before 1960 vs 41.2
   for the 1990s at 15% window.

## Not found

| item | fallback |
|---|---|
| ISO 12354-3 and ISO 16283-3 equation text (paywalled; previews unreadable) | Use ASTM E966 relation (E1); C = +3 for traffic. Flag as derived. |
| HUD Noise Guidebook text (huduser.gov blocked automated download) | Use 24 CFR 51.101/51.104 text; do not cite a HUD 20 dB number as sourced. |
| ACRP Reports 89 and 152 (TRB server refused connections) | FAA/Wyle 1992 report values above. Worth a manual download for R6 validation cases. |
| Uninsulated wood stud exterior walls, OITC | NRC shows cavity insulation type changes OITC by 0 to 2. Fallback: same as insulated value minus 2, `unsourced`, low. |
| Concrete block exterior walls, OITC (CMHA table is an image) | Use brick veneer value 40 as a heavy-masonry stand-in, `unsourced`. Concrete block is about 2% of Gulf Coast stock (FAA survey), so the impact is low. |
| Wood lap siding on 2x4 (US warm-climate) measured OITC | Use NRC vinyl/aluminum siding 2x4 value 24 (siding type barely changes OITC per NRC). |
| Insulated steel and solid wood entry doors, OITC | FAA EWR solid core 20 (poor) / 21 (good). |
| Houston-specific window glazing (single vs double) by year built | Era table in E3 is `unsourced` as to which type each era uses; acoustically small (Conflict 2). Texas statewide energy code from 2001-09-01 supports a double-pane default from 2000 onward. |
| Houston wall material by era (share of brick vs siding) | Corpus Christi 1989 survey (40% brick, 34% siding) as Gulf Coast proxy; before 1960 default to siding, later to brick veneer, `unsourced` as to era split. Use `construction` field from data when present. |
| US field NLR for post-2000 warm-climate homes | f = 0.001, low confidence; flag for V2 validation against R6 cases. |
| Measured partially open window reductions for US homes | Use E5 range (10 to 15 dB). |
