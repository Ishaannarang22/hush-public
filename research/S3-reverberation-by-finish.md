# S3. Reverberation time by floor covering and furnishing

Research for issue #37, task S3. Feeds the "room finish" field in section 3 of
`docs/UNIT_PROFILE_PLAN.md` (branch `codex/unit-profile-plan`). No model code. Every value has
a URL and an exact quote, or is marked `unsourced`. Values computed here are marked
`derived`. R4 already covers the 0.5 s reference (ISO 12354-1), the Canadian 0.4 s living
rooms, and the Korean furnished (0.44 to 0.48 s) and unfurnished (1.11 s) values; they are
not repeated.

## Answer

**Furnishing matters far more than the floor.** A field database of 242 rooms (EU COST
TU0901) gives a mid-frequency reverberation time of **0.5 s in furnished rooms of 25 to
50 m3** (absorption 10.7 m2) and **2.3 s in unfurnished rooms** of the same size (2.8 m2).
That is a factor of about 4 in absorption, or about 6 dB in the room term
`10*log10(S/A)`. The authors state the 7 dB figure themselves for standardized levels.

**The floor covering matters a lot in an empty room and little in a furnished one.** Using
standard octave-band absorption coefficients and Sabine on the plan's 33.6 m3 bedroom:

| floor | empty room T at 500 Hz | furnished T at 500 Hz | room term vs 0.5 s default, furnished |
|---|---|---|---|
| carpet on foam pad | 0.52 s | 0.29 s | -2.3 dB |
| carpet glued to concrete | 1.21 s | 0.44 s | -0.6 dB |
| wood on joists | 1.39 s | 0.46 s | -0.4 dB |
| parquet / laminate on concrete | 1.55 s | 0.48 s | -0.2 dB |
| vinyl / linoleum on concrete | 1.85 s | 0.50 s | 0.0 dB |
| ceramic tile | 2.00 s | 0.51 s | +0.1 dB |

(derived, see E1; "furnished" adds the 7.9 m2 that the field data show furniture adds.)

So for the profile: keep **0.5 s for a furnished room with a hard floor** (tile, vinyl,
laminate, wood), use **about 0.3 s, or -2 dB, for wall-to-wall carpet on a pad**, and
**about 2 s, or +6 dB, for an empty room**. Heavy curtains are worth about -0.5 dB per
3 m2 of drape at 500 Hz. These match the plan's "about 1 dB" estimate for finish in a
furnished room, but an empty or newly let unit is a much bigger effect (about 6 dB).

## Values

Confidence: high = measured field data or primary paper read in full; medium = compiled
coefficient table without a stated original source; low = single informal measurement.

### Measured rooms

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| rt.furnished.25_50m3 | 0.5 (sd 0.17) | s (400 to 1250 Hz mean) | https://journal.telfor.rs/Published/Vol5No2/Vol5No2_A12.pdf (Mašović and Öğüç, "Analysis of Reverberation Time Field Measurement Results in Building Acoustics", Telfor Journal 5(2), 2013, Table 2) | Table 2, furnished "25<V<=50": "V [m3] ... 31.2", "T [s] ... 0.5", "σ(T) ... 0.17", "A [m2] ... 10.7" | high (European rooms; 91 furnished, 151 unfurnished) |
| rt.unfurnished.25_50m3 | 2.3 (sd 0.55) | s | same as above | Table 2, unfurnished "25<V<=50": "V ... 38.7", "T ... 2.3", "σ(T) ... 0.55", "A ... 2.8" | high |
| rt.furnished.small_rooms | 0.5 below 50 m3, 0.7 above | s | same as above | "Average reverberation time of furnished rooms at middle frequencies is around 0.5 s for volumes below 50 m3, complying well with the reference value T0 from equation (1), but around 0.7 s in larger rooms, above 50 m3." | high |
| rt.unfurnished.spectrum | 2.5 below 500 Hz, 1.3 at 5000 Hz | s | same as above | "Average reverberation time seems to be less volume dependent in unfurnished rooms and is around 2.5 s below 500 Hz, and drops to 1.3 s at 5000 Hz" | high |
| rt.furnished.low_freq | rises to about 1 s below 100 Hz | s | same as above | "In both cases its value increases below 100 Hz to about 1 s in the lowest third-octave bands" | high |
| rt.furnished.spread | sd about 0.25 s | s | same as above | "around 0.25 s for volumes less than 50 m3" | high |
| level.unfurnished_vs_furnished | about +7 | dB (standardized level) | same as above | "a standardized sound pressure level should be expected to be about 7 dB higher than in furnished rooms" | high |
| level.furnished_spread | -1 to +2.5 | dB | same as above | "dispersion of sound pressure level can be -1 to +2.5 dB in regular furnished rooms of various sizes" | high |
| absorption.furniture_added | 7.9 | m2 (mid-frequency) | derived here: 10.7 - 2.8 from Table 2 rows above | - | derived (difference of means of different room sets) |
| rt.carpet_effect.single_room | 3.3 empty, 1.6 with carpet | s (1 kHz) | https://www.acs.psu.edu/drussell/demos/rt60/rt60.html (D. A. Russell, Penn State) | "I get a measured reverberation time of 3.3 seconds for the empty room and 1.6 seconds for the room with carpet." | low (one 223 m3 room, hand clap; not a dwelling) |

