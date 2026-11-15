# Sound model

The spec for the Hush noise model, written by the S1 synthesizer for issue #8 from
`docs/NOISE_MODEL_PLAN.md` (version 2) and `research/R1` to `R6`. It is a draft until
Alejandro approves it (Gate 1). Every number here is also in `assumptions.yaml`, which
gives each one a source and a status (`sourced`, `calibrated` or `placeholder`).

Sections: 1 assumptions, 2 pipeline, 3 equations, 4 default tables, 5 worked example,
6 where research disagreed with the plan, 7 known limits, 8 sources.

---

## 1. Assumptions

1. One broadband A-weighted number per room, per source, per time block. No spectra.
2. Windows and doors to the outside are closed unless the input says a window is open.
3. Outdoor levels are free-field levels at the facade with the house absent. That is what
   BTS publishes (R1, R3 E1).
4. BTS includes no shielding (no barriers, buildings, terrain or trees) and has no time of
   day. Our barrier, foliage and building-row terms are the only shielding, so nothing is
   counted twice (R1, R2). The day profile is ours (section 3.2).
5. Sound inside a room is diffuse, so one level describes the whole room. Below about
   250 Hz in small rooms this is only true on average across many similar rooms (R4 E6).
6. Lab ratings (OITC, STC, EWR) are used as broadband transmission loss. The gap between lab
   ratings and real houses is carried by one calibrated leak term per opening (R3 E3). No
   separate field derating is added on top, because the leak fraction was fitted with lab
   ratings against field data. Adding one would count the same loss twice.
7. The model is linear in sound energy. Each source is solved on its own and the results
   are energy-summed. That gives the per-source breakdown for free.
8. Inputs are `property.json` and `sources.json`; output is `levels.json` (plan section 1).
   Only the **simple outdoor form** (BTS 2020 layers) is specified here. The **detailed
   form** (road counts, flight tracks, `peak_dba`) is **pending** research issues R7, R8 and
   R9 and plugs in behind the same per-wall outdoor level.
9. Time blocks: `overnight` 00-06, `morning_rush` 06-10, `midday` 10-16,
   `evening_rush` 16-20, `evening` 20-24. DNL is derived from them (section 3.2).

## 2. Pipeline

```
BTS pixel per mode (L24)  ->  hourly profile  ->  block level, free field
  -> per exterior wall: minus orientation, barrier, foliage (road, rail, construction*)
  -> through each wall: composite R with leaks, + 3, per-room absorption
  -> all rooms solved together through partitions and doors
  -> per room: block levels, DNL, range, dominant path, best fix
```
`*` construction rules are partly placeholder, see 6.B2. Aircraft skip orientation, barrier
and foliage.

## 3. Equations

Notation: `L` levels in dBA, `E = 10^(L/10)` energy (dimensionless), `S` areas in m2,
`R` transmission loss in dB, `tau = 10^(-R/10)`.

### 3.1 Energy sum

`L_total = 10*log10( sum_i 10^(L_i/10) )`

### 3.2 Outdoor level in time (simple form)

Read `L24` (dBA, LAeq over 24 h) from the BTS 2020 layer for each mode at the facade point,
not the parcel centroid (R1 E1, conflict 8). A pixel of exactly 45.0 means "45 or less":
treat that mode as absent for this property (R1 E4).

Hourly level from the night share `f_n` (share of the day's energy between 22:00 and 07:00;
0.15 for road and rail from HUD, placeholder 0.15 for aviation) (R1 E2):

```
L_hour = L24 + 10*log10((1 - f_n) * 24 / 15)   for hours 07..21   (= L24 + 1.34)
L_hour = L24 + 10*log10(f_n * 24 / 9)          for hours 22..06   (= L24 - 3.98)
```

Block level = energy mean of its hours. With `f_n = 0.15` the linear factors are exactly
1.36 (day hour) and 0.40 (night hour), so:

| block | hours | night hours | offset from L24 |
|---|---|---|---|
| overnight | 00-06 | 6 | -3.98 |
| morning_rush | 06-10 | 1 (06-07) | +0.49 |
| midday | 10-16 | 0 | +1.34 |
| evening_rush | 16-20 | 0 | +1.34 |
| evening | 20-24 | 2 (22-24) | -0.56 |

