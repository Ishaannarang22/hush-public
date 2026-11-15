# R2. Propagation corrections (barriers, trees, facade orientation)

Scope: the four outdoor terms in plan section 2.1 (`facade_orientation_loss`,
`barrier_loss`, `foliage_loss`, and the dominant road direction they all depend on).
All levels are A-weighted broadband. US sources first.

## Answer

The plan's Maekawa formula is close but should be replaced by the FHWA manual-method
barrier formula (Kurze-Anderson form) from FHWA-RD-77-108, evaluated at 550 Hz, not
500 Hz, with a cap of 20 dB for walls and 23 dB for berms; on the plan's own worked
example it gives 12.2 dB instead of 12.5 dB. Hoover's foliage rule is real but is a
secondary-source formula; for A-weighted road traffic the US rule (FHWA) is 5 dB for the
first 30 m (100 ft) of dense woods, 5 dB more for the next 30 m, 10 dB maximum, and
ISO 9613-2 gives a gentler 0.05 dB/m at 500 Hz that reaches the same 10 dB cap at 200 m.
We recommend ISO 9613-2 at 500 Hz as the default (continuous, and safer because Vexcel
tree cover does not prove the woods are dense), with the FHWA rule as the upper bound,
and one shared 10 dB cap for trees plus building rows together. The BTS noise map does
not include shielding by terrain or structures, so barrier and building-row terms do not
double-count. Facade orientation: a side wall gets -3.0 dB, which follows exactly from the
FHWA finite-roadway adjustment `10*log10(angle/180)`; the shielded back wall has no single
US design value, and the sourced range is about 7 to 13 dB, so keep -10 dB as a
calibrated default. The dominant road direction should come from OpenStreetMap major roads
ranked by a BTS level sampled near each road, with the raster gradient as a cross-check.