### Absorption coefficients by octave band (125, 250, 500, 1000, 2000, 4000 Hz)

| name | values | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| alpha.carpet_on_foam | 0.08, 0.24, 0.57, 0.69, 0.71, 0.73 | - | https://sengpielaudio.com/calculator-RT60Coeff.htm | "carpet on foam" row: "0.08 0.24 0.57 0.69 0.71 0.73" | medium (table states no original source) |
| alpha.carpet_1.35kg_on_felt_or_foam | 0.08, 0.24, 0.57, 0.69, 0.71, 0.73 | - | https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.materials.database.html | "Carpet 1.35 kg/m2, on hair felt or foam rubber" "0.08 0.24 0.57 0.69 0.71 0.73" | medium (same values, second compilation) |
| alpha.carpet_on_concrete | 0.02, 0.06, 0.14, 0.37, 0.60, 0.65 | - | https://sengpielaudio.com/calculator-RT60Coeff.htm | "carpet on concrete" row: "0.02 0.06 0.14 0.37 0.60 0.65" | medium |
| alpha.carpet_6mm_open_cell_foam | 0.03, 0.09, 0.20, 0.54, 0.70, 0.72 | - | https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.materials.database.html | "6 mm pile carpet bonded to open-cell foam underlay" "0.03 0.09 0.2 0.54 0.7 0.72" | medium |
| alpha.carpet_thin_glued | 0.02, 0.04, 0.08, 0.20, 0.35, 0.40 | - | same as above | "Thin carpet, cemented to concrete" "0.02 0.04 0.08 0.2 0.35 0.4" | medium |
| alpha.wood_on_joists | 0.15, 0.11, 0.10, 0.07, 0.06, 0.07 | - | https://sengpielaudio.com/calculator-RT60Coeff.htm | "wood on joists" row: "0.15 0.11 0.10 0.07 0.06 0.07" | medium |
| alpha.parquet_on_concrete | 0.04, 0.04, 0.07, 0.06, 0.06, 0.07 | - | same as above | "parquet on concrete" row: "0.04 0.04 0.07 0.06 0.06 0.07" | medium (used here for laminate too: `unsourced` equivalence) |
| alpha.vinyl_linoleum_on_concrete | 0.02, 0.03, 0.03, 0.03, 0.03, 0.02 | - | same as above; also pyroomacoustics "Linoleum, asphalt, rubber, or cork tile on concrete" | "linoleum/vinyl tile on concrete" row: "0.02 0.03 0.03 0.03 0.03 0.02" | medium |
| alpha.concrete_or_tile | 0.01, 0.01, 0.015, 0.02, 0.02, 0.02 | - | https://sengpielaudio.com/calculator-RT60Coeff.htm | "concrete or tile" row: "0.01 0.01 0.015 0.02 0.02 0.02" | medium |
| alpha.ceramic_tiles | 0.01, 0.01, 0.01, 0.02, 0.02, 0.02 | - | https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.materials.database.html | "Ceramic tiles with a smooth surface" "0.01 0.01 0.01 0.02 0.02 0.02" | medium |
| alpha.gypsum_board_wall | 0.29, 0.10, 0.05, 0.04, 0.07, 0.09 | - | https://sengpielaudio.com/calculator-RT60Coeff.htm | "Sheetrock 1/2" 16" on center" "0.29 0.10 0.05 0.04 0.07 0.09" | medium |
| alpha.window_glass | 0.35, 0.25, 0.18, 0.12, 0.07, 0.04 | - | same as above | "Glass: window" "0.35 0.25 0.18 0.12 0.07 0.04" | medium |
| alpha.curtain_14oz | 0.07, 0.31, 0.49, 0.75, 0.70, 0.60 | - | same as above | "Curtain: 14 oz/sq yd" "0.07 0.31 0.49 0.75 0.70 0.60" | medium |
| alpha.curtain_10oz | 0.03, 0.04, 0.11, 0.17, 0.24, 0.35 | - | same as above | "Curtain: 10 oz/sq yd" "0.03 0.04 0.11 0.17 0.24 0.35" | medium |
| alpha.curtains_densely_woven_90mm | 0.06, 0.10, 0.38, 0.63, 0.70, 0.73 | - | https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.materials.database.html | "Densely woven window curtains 90 mm from wall" "0.06 0.1 0.38 0.63 0.7 0.73" | medium |
| alpha.upholstered_seat_empty | 0.49, 0.66, 0.80, 0.88, 0.82, 0.70 | per m2 of seating area | https://sengpielaudio.com/calculator-RT60Coeff.htm | "empty - fabric upholstered" "0.49 0.66 0.80 0.88 0.82 0.70" | medium (concert seating, not a sofa) |
| alpha.bed_or_sofa | not found | - | - | - | unsourced |