The five blocks energy-average back to `L24` exactly. This differs from the plan's literal
rule; see 6.B1.

**DNL.** Compute from the 24 hourly values, not from the block averages:

`DNL = 10*log10( (1/24) * sum_h 10^((L_h + 10*n_h)/10) )`, `n_h = 1` for hours 22..06.

For any room, interior hourly levels are the outdoor hourly levels plus a constant per source
(the model is linear), so the room DNL follows directly. For road and rail outdoors,
`DNL = L24 + 10*log10(1 + 9*f_n) = L24 + 3.71`. (In the detailed form, where only block
levels exist, each hour takes its block's level.)

**Construction (FHWA RCNM)** (R1 E3). For each machine, with `Lmax50` the Actual level at
50 ft where it exists, else Spec (dBA), `D` distance in ft, `UF` usage fraction:

```
Lmax    = Lmax50 - 20*log10(D / 50)
Leq     = Lmax + 10*log10(UF)                        while working
L_block = Leq + 10*log10(h_work / h_block)           only blocks listed as active
```
`h_work` = hours of the block inside the allowed 07:00 to 20:00 window (placeholder, 1997
code text). Several machines are energy-summed.

### 3.3 Outdoor level at each exterior wall

For road, rail and construction:

`L_wall = L_block - D_orient - D_barrier - D_foliage - D_rows`

**Orientation** (R2 E4). `alpha` = angle (0 to 180 deg) between the wall's outward normal
(`azimuth_deg`) and the bearing to the nearest point of the dominant road.

`D_orient = min( 10*log10(180 / (180 - alpha)), 10 )`   dB

Front 0, alpha 45 gives 1.2, side (90) 3.0, alpha 135 gives 6.0, alpha 162 or more 10 (the
back-wall cap, `calibrated`, sourced range 7 to 13). The dominant road is the OSM motorway,
trunk, primary or secondary way within 300 m with the highest
`L_P - 15*log10(d_P / d_ref)`, where `L_P` is the BTS value next to the road at distance
`d_ref` (at least 15 m) and `d_P` the distance to the building (R2 E5; radius, classes and
15 m are placeholders). If the BTS raster gradient points more than 45 deg away from that
road, set `D_orient = 0` on side walls (placeholder).

**Barrier** (FHWA-RD-77-108, Kurze-Anderson form) (R2 E1). Only for walls or buildings
recorded in `sources.json.barriers`.

```
delta = A + B - d            path difference over the barrier top, m
N     = 3.21 * delta         Fresnel number at 550 Hz (lambda = 343/550 = 0.624 m); N < 0 if line of sight is clear
N <= -0.1916           D_barrier = 0
-0.1916 < N < 0        D_barrier = 5 + 20*log10( sqrt(2*pi*|N|) / tan(sqrt(2*pi*|N|)) )
N = 0                  D_barrier = 5
0 < N < 5.03           D_barrier = 5 + 20*log10( sqrt(2*pi*N) / tanh(sqrt(2*pi*N)) )
N >= 5.03              D_barrier = 20 (wall); 23 for a berm
```
Check case: `delta = 0.2509 m` gives `N = 0.805`, `D_barrier = 12.2 dB`.

**Foliage** (ISO 9613-2, 500 Hz) (R2 E2). `r_f` = metres of tree path between road and
wall. With only Vexcel `parcel-tree-cover` available (R5), `r_f = cover_fraction *
min(distance_to_road, 61 m)` (line fraction equals area fraction, R2 E3; 61 m = 200 ft,
beyond which cover is unknown). Placeholder until the Vexcel zone radii are known.

```
r_f < 10 m            D_foliage = 0
10 <= r_f < 20 m      D_foliage = 1
20 <= r_f <= 200 m    D_foliage = 0.05 * r_f
r_f > 200 m           D_foliage = 10
```

**Building rows** (optional, R2 E6): first row 3 dB (40 to 65% built up) or 5 dB (65 to
90%), 0 under 40%, plus 1.5 dB per further row. `D_foliage + D_rows <= 10 dB`.
`D_barrier + D_foliage <= 20 dB` (placeholder, no source).

**Aircraft:** `L_wall = L_block` on every wall, and the roof is an exterior surface for
top-floor rooms.

### 3.4 Through the facade into a room

For exterior wall `w` of room `i` (gross area `S_w`, opaque part `S_op = S_w - sum S_k`,
openings `k` = windows and doors with areas `S_k` and ratings `R_k`, leak fraction `f`):

```
T_w   = S_op*10^(-R_wall/10) + sum_k S_k*10^(-R_k/10) + f * sum_k S_k     transmission area, m2
R_w   = -10*log10(T_w / S_w)                                              composite R, dB
A_i   = 0.161 * V_i / T  +  (area of open doorways touching room i)      absorption, m2; T = 0.5 s
F_i,s = sum_w 10^((L_wall,s + 3)/10) * T_w,s / A_i                        energy into room i from source s
```

For a single wall this is the plan's `L_room = L_out + 3 - R + 10*log10(S/A)` (R3 E1, E2).
The `+3` is the random-incidence constant from ASTM E966 (R3 E1). For aircraft, OITC
ratings of wall, window and roof are reduced by 3 dB (R3); door EWR values and the leak term
are not (see 6.B6). Leak term: `f` comes from the era (section 4), applies to windows and
exterior doors, and has R = 0.

**Window open** (R3 E5): the room gets `F_i,s = 10^((L_wall,s - 12)/10)` from the wall holding
the open window (loudest such wall), instead of the closed-facade terms. Do not add `+3` or
the absorption term. Range 10 to 15 dB.

### 3.5 Room to room

Composite partition between rooms `i` and `j` (R4 E2, E4). Elements: wall net of door at
`STC - 8`, door leaf at `STC - 5` (placeholder), undercut gap `0.81 m x 0.0127 m` at R = 0,
an open door at R = 0 over its full area.

```
P_ij  = sum_e S_e * 10^(-R_e/10)                 transmission area of the shared surface, m2
c_ij  = P_ij / A_i                               coupling from room j into room i
E_i,s = F_i,s + sum_j c_ij * E_j,s               every room, every source
```

This is `L_recv = L_send - R_part + 10*log10(S_part / A_recv)` (ISO 12354-1) written for all
rooms at once, as the linear system `(I - C) E = F`. Solve it directly, or iterate updating
all rooms from the previous pass until no room changes by more than 0.01 dB (R4 E5). Open
doorway area is added to `A` on **both** sides. If `c_ij > 0.5` (placeholder), merge the two
rooms into one before solving (R4 E5 correction 2).

### 3.6 Reported values

- `blocks.<id>.dba` = `10*log10(sum_s E_i,s)`; `by_source` = each `E_i,s` in dB.
- `range_dba` = `dba +/- 5`; `+/- 3` only when window areas and types are measured (R6).
  The demo unit has no measured windows (R5), so it gets +/- 5.
- `dnl_dba` from the hourly series (3.2); `exceeds_hud_45` = DNL > 45 (24 CFR 51.101).
- `night_dba` = the `overnight` block; `exceeds_who_30_night` = night > 30 dBA (WHO). If
  `peak_dba` exists (detailed aircraft form, pending), also compare with WHO 45 LAmax.
- `dominant` = the largest single term in `E_i` (a wall's opaque, window, door or leak part,
  or a partition from a named room), with its share.
- `fix` = rerun with one change, report the largest drop: laminated window (OITC 35, f =
  0.001), storm window (27, f = 0.001), seal only (f = 0.001), door sweep (no undercut), close
  an interior door. Resetting `f` on a window change is a placeholder (R3 conflict 6).

## 4. Default tables

All by `year_built`; null means the 1980 to 1999 row (placeholder; year built is missing,
R5). The era-to-type mapping is unsourced (R3); each rating is sourced.

**Defaults by era** (results: 4 x 3.5 x 2.4 m bedroom, one 9.6 m2 wall, 15% window, 65 dBA
outside; recomputed by S1, they match R3 to 0.1 dB)

| Era | Wall (OITC) | Window (OITC) | Leak `f` | Indoor | NLR |
|---|---|---|---|---|---|
| before 1960 | vinyl/wood siding on 2x4 (24) | single pane (22) | 0.01 | 45.1 | 19.9 |
| 1960 to 1979 | brick veneer (40) | single pane (22) | 0.01 | 41.5 | 23.5 |
| 1980 to 1999 | brick veneer (40) | double pane (23) | 0.01 | 41.2 | 23.8 |
| 2000 onward | brick veneer (40); fiber cement upper floors (37) | double pane (22) | 0.001 (low confidence) | 38.2 | 26.8 |

**Exterior walls (OITC):** vinyl siding 2x4 24, 2x6 25; aluminum siding 25; EIFS stucco 27;
cement stucco 29; brick veneer 40; fiber cement upper floor 37 (model). Uninsulated: minus 2
(placeholder). Concrete block: 40 (placeholder). Roof: same as the era wall (placeholder).

**Windows (OITC):** single pane 22; double pane 23 (1980 to 1999) or 22 (2000 on); fixed
picture 25; with storm 27; laminated acoustic 35 (centre of glass only).

**Exterior doors (EWR, poor / good weatherstrip):** hollow core 18 / 19; solid core 20 / 21;
sliding glass 20 / 23; solid core with storm 24 / 25. Default is hollow core.

**Partitions (STC, then R used for traffic):**

| Element | STC | Derating | R used |
|---|---|---|---|
| 2x4 stud wall, gypsum both sides (default) | 33 | 8 | 25 |
| same, insulated | 36 | 8 | 28 |
| wood joist floor | 38 | 8 (placeholder) | 30 |
| same, insulated | 41 | 8 (placeholder) | 33 |
| concrete slab 4 in / 6 in | 49 / 53 | 8 (placeholder) | 41 / 45 |
| hollow-core door leaf (default) | 21 | 5 (placeholder) | 16 |
| solid-core door leaf | 30 | 5 (placeholder) | 25 |
| 1.6 m2 hollow door + 1/2 in undercut (composite) | | | 15.0 |
| 1.6 m2 solid door + 1/2 in undercut (composite) | | | 20.2 |
| undercut gap, open door | | 0 | 0 |

## 5. Worked example

The demo unit (2125 Yale St, Matterport `D9CVkjeMoQx`), bedroom 1 and the corridor, road
noise only, `midday` block, bedroom door open. Geometry is from the Matterport sample; the
wall facing, door and partition size are the plan's sample values (section 1.1) because
Matterport gives no walls (R5). **The raster value is the BTS 2020 road pixel R1 decoded at
Houston City Hall (54.8 dBA)**, standing in until the Yale St pixel is decoded. Road 40 m
away is assumed. All values rounded only for display; arithmetic carried at full precision.

**Inputs.** `L24 = 54.8`. Bedroom: 3.703 m wide, height 2.865 m, V = 56.68 m3, one exterior
wall on the side of the house relative to the road (alpha = 90 deg). `year_built` null, so
1980 to 1999: brick 40, double pane 23, f = 0.01. Corridor: V = 23.24 m3, no exterior wall.
Partition 8.0 m2 with a 1.6 m2 hollow-core door, open. Vexcel parcel tree cover 4%.

| # | Step | Working | Result |
|---|---|---|---|
| 1 | Midday, free field | 54.8 + 10*log10(0.85*24/15) = 54.8 + 1.34 | 56.14 dBA |
| 2 | Orientation, side wall | 10*log10(180/90) | -3.01 dB |
| 3 | Barrier | none recorded | 0 |
| 4 | Foliage | r_f = 0.04 * 40 = 1.6 m < 10 m | 0 |
| 5 | Level at the wall | 56.14 - 3.01 | **53.13 dBA** |
| 6 | Wall area | 3.703 * 2.865 | S = 10.61 m2 |
| 7 | Window (15%), opaque | 0.15 * 10.61; 10.61 - 1.59 | 1.59; 9.02 m2 |
| 8 | Opaque term | 9.018 * 10^-4.0 | 0.000902 m2 |
| 9 | Window term | 1.591 * 10^-2.3 | 0.007976 m2 |
| 10 | Leak term | 0.01 * 1.591 | 0.015915 m2 |
| 11 | Transmission area | sum of 8 to 10 | T = 0.024793 m2 |
| 12 | Composite R | -10*log10(0.024793 / 10.61) | 26.31 dB |
| 13 | Bedroom absorption | 0.161 * 56.68 / 0.5 + 1.6 (open door) | 18.25 + 1.6 = 19.85 m2 |
| 14 | Absorption term | 10*log10(10.61 / 19.85) | -2.72 dB |
| 15 | Bedroom from facade | 53.13 + 3 - 26.31 - 2.72 | 27.09 dBA |
| 16 | Partition | 6.4 * 10^-2.5 + 1.6 * 1 (open door) | P = 1.6202 m2 (R = 6.94 dB) |
| 17 | Corridor absorption | 0.161 * 23.24 / 0.5 + 1.6 | 7.48 + 1.6 = 9.08 m2 |
| 18 | Couplings | c_corr,bed = 1.6202 / 9.08; c_bed,corr = 1.6202 / 19.85 | 0.1784; 0.0816 |
| 19 | Solve 2 x 2 | E_bed = F_bed / (1 - 0.0816 * 0.1784) = F_bed / 0.98544 | +0.06 dB |
| 20 | **Bedroom, midday** | 27.09 + 0.06 | **27.2 dBA** (range 22.2 to 32.2) |
| 21 | **Corridor, midday** | 27.15 + 10*log10(0.1784) | **19.7 dBA** |

Leak 64%, window 32%, wall 4% of the facade energy, so the dominant path is "window and
frame leakage". Bedroom NLR from the free-field block level: 56.14 - 27.15 = 29.0 dB (26.0
from the facade, 3.0 from orientation).