## Values

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| barrier.effective_frequency (traffic) | 550 | Hz | https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm | "A 550 Hz frequency is considered fairly representative for computing barrier attenuation of highway traffic noise." | high |
| barrier.effective_frequency (traffic, all vehicle classes) | 550 | Hz | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, p. 35) | "it is generally assumed that the effective radiating frequency of highway traffic noise for all classes of vehicles is 550 Hz" | high |
| barrier.fresnel_coefficient at 550 Hz | N = 3.21 * delta | 1/m | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, eq. 18) | "N = 2(δ/λ) ... = 3.21(δ) metres" (OCR of eq. 18; c = 343 m/s, f = 550 Hz) | high |
| barrier.single_frequency_error vs octave bands | 0.2 | dBA | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, App. K) | "single position, single frequency (550 Hz) A-weighted levels shows them to be quite close (0.2 dBA)" | high |
| barrier.formula_reference | Kurze and Anderson 1971 | - | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, reference 4) | "Kurze, U. J., Anderson, G. S., "Sound Attenuation by Barriers," Applied Acoustics 4, 35-53, 1971." | high |
| barrier.cap_wall | 20 | dBA | https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm | "In most cases, the maximum noise reduction that can be achieved by a barrier is 20 dB(A) for thin walls" | high |
| barrier.cap_berm | 23 | dBA | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, Fig. 8) | "WALL 20dBA max BERM 23dBA max" | high |
| barrier.N_upper_for_cap | 5.03 | - | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, eq. 15) | "20(1 + 0.15e) N > 5.03" (OCR; e = 0 for a wall, 1 for a berm) | medium (OCR text) |
| barrier.N_lower (illuminated zone, wall) | -0.1916 | - | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, eq. 15) | "-0.1916 - 0.0635e < N < 0" (OCR) | medium (OCR text) |
| barrier.line_of_sight_just_broken | 5 | dBA | https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm | "Typically, a 5-dB(A) IL can be expected for receivers whose line-of-sight to the roadway is just blocked by the barrier." | high |
| barrier.per_metre_above_line_of_sight | 1.5 | dBA/m | https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm | "each additional 1 m of barrier height above line-of-sight blockage will provide about 1.5 dB(A) of additional attenuation" | high |
| barrier.kurze_anderson form | 5 + 20 log10(sqrt(2πN)/tanh(sqrt(2πN))) | dB | https://www.ingentaconnect.com/content/ince/ncej/1983/00000020/00000001/art00004 (Noise Control Eng. J. 20(1), 1983; abstract text seen in search, page itself returned 403) | "Anderson's formula ... takes the form A = 5 + 20 log[(2πN)^½ / tanh((2πN)^½)]" | medium |
| barrier.iso9613_C2 | 20 (40 if ground reflections modelled separately) | - | https://strutt.arup.com/help/Environmental_Noise/EnviroBarrierAtten.htm | "C_2 = 20 and includes the effect of ground reflections" | medium (secondary, quoting ISO 9613-2:1996) |
| barrier.iso9613_cap_single | 20 | dB per octave band | https://strutt.arup.com/help/Environmental_Noise/EnviroBarrierAtten.htm | "should not be taken to be greater than 20 dB" (single diffraction) | medium (secondary) |
| barrier.iso9613_cap_double | 25 | dB per octave band | https://strutt.arup.com/help/Environmental_Noise/EnviroBarrierAtten.htm | "25 dB in the case of double diffraction" | medium (secondary) |
| foliage.fhwa_first_30m | 5 | dBA | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, p. 33) | "5 dBA attenuation is allowed if the woods have a depth of 30 metres" | high |
| foliage.fhwa_second_30m | 5 | dBA | same, p. 33 | "An additional 5 dBA may be obtained if the depth of the woods extends for another 30 metres." | high |
| foliage.fhwa_cap | 10 | dBA | same, p. 33 | "10 dBA is the maximum attenuation dense woods can provide." | high |
| foliage.fhwa_density_condition | no line of sight; trees 5 m above line of sight | - | same, p. 33 | "there is no clear line of sight between the observer and the source, and if the height of the trees extends at least 5 metres above the line of sight" | high |
| foliage.fhwa_handbook | up to 5 dBA for 30 m (100 ft) wide, 5 m (15 ft) tall; max about 10 dBA | dBA | https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm | "This size of vegetation area may provide up to 5 dB(A) of noise reduction." / "The maximum reduction that can be achieved is approximately 10 dB(A)." | high |
| foliage.fhwa_public_page | 5 dB per 30 m dense vegetation | dB | https://www.fhwa.dot.gov/ENVIRONMENT/noise/noise_barriers/design_construction/keepdown.cfm | "30 meters of dense vegetation can reduce noise by five decibels." | high |
| foliage.fhwa_audible_landscape | 3 to 5 per 100 ft | dBA | https://www.fhwa.dot.gov/ENVIRonment/noise/noise_compatible_planning/federal_approach/audible_landscape/al04.cfm | "A reduction of 3-5 dBA per 100 feet can be expected" | high |
| foliage.hoover | 0.01 * f^(1/3) * r_f | dB (f in Hz, r_f in m) | https://strutt.arup.com/help/Environmental_Noise/EnviroFoliageAtten.htm | "A_f = 0.01 * r_f(m) * f_(1/3)" (attributed there to Bies and Hansen) | medium (secondary) |
| foliage.hoover at 500 Hz | 0.0794 | dB/m | derived from the Hoover row above | 0.01 * 500^(1/3) = 0.0794 | high (arithmetic) |
| foliage.iso9613 10 to 20 m, 500 Hz band | 1 | dB (total) | https://doku.datakustik.com/CadnaA/en/BebaungBewuchs.html | table row "10 ≤ df ≤ 20 m (dB)": 0 0 1 1 1 1 2 3 for 63 Hz to 8 kHz | medium (software manual reproducing ISO 9613-2 Table A.1) |
| foliage.iso9613 20 to 200 m, 500 Hz band | 0.05 | dB/m | https://doku.datakustik.com/CadnaA/en/BebaungBewuchs.html | table row "20 ≤ df ≤ 200 m (dB/m)": 0.02 0.03 0.04 0.05 0.06 0.08 0.09 0.12 | medium (same) |
| foliage.iso9613 max path | 200 (use 200 m value beyond) | m | ISO 9613-2:1996 Annex A, as shown in search excerpt of https://www.sis.se/api/document/preview/608579/ | "for path lengths greater than 200 m ... the attenuation for 200 m should be used" (search snippet, not opened) | medium |
| foliage.vdi2714 A-weighted | 0.05 | dB/m | https://doku.datakustik.com/CadnaA/en/BebaungBewuchs.html | "DD = 0.05 dB/m × sD" (VDI 2714, A-weighted levels) | medium (German guideline, cross-check only) |
| shielding.combined_cap woods + building rows | 10 | dBA | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, p. 34) | "the combined effects of dense woods and rows of buildings are only additive until a maximum of 10 dBA attenuation is achieved" | high |
| building_rows.first_row (40 to 65% blocked) | 3 | dBA | same, p. 34 | "3 dBA is provided by the first row when the buildings occupy 40 to 65 percent of the length of the row" | high |
| building_rows.first_row (65 to 90% blocked) | 5 | dBA | same, p. 34 | "5 dBA when the buildings occupy 65 to 90 percent of the length of the row" | high |
| building_rows.below_40pct | 0 | dBA | same, p. 34 | "No attenuation is allowed for rows of houses that occupy less than 40 percent of the length of the row." | high |
| building_rows.each_additional_row | 1.5 | dBA | same, p. 34; also design03.cfm | "1.5 dBA additional attenuation is provided by each successive row until a total attenuation of 10 dBA" | high |
| building_rows.iso9613_housing | 0.1 * B * d_b, max 10 | dB | https://doku.datakustik.com/CadnaA/en/BebaungBewuchs.html | "limited to 10 dB according to ISO 9613-2" | medium (secondary) |
| orientation.finite_roadway_adjustment (hard site) | 10 * log10(Δφ / 180) | dB, Δφ in degrees | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, p. 31 worksheet, Fig. 6) | "finite roadway adjustment, hard site" (equation itself garbled in OCR; CadnaA RVS 4.02 gives the same form "Dphi = 10 lg (phi/180°)" at https://doku.datakustik.com/CadnaA/en/Abbrev_Protocol-Road.html) | medium |
| orientation.side_wall | -3.0 | dB | derived from the row above with Δφ = 90° | 10*log10(90/180) = -3.01 | medium (derived; hard-site form) |
| orientation.back_wall (two-storey building, one study) | about -13 | dBA | https://www.fhwa.dot.gov/ENVIRonment/noise/noise_compatible_planning/federal_approach/audible_landscape/al04.cfm | "reduce noise levels on the side of the building away from the noise source by about 13dBA" | medium (single study, not a design value) |
| orientation.quiet_side_threshold | 10 | dBA front-back difference | https://pmc.ncbi.nlm.nih.gov/articles/PMC3546762/ | "38% of the respondents have a front-back level difference (absolute value) less than 10 dBA" | medium (Belgium, not US) |
| orientation.quiet_side_large_difference | ≥ 20 for 28% of dwellings | dBA | https://pmc.ncbi.nlm.nih.gov/articles/PMC3546762/ | "28% of the respondents have a level difference larger than or equal to 20 dBA" | medium (Belgium, urban) |
| orientation.back_louder_than_front | 12% of cases | - | https://pmc.ncbi.nlm.nih.gov/articles/PMC3546762/ | "In 12% of the cases, the back façade noise level exceeds the front façade level." | medium (Belgium) |
| orientation.rear_building_rows (simulation) | 7 to 12 | dB | https://pmc.ncbi.nlm.nih.gov/articles/PMC6679167/ | "noise differences between the front and rear buildings are about 7–12 dB" (from search summary, page not opened) | low |
| distance.hard_site | 3 | dBA per doubling of distance | https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (FHWA-RD-77-108, Fig. 8a) | "3dBA/DD" | high |
| distance.soft_site | 4.5 | dBA per doubling of distance | same, Fig. 8b | "4.5dBA/DD" | high |
| bts.shielding_included | no | - | https://rosap.ntl.bts.gov/view/dot/90910/dot_90910_DS1.pdf (BTS NTNM documentation, road section) | "Shielding due to terrain features and man-made structures is not included." | high |
| bts.ground_type | soft ground assumed | - | same | "Acoustically soft ground was assumed for the computation of ground effects." | high |
| bts.road_receptor_grid | 30 | m | same | "uniform grid with a resolution of 98.4 feet (30 m)" | high |
| bts.receptor_height | 1.5 | m | same | "height of 4.92 feet (1.5 m) above ground level" | high |
| bts.road_model | FHWA TNM 2.5 algorithms | - | same | "acoustical algorithms from the Federal Highway Administration's (FHWA) Traffic Noise Model (TNM) version 2.5" | high |
| osm.major_road_classes | motorway, trunk, primary, secondary | - | https://wiki.openstreetmap.org/wiki/Key:highway | motorway: "A restricted access major divided highway" | high |
| osm.overpass_around | `(around:radius,latitude,longitude)` | m | https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL | "(around:radius,latitude,longitude)" | high |
| tree_path.line_fraction = area fraction | L_L = A_A | - | https://en.wikipedia.org/wiki/Stereology | "determine volume fraction from length fraction on linear transects" (Rosiwal) | medium (textbook principle; the application to tree canopy is ours) |

## Equations

### E1. Barrier insertion loss (recommended: FHWA-RD-77-108 form of Kurze-Anderson)

```
delta = A + B - d                         path length difference, m
  A = distance source -> barrier top, m
  B = distance barrier top -> receiver, m
  d = direct distance source -> receiver, m
N     = 2 * delta / lambda                Fresnel number, dimensionless
lambda = c / f = 343 / 550 = 0.624 m      so N = 3.21 * delta   (delta in m)
Sign: N > 0 when the barrier blocks line of sight, N < 0 when it does not.

For a wall (e = 0):
  N <= -0.1916            IL = 0
  -0.1916 < N < 0         IL = 5 + 20*log10( sqrt(2*pi*|N|) / tan(sqrt(2*pi*|N|)) )
  N = 0                   IL = 5
  0 < N < 5.03            IL = 5 + 20*log10( sqrt(2*pi*N) / tanh(sqrt(2*pi*N)) )
  N >= 5.03               IL = 20   (cap; berm e = 1 gives 23)
IL in dB(A), single broadband value for traffic.
```

The branches join continuously: at N = 5.03 the tanh branch gives 20.0 dB, and at
N = -0.1916 the tan branch gives 0.0 dB (checked by hand). FHWA-RD-77-108 eq. 15 also
contains a finite-barrier-length integral over angles; for a long wall that integral
is not needed and the point-source form above applies (Not found: a sourced rule for
when a garden fence or wall is "long enough").

The plan's Maekawa form for comparison:
`IL = 10*log10(3 + 20*N)` for N > 0. This is the same as ISO 9613-2's
`Dz = 10*log10(3 + (C2/lambda)*C3*delta*Kmet)` with C2 = 40, C3 = 1, Kmet = 1. With the
ISO default C2 = 20 (ground reflections included), ISO gives about 2 to 3 dB less.

**Worked example (the plan's check case).** Source 0.5 m high, receiver 1.5 m high,
source 30 m from the receiver, a 3 m wall 10 m in front of the house. (The plan did not
state heights; 0.5 m and 1.5 m reproduce its 12.5 dB exactly.)

```
A = sqrt(20^2 + 2.5^2) = 20.156 m
B = sqrt(10^2 + 1.5^2) = 10.112 m
d = sqrt(30^2 + 1.0^2) = 30.017 m
delta = 0.2509 m

Recommended, 550 Hz:  N = 3.21 * 0.2509 = 0.805
  x = sqrt(2*pi*0.805) = 2.249,  tanh(x) = 0.978
  IL = 5 + 20*log10(2.249 / 0.978) = 12.2 dB

Plan, Maekawa at 500 Hz:  N = 2*0.2509/0.686 = 0.731
  IL = 10*log10(3 + 20*0.731) = 12.5 dB      (matches the plan)
Maekawa at 550 Hz:        12.8 dB
ISO 9613-2, C2 = 20, 500 Hz: 10*log10(3 + 20*0.2509/0.686) = 10.1 dB
```

So the plan's number is within 0.3 dB of the recommended method. The T1 unit test
should change to 12.2 dB within 0.2 if the FHWA form is adopted.

### E2. Foliage loss (recommended default: ISO 9613-2, 500 Hz band)

```
r_f = metres of tree path between the road and the facade (from E3)
  r_f < 10 m           foliage_loss = 0
  10 <= r_f < 20 m     foliage_loss = 1 dB
  20 <= r_f <= 200 m   foliage_loss = 0.05 * r_f dB
  r_f > 200 m          foliage_loss = 10 dB
Then: foliage_loss + building_row_loss <= 10 dB  (FHWA-RD-77-108 combined cap)
Aviation: foliage_loss = 0.
```

Upper bound for sensitivity runs (FHWA-RD-77-108 dense-woods rule, only valid when the
woods block line of sight and stand 5 m above it):
`foliage_loss = 5 dB per full 30 m of woods, 10 dB maximum` (a step rule in the
source; a linear version is 0.167 dB/m, which is our interpolation, not FHWA's).

Hoover (the plan): `foliage_loss = 0.01 * f^(1/3) * r_f` = 0.0794 dB/m at 500 Hz.

**Worked example.** r_f = 30 m of trees.

```
ISO 9613-2 (recommended): 0.05 * 30 = 1.5 dB
Hoover at 500 Hz (plan):  0.0794 * 30 = 2.4 dB
FHWA dense woods:         5 dB (one full 30 m block)
```

### E3. Vexcel tree cover within 5, 30, 100, 200 ft to metres of tree path

Assumption to confirm with R5: Vexcel gives the canopy cover fraction c_k of the disc of
radius R_k around the building, for R = 5, 30, 100, 200 ft. If instead it gives cover per
ring, skip step 1.

```
R_0 = 0, R_1..R_4 = 5, 30, 100, 200 ft;  c_k = cover fraction of disc k (0 to 1)
D   = distance from the facade to the dominant road, ft (from E5)

Step 1, ring cover (tree area in ring / ring area):
  a_k = (c_k * R_k^2 - c_(k-1) * R_(k-1)^2) / (R_k^2 - R_(k-1)^2)
Step 2, tree path along the ray to the road (line fraction = area fraction):
  r_f = 0.3048 * sum over k of  a_k * max(0, min(R_k, D) - R_(k-1))     metres
Step 3: if D > 200 ft, trees beyond 200 ft are unknown; take r_f from rings only
        (no extrapolation).
```

Why this works: for cover spread at random over a ring, a straight line through the ring
spends the same fraction of its length under canopy as the ring's area fraction
(Rosiwal / Delesse principle). Only rings between the house and the road count, which is
why the sum stops at D. This is a geometric step, not a sourced acoustic value.

Important limits: canopy cover is not "dense woods". FHWA requires no line of sight and
trees 5 m above it. That is the main reason to use the gentler ISO rate by default.

**Worked example.** Road 150 ft away; disc covers 5 ft 0.50, 30 ft 0.40, 100 ft 0.30,
200 ft 0.25.

```
ring 0-5 ft:     a = 0.500, length 5 ft   -> 2.5 ft
ring 5-30 ft:    a = 0.397, length 25 ft  -> 9.9 ft
ring 30-100 ft:  a = 0.290, length 70 ft  -> 20.3 ft
ring 100-200 ft: a = 0.233, length 50 ft  -> 11.7 ft   (stops at D = 150 ft)
r_f = 44.4 ft = 13.5 m
ISO 9613-2: 10 <= 13.5 < 20 -> 1 dB.   Hoover: 1.1 dB.   FHWA: 0 (less than 30 m).
```

### E4. Facade orientation loss (road and rail; not aviation)

For a long straight road, each road element contributes equally per degree of view on a
hard site, so the level at a facade point scales with the angle of road it can see:

```
alpha = angle between the wall's outward normal (azimuth_deg) and the bearing from the
        wall to the nearest point of the dominant road, degrees, 0 to 180
Visible road angle:  dphi = 180 - alpha     (front 180, side 90, back 0)
orientation_loss = min( -10*log10(dphi / 180),  back_loss )     dB
back_loss = 10 dB (calibrated default inside the sourced 7 to 13 dB range)
```

**Worked example.**

```
front wall, alpha = 0:     loss = 0 dB
alpha = 45:                loss = 1.2 dB
side wall, alpha = 90:     loss = 3.0 dB
alpha = 135:               loss = 6.0 dB
alpha >= 162:              loss = 10 dB (cap = back wall)
```

Row of buildings: front facades use the same formula; the rear facade of a row (no gaps)
uses back_loss; party walls are not exterior surfaces. Houses in the second and later
rows behind a first row get the FHWA building-row term (E6), not the orientation term.

### E5. Dominant road direction

```
1. Overpass query: way["highway"~"^(motorway|trunk|primary|secondary)$"]
   (around:300, lat, lon); out geom;        (300 m search radius is our choice)
2. For each way, find the nearest point P to the building and its distance d_P, m.
3. Sample the BTS road raster at P (or at the raster cell nearest P), L_P.
4. Estimate each road's level at the house with the soft-site rule used by BTS:
   L_est = L_P - 15*log10(d_P / d_ref), where d_ref = distance from the road
   centreline to the raster cell centre used in step 3 (at least 15 m).
5. Dominant road = the way with the largest L_est; bearing = bearing from the building
   centroid to P. Use it as the "road direction" for E4 and the ray for E3.
Cross-check: the BTS road raster gradient over the 3 x 3 cells (30 m) around the house
points uphill toward the source. If the gradient bearing and the OSM bearing differ by
more than 45 degrees, flag "multiple road sources" and fall back to no orientation loss
on side walls (conservative).
```

The 15*log10 rule is the FHWA soft-site 4.5 dBA per doubling (BTS assumes soft ground).

**Worked example.** House at the origin. A primary road with nearest point 60 m due
south (bearing 180), raster cell next to it reads 68 dB at d_ref = 15 m; a residential
street is ignored (not in the class list); a motorway nearest point 250 m east (bearing 90)
reads 75 dB at 15 m.

```
primary:  68 - 15*log10(60/15)  = 68 - 9.0  = 59.0 dB
motorway: 75 - 15*log10(250/15) = 75 - 18.3 = 56.7 dB
Dominant = primary road, bearing 180 (south).
```

### E6. Building rows between road and house (optional, from the same FHWA source)

```
first row, buildings 40 to 65% of row length:  3 dBA
first row, 65 to 90%:                          5 dBA
under 40%:                                     0
each further row:                              +1.5 dBA
trees + building rows together:                10 dBA maximum
```

Worked example: a house in the third row, first row 70% built up: 5 + 1.5 = 6.5 dBA;
with 1 dB of foliage the total is 7.5 dBA, under the 10 dBA cap.

## Conflicts

1. **Barrier formula.** Plan: Maekawa `10*log10(3 + 20N)` at 500 Hz, cap 20. FHWA-RD-77-108
   and the FHWA handbook: Kurze-Anderson form at 550 Hz, cap 20 dB wall / 23 dB berm.
   ISO 9613-2: same 3 + ... structure but C2 = 20, giving about 2 to 3 dB less, cap 20 dB
   per octave band. We take FHWA: it is the US road-traffic manual method, it was checked
   against octave-band calculation to 0.2 dBA, and the difference from the plan is small
   (12.2 vs 12.5 dB on the check case).
2. **Foliage rate.** Hoover 0.079 dB/m, ISO 9613-2 and VDI 2714 0.05 dB/m, FHWA 5 dB per
   30 m (0.167 dB/m if made linear), FHWA Audible Landscape 3 to 5 dBA per 100 ft. All
   sources agree on a 10 dB maximum (FHWA explicitly, ISO by 0.05 dB/m x 200 m). We take
   ISO 9613-2 at 500 Hz as default because tree canopy cover does not prove the woods are
   dense and tall enough for the FHWA rule, and FHWA's own public pages say planting
   enough trees for 5 dB is not feasible. FHWA is kept as the upper bound for the
   sensitivity sweep. Note also the FHWA statement that vegetation is not accepted as
   abatement under 23 CFR 772 (state DOT summary; see search result
   https://ctb.virginia.gov/media/ctb/agendas-and-meeting-minutes/2015/sept/pres/Noise_Manual_Update.pdf,
   not opened).
3. **Back facade.** FHWA Audible Landscape cites about 13 dBA for a two-storey building;
   European quiet-side work uses 10 dBA as the threshold and finds wide spread (under 10
   dB for 38% of dwellings, 20 dB or more for 28%, back louder than front in 12%);
   one simulation gives 7 to 12 dB for rear buildings. Houston houses are mostly one
   storey, which shields less than two storeys. We keep the plan's -10 dB, marked
   `calibrated`, and flag it for the sensitivity table.
4. **Side wall.** Plan -3 dB; derived value -3.0 dB from FHWA's hard-site finite-roadway
   adjustment. On a soft site FHWA uses a different weighting (Fig. 7 of FHWA-RD-77-108),
   which we could not read in the OCR text; -3 dB is kept.
5. **Hoover attribution.** The plan calls it "Hoover's rule"; the only online source found
   (Arup Strutt help) attributes the formula through Bies and Hansen's textbook. The
   original Hoover paper was not found.

## Not found

- **Kurze-Anderson 1971 original paper** (Applied Acoustics 4, 35-53): not reachable. The
  formula is confirmed through FHWA-RD-77-108 (which cites it as ref. 4) and a 1983
  Noise Control Engineering Journal abstract. Fallback: use the FHWA-RD-77-108 form as
  written in E1.
- **Maekawa 1968 original** (Applied Acoustics 1, 157-173): not reachable, and the
  `10*log10(3 + 20N)` fit was only found on calculator websites and in ISO's C2 = 40
  case. Fallback: not needed if E1 is adopted; keep Maekawa only as a comparison.
- **ISO 9613-2 text itself**: all free copies found are scanned images; values were taken
  from the CadnaA manual and the Arup Strutt help pages. The exact ISO definition of the
  foliage path length (ISO uses a curved ray) was not confirmed. Fallback: straight-line
  path from E3.
- **ISO 9613-2:2024 changes** to Dz and foliage (a forest-type table) were seen only in
  search summaries. Fallback: use the 1996 values above.
- **Measured side-wall and back-wall levels for US detached houses**: none found. Fallback:
  -3 dB side (derived), -10 dB back (calibrated, range 7 to 13 dB).
- **Vexcel tree cover field format** (disc vs ring, canopy height): depends on R5.
  Fallback: E3 as written; if canopy height is available, count only trees taller than
  5 m above the line of sight toward the full FHWA rate.
- **How a barrier and foliage combine**: FHWA-RD-77-108 caps woods plus building rows at
  10 dBA, but no rule was found for a wall plus trees. Fallback: add them, and cap the
  sum at the barrier cap (20 dB). This is `unsourced`.
- **When a fence or wall is long enough** to use the infinite-barrier formula: not found.
  Fallback: apply E1 only to walls recorded in input data; no barrier by default.
- **Search radius and class list for E5** (300 m; motorway to secondary): our choice,
  `unsourced`. HPMS road classes used by BTS were not mapped to OSM classes.