## Equations

### E1. Sabine with a floor term and a furnishing term

```
A = S_floor*alpha_floor + S_walls_ceiling*alpha_gyp + A_furn
T = 0.161 * V / A                      # R4 E1
delta_L_room = 10*log10(A_ref / A)     # change in the room term vs the 0.5 s default
A_ref = 0.161 * V / 0.5
```

- `A_furn`: absorption added by furniture, 7.9 m2 at mid frequencies (derived from the
  field data above); 0 for an empty room.
- `alpha_gyp`: gypsum board, 0.05 at 500 Hz and 0.04 at 1 kHz. Windows and doors are
  counted as gypsum for simplicity.

Worked example, plan bedroom 4 x 3.5 x 2.4 m: V = 33.6 m3, floor 14 m2, walls plus ceiling
36 + 14 = 50 m2, A_ref = 10.82 m2. At 500 Hz, walls and ceiling give 50 x 0.05 = 2.50 m2.

| floor (alpha 500 Hz) | floor A | A empty | T empty | A furnished | T furnished | delta_L furnished |
|---|---|---|---|---|---|---|
| carpet on foam (0.57) | 7.98 | 10.48 | 0.52 s | 18.38 | 0.29 s | -2.3 dB |
| carpet on concrete (0.14) | 1.96 | 4.46 | 1.21 s | 12.36 | 0.44 s | -0.6 dB |
| wood on joists (0.10) | 1.40 | 3.90 | 1.39 s | 11.80 | 0.46 s | -0.4 dB |
| parquet on concrete (0.07) | 0.98 | 3.48 | 1.55 s | 11.38 | 0.48 s | -0.2 dB |
| vinyl on concrete (0.03) | 0.42 | 2.92 | 1.85 s | 10.82 | 0.50 s | 0.0 dB |
| tile (0.015) | 0.21 | 2.71 | 2.00 s | 10.61 | 0.51 s | +0.1 dB |

At 1 kHz the carpet-on-foam furnished room gives T = 0.28 s and -2.6 dB, and the tile room
0.53 s and +0.3 dB. Check: the empty tile room (A = 2.71 m2) matches the field mean for
unfurnished 25 to 50 m3 rooms (2.8 m2), which supports the gypsum and floor coefficients.

Curtains: 3 m2 of 14 oz drape adds 3 x 0.49 = 1.47 m2 at 500 Hz; in the furnished vinyl room
A goes from 10.82 to 12.29 m2, a change of -0.55 dB.

## Conflicts

1. **Field data are European.** The COST database came from teams at Italian and UK
   institutions (paper's acknowledgments); floor types are not reported. The 0.5 s furnished value agrees with R4's
   Canadian (0.4 s) and Korean (0.44 to 0.48 s) values, so **take 0.5 s for a furnished room
   with a hard floor** as the US default too.
2. **Furniture term double counts the floor.** The 7.9 m2 comes from comparing furnished and
   unfurnished rooms, and some furnished rooms will have had rugs. Adding it on top of a
   carpet floor may overstate absorption. **Accept the bias**: the carpet case is still the
   quietest. R4's Canadian living rooms (0.4 s, -1 dB vs 0.5 s) sit between the hard-floor
   and carpet-on-pad cases; their floor types were not checked.
3. **Coefficient tables have no stated origin.** Sengpiel and the pyroomacoustics database
   agree on carpet on foam (identical values), which suggests a common textbook origin, but
   neither cites it. Marked medium.
4. **Below 125 Hz.** Furnished rooms rise to about 1 s; the Sabine example does not cover this.
   The model's broadband term uses mid-frequency values.

## Not found

- **US field survey of reverberation time by floor covering.** Not found. Fallback: E1
  with the coefficient tables and the 7.9 m2 furniture term.
- **Absorption of a bed, sofa or mattress as an object (m2 per item).** Not found. Fallback:
  the lumped furniture term.
- **Primary origin (lab report) of the carpet and floor coefficients.** Not found.
  Fallback: the two compilations, marked medium.
- **Laminate floor coefficients.** Not found separately. Fallback: parquet on concrete,
  `unsourced` equivalence.
- **Bathroom and hallway T** (also missing in R4). Fallback: unfurnished hard-floor value,
  about 2 s, for a bathroom; `unsourced`.