**All blocks and DNL, bedroom.** The model is linear, so the bedroom sits a constant
56.14 - 27.15 = 28.98 dB below the free-field outdoor level in every block:

| block | outdoor free field | bedroom |
|---|---|---|
| overnight | 50.82 | 21.8 |
| morning_rush | 55.29 | 26.3 |
| midday, evening_rush | 56.14 | 27.2 |
| evening | 54.24 | 25.3 |

Bedroom L24 = 54.80 - 28.98 = **25.82 dBA**. Bedroom DNL = 25.82 + 3.71 = **29.5 dB**
(the same 24 hourly values with the 10 dB night penalty). Below HUD 45. Night 21.8, below
WHO 30.

**Door closed instead** (hollow core, undercut): partition R = 20.55 dB, A has no doorway
term, bedroom 27.46 dBA, corridor 7.2 dBA. The corridor value is real physics for a
two-room toy case, but falls under the plan's 15 dBA output check (see 6.C2).

**Check of step 15 by a second route.** NLR form (R6 E2): NLR = R - 3 - 10*log10(S/A) =
26.31 - 3 + 2.72 = 26.03, and 53.13 - 26.03 = 27.10. Agrees within rounding.

## 6. Where research disagreed with the plan

### A. Research changed the original section 2; plan version 2 already adopted these

| # | Item | Old value | New value | Says so |
|---|---|---|---|---|
| A1 | Day/night split of L24 | day +1.5, night -5 (11.8% night), DNL L24 + 3.2 | +1.3 / -4.0 (15% night, HUD), DNL L24 + 3.7 | R1 |
| A2 | Barrier formula | Maekawa `10*log10(3 + 20N)`, 500 Hz; check 12.5 dB | FHWA Kurze-Anderson, 550 Hz, cap 20 wall / 23 berm; check 12.2 dB | R2 |
| A3 | Foliage | Hoover 0.079 dB/m; 30 m gives 2.4 dB | ISO 9613-2 0.05 dB/m; 30 m gives 1.5 dB; cap 10 | R2 |
| A4 | Back wall | -10 dB starting value | -10 dB kept, status calibrated, range 7 to 13 | R2 |
| A5 | Brick veneer wall | OITC 42 | OITC 40 (NRC test) | R3 |
| A6 | Double-pane window | OITC 26 | OITC 22 to 23 | R3 |
| A7 | Leak fractions by era | 4%, 3%, 2%, 1% (placeholders) | 1%, 1%, 1%, 0.1% (calibrated) | R3 |
| A8 | 1990s bedroom, 65 dBA out | target about 45 dBA (HUD 20 dB); 2% leak gave 42.8 | 41.2 dBA; band 39 to 43 | R3, R6 |
| A9 | Window upgrade fix | OITC 32 with seals: 37.0 dBA, -5.8 dB | laminated OITC 35, f 0.001: 32.0 dBA, -9.2 dB; storm 27 | R3 |
| A10 | Windows open | not specified | 12 dB flat (10 to 15) | R3 |
| A11 | Interior derating | STC - 5 | STC - 8 (walls) | R4 |
| A12 | Iteration | 10 passes max, "two passes documented minimum" | solve directly or iterate to 0.01 dB; no source for two passes | R4 |
| A13 | Open doorway | R = 0 only | R = 0 and its area added to absorption; merge open-plan rooms | R4 |
| A14 | Range | +/- 3 dB with Matterport geometry | +/- 3 only with measured windows; Matterport has no openings, so demo is +/- 5 | R5, R6 |

### B. Plan version 2 still differs from the research (decision needed at Gate 1)

| # | Item | Plan v2 | Research / S1 spec | Says so |
|---|---|---|---|---|
| B1 | Block split | every day block L24 + 1.3, overnight L24 - 4.0 | hour-weighted: morning_rush +0.49, evening -0.56 (night hours 22-07 at -3.98). The plan rule raises L24 by 0.46 dB and, with DNL taken from block averages, DNL by 1.76 dB (5.47 vs 3.71) | R1 E2 (S1 arithmetic) |
| B2 | Which sources get orientation, barrier, trees | road and construction | R2 derives them for road and rail (a long line source). Rail added. For construction (a point source) there is no research: the plan rule is kept as placeholder; the 550 Hz barrier frequency is for traffic | R2 E1, E4 |
| B3 | Foliage under 20 m | 0.05 dB per metre throughout | 0 below 10 m, 1 dB from 10 to 20 m, then 0.05 dB/m | R2 E2 |
| B4 | Open doorway absorption | only in the room the sound leaves | both rooms | R4 E5 |
| B5 | Interior doors | "STC - 8"; any door with a normal gap about 21 | leaf STC - 5 (placeholder), gap R = 0. Hollow core with undercut 18.5 before derating, 15.0 after; solid core 21.4 / 20.2 | R4 E2, E4 |
| B6 | Aircraft rating offset | subtract 3 from the ratings | subtract 3 from OITC only. Door values are FAA EWR, already on an aircraft spectrum; subtracting again would count it twice | R3 (S1 reading) |
| B7 | Laminated window 35 | listed as a window rating | it is a centre-of-glass value; whole units on site can be up to 6 dB worse | R3 |
| B8 | 2000-onward upper floors | brick 40 | fiber cement 37 on upper floors | R3 E3 |
| B9 | Test: "closed pre-2000 house 18 to 27 dB" | 18 to 27 | the R3 defaults give 27.9 (1960 to 1979) and 28.2 (1980 to 1999) at 5% window. Widen to 18 to 29, or test at 15% window only | R3 (S1 arithmetic) |
| B10 | Test: "nine measured rooms" | nine rooms | 18 rooms in 8 buildings (nine cases C1 to C9, C6 left out); range 21.5 to 31.7 and median 24.9 are right | R6 |
| B11 | WHO night line | overnight block (00-06, 6 h) | WHO 30 is an 8 h bedroom night LAeq. Same number in the simple form; differs in the detailed form | R6 conflict 3 |
| B12 | BTS 45 dB floor | not mentioned | a pixel of 45.0 means "45 or less": drop that mode, do not add 45 | R1 E4 |

### C. S1 findings that are not in any research file

- **C1. Roof rating.** The plan counts the roof for aircraft on top floors, but no research
  gives a roof rating. Placeholder: the era wall rating.
- **C2. 15 dBA output floor.** Rooms with no exterior wall and closed doors can be under
  15 dBA (7.2 in section 5). Treat the 15 to 100 bound as a warning, or the T1 test will fail
  on correct physics.
- **C3. Window-open rule for several walls.** R3 gives one whole-room number; S1 applies it to
  the loudest wall with an open window and ignores the closed walls of that room.

## 7. Known limits

- **No CoStar data (R5).** `year_built` and `construction` are missing for every property, so
  the 1980 to 1999 defaults apply. Editable in the UI.
- **No Matterport room outlines (R5).** Matterport gives room type, floor area, total wall
  area, height, width, depth and volume, but no polygons, walls or openings. Exterior walls,
  their facings, room adjacency and window areas must come from the pipeline (by hand for the
  demo) or the footprint grid with the 15% window rule (placeholder). Hence +/- 5 dB.
- **Vexcel roof height disagrees (R5):** 16.02 m from `/property/extract`, 14.54 m from
  `/structure/extract` for the same block. Use the structure value, carry 1.5 m of uncertainty.
  Storeys = round(14.54 / 3.0) = 5 (storey height placeholder); 16.02 m also gives 5.
- **Vexcel tree data (R5):** defensible-space zone radii are undocumented and the
  `parcel-tree-cover` denominator is ambiguous. Foliage uses the parcel percentage as a coarse
  fraction (placeholder).
- **The demo unit is an apartment** in a 6,849 m2 mid-rise block. Nothing says which floor or
  facade it is on. Neighbour noise through party walls is not modeled.
- **BTS data (R1):** 2020 data via an Esri copy (official service fails); 30 m grid with
  steep gradients near roads; values under 45 dBA unknown; tiles need a LERC decoder that
  `numpy` and `pyyaml` lack (cache decoded values instead); BTS says not to use it for single
  sites. No sourced night share for aviation.
- **Detailed outdoor form pending (R7, R8, R9):** no road emission, no flight-track model, no
  `peak_dba`, no traffic by block yet.
- **Construction:** hours from a 1997 copy of the city code; hours worked unsourced; permits
  have addresses, not coordinates.
- **Facade:** leak fraction for 2000-onward houses is low confidence (no US field data); the
  era-to-type mapping is unsourced; HUD bands are measured 2 m from the building while BTS is
  free field, so HUD comparisons may read 0 to 3 dB low (unsourced). A long-road incidence
  constant of +4.0 instead of +3 is possible (R3 E1).
- **Aircraft:** real flyovers measure 2 to 5 dB more reduction than loudspeaker tests, and the
  model's -3 rating offset goes the other way. Expect aircraft indoor levels to read high.
- **Rooms:** T = 0.5 s everywhere costs up to about 1.3 dB per room; low-frequency modal
  scatter in small rooms is not quantified; real door gaps leak more than the R = 0 area rule,
  so closed-door results are optimistic; door-leaf and floor deratings are placeholders.
- **Validation:** all 18 measured rooms are FAA airport-program loudspeaker tests near SDF and
  BWI. None is in Houston and none is under road traffic. The FAA says models are not accurate
  enough to decide insulation eligibility. The model ranks rooms and flags problems; it does
  not replace a measurement.

## 8. Sources

Outdoor levels (R1): BTS NTNM v3 https://rosap.ntl.bts.gov/view/dot/90910/dot_90910_DS1.pdf ;
v2 https://rosap.ntl.bts.gov/view/dot/53773/dot_53773_DS1.pdf ; NTAD 2020 note
https://maps.dot.gov/NTAD_Data/2020_Noise_Data.txt ; Esri 2020 service
https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer?f=json ;
Esri item https://www.arcgis.com/home/item.html?id=439250230a414e46aa2846c7e2ae2048 ;
24 CFR 51.103 https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.103 ;
24 CFR 51.106 https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.106 ;
HUD night share (Indiana) https://www.in.gov/ihcda/files/Appendix-11.-Noise-Abatement-and-Control-2025.pdf ;
FHWA RCNM https://www.fhwa.dot.gov/environment/noise/construction_noise/rcnm/rcnm.pdf ;
Houston code copy https://nonoise.org/lawlib/cities/houston.htm .

Propagation (R2): FHWA-RD-77-108 https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf ;
FHWA barrier design https://www.fhwa.dot.gov/Environment/noise/noise_barriers/design_construction/design/design03.cfm ;
FHWA Audible Landscape https://www.fhwa.dot.gov/ENVIRonment/noise/noise_compatible_planning/federal_approach/audible_landscape/al04.cfm ;
ISO 9613-2 via CadnaA https://doku.datakustik.com/CadnaA/en/BebaungBewuchs.html and
https://doku.datakustik.com/CadnaA/en/Abbrev_Protocol-Road.html ; quiet side
https://pmc.ncbi.nlm.nih.gov/articles/PMC3546762/ and https://pmc.ncbi.nlm.nih.gov/articles/PMC6679167/ ;
OSM https://wiki.openstreetmap.org/wiki/Key:highway .

Facade (R3): NRC wall tests https://nrc-publications.canada.ca/eng/view/accepted/?id=361fd5c8-82ff-4c50-ba7b-d9f6739fef25 ;
Georgia Tech/FAA thesis https://repository.gatech.edu/server/api/core/bitstreams/124b4a58-8706-4fc8-9139-9b18ed96233e/content ;
Viwinco https://www.viwinco.com/cambridge-performance-data/ ; Guardian
https://guardianglass.com/content/dam/guardianindustriesholdings/collateral/usca/brochure_expert_series_EN_doc1_acoustics_2020.pdf ;
NRC CBD 240 https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd240_e.html ;
FAA/Wyle AC 150/5000-9A https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5000_9a_withReport.pdf ;
FHWA NLR table https://www.fhwa.dot.gov/Environment/noise/regulations_and_guidance/analysis_and_abatement_guidance/polguide02.cfm ;
EPA Levels Document https://nonoise.org/library/levels/levels.htm ; ASTM E966
https://store.astm.org/e0966-18a.html ; Texas energy code
https://tcss.legis.texas.gov/resources/HS/htm/HS.388.htm .

Rooms (R4): ISO 12354-1 sample https://cdn.standards.iteh.ai/samples/70242/d3ac59602f454a409b4265d6eee67477/ISO-12354-1-2017.pdf ;
Bradley https://jcaa.caa-aca.ca/index.php/jcaa/article/download/568/253/643 ; NRC CBD 239
https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd239_e.html ; USG SA924
https://www.usg.com/content/dam/USG_Marketing_Communications/united_states/product_promotional_materials/finished_assets/drywall-wood-framed-systems-SA924.pdf ;
AS-TL1766 https://www.acousticalsurfaces.com/wp-content/uploads/AS_TL1766-1.pdf ; NAIMA
https://insulationinstitute.org/wp-content/uploads/2021/08/NAIMA-AcousticsBrochure8_20212.pdf ;
NBS BSS 77 https://nvlpubs.nist.gov/nistpubs/Legacy/BSS/nbsbuildingscience77.pdf ; undercut
https://www.greenbuildingadvisor.com/article/when-are-door-undercuts-sufficient-for-return-air ;
California STC catalog https://nonoise.org/epa%20index/roll21/roll21doc10.pdf ; Hopkins
https://www.euronoise2018.eu/docs/papers/Plenary_Hopkins.pdf .

Data layers (R5): Vexcel OpenAPI https://api.vexcelgroup.com/v2/api-docs ; Vexcel MCP
https://vexceldata.com/platform/vexcel-mcp/mcp-get-started/ ; raw responses in `samples/`.

Criteria and validation (R6): 24 CFR 51.101 https://www.law.cornell.edu/cfr/text/24/51.101 ;
51.103 https://www.law.cornell.edu/cfr/text/24/51.103 ; 51.104
https://www.law.cornell.edu/cfr/text/24/51.104 ; HUD Guidebook ch. 4
https://housingnm.org/uploads/documents/Noise-Guidebook-Chapter-4.pdf ; FAA AC 150/5000-9B
https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5000-9B-Sound-Insulation-2022.pdf ;
WHO 2018 https://iris.who.int/server/api/core/bitstreams/f53c45ba-11d3-4502-a424-c1cf49f5a053/content ;
WHO community noise https://nonoise.org/library/whonoise/whonoise.htm ; FAA test reports
https://rosap.ntl.bts.gov/view/dot/68585/dot_68585_DS1.pdf ,
https://rosap.ntl.bts.gov/view/dot/57751/dot_57751_DS1.pdf ,
https://rosap.ntl.bts.gov/view/dot/57801/dot_57801_DS1.pdf ; Swiss study
https://pmc.ncbi.nlm.nih.gov/articles/PMC5800248/ .
