# R4. Room acoustics and room-to-room transfer

Research for issue #5. Checks section 2.2 (Sabine term, T = 0.5 s) and section 2.3 (room-to-room
formula, STC minus 5 dB, iteration) of `docs/NOISE_MODEL_PLAN.md`.

## Answer

A single reverberation time of 0.5 s is defensible for furnished bedrooms and living rooms.
ISO 12354-1 uses 0.5 s as the reference for dwellings, and measured furnished rooms come in at
0.4 to 0.5 s. Kitchens and bathrooms have harder surfaces and are probably longer (one study
found 0.68 s in kitchens at 1 kHz). We found no measured values for bathrooms or hallways.
The interior wall in most US houses (2x4 studs, one layer of gypsum each side) rates about STC 33
to 34 without insulation and about STC 35 to 37 with it. A hollow-core door rates STC 21 even
when sealed, and a solid-core door STC 30. A typical 1/2 inch undercut drops the sealed solid-core
door to about 21 dB, so in practice the door is the weak point of every interior wall. The 5 dB
derating is too small for stud walls. Lab pairs of STC and OITC on 2x4 walls differ by 7 to 9
points, so 8 dB is the better starting value. The room-to-room formula is the one the standards
use, but it predicts an average over many similar rooms. In a real small room, the choice of
reverberation time alone shifts the answer by up to about 1.3 dB. Below about 250 Hz there is
more scatter, which the sources describe but do not quantify. The iteration scheme is sound. Two
corrections are needed: count an open doorway's area as absorption in the room it leaves, and
solve all rooms at once rather than one after another.

## Values

Confidence: high = primary lab or standard text read in full; medium = primary source read only
in part, or OCR text, or secondary summary of a primary; low = trade or vendor source, or not
US housing.

### Reverberation time

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| rt.reference_dwelling | 0.5 | s | https://cdn.standards.iteh.ai/samples/70242/d3ac59602f454a409b4265d6eee67477/ISO-12354-1-2017.pdf (ISO 12354-1:2017 sample, clause 3.1.2) | "T0 is the reference reverberation time; for dwellings given as 0,5 s." | high |
| rt.living_room.furnished (Canada, 602 homes) | 0.4 (sd just under 0.1) | s | https://jcaa.caa-aca.ca/index.php/jcaa/article/download/568/253/643 (Bradley, NRC, "Acoustical measurements in some Canadian homes", Canadian Acoustics) | "In all 1/3 octave bands the mean reverberation time was close to 0.4 seconds with a standard deviation of just under 0.1 seconds." | high (row houses and apartments, living rooms, not detached US houses) |
| room.volume.living_room (same survey) | 57.0 (sd 64.1) | m3 | same as above | "Volume 57.0 m3 64.1 m3" (Table I, mean and standard deviation; OCR) | medium |
| rt.living_room.furnished (Korea) | 0.48 | s | https://koreascience.kr/article/JAKO201525961552827.pdf (Jeong et al., KSNVE 2015, doi 10.5050/KSNVE.2015.25.4.291) | "Averaged reverberation time of furnished living room was 0.48 s and the reverberation time of bedroom was 0.44 s." | medium (not US housing) |
| rt.bedroom.furnished (Korea) | 0.44 | s | same as above | same quote as above | medium (not US housing) |
| rt.unfurnished_unit (Korea) | 1.11 | s | same as above | "Average reverberation time of unfurnished apartment unit was 1.11 s" | medium (not US housing) |
| rt.kitchen (England, 50 kitchens) | 0.76 at 125 Hz, 0.68 at 1 kHz | s | https://www.sciencedirect.com/science/article/abs/pii/0003682X72900308 (Jackson and Leventhall, "The acoustics of domestic rooms", Applied Acoustics 5, 1972) | "The average kitchen had a corresponding reverberation time characteristic which fell from a value of 0·76 sec at 125 Hz to 0·68 sec at 1 kHz" | medium (abstract text via search; page fetch was refused; UK 1972) |
| rt.bedroom_vs_living (Spain, 11,457 furnished rooms) | similar at equal size | - | https://manuscript.isc.ac/Inventory/10/1170777.htm (Diaz and Pedrero, "The reverberation time of furnished rooms in dwellings", Applied Acoustics 2005) | "reverberation times measured are quite similar in bedrooms and living rooms within the same size range" | medium (abstract only; heavy masonry rooms) |
| rt.bathroom | not found | s | - | - | unsourced |
| rt.hallway | not found | s | - | - | unsourced |

### Interior partitions (lab STC unless noted)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| wall.stud_gypsum.uninsulated | 33 | STC | https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd239_e.html (Warnock, NRC Canadian Building Digest CBD-239, 1985; MIT mirror) | "the common internal partition used in single family homes with drywall attached directly to both sides of the wood studs" ... "has an STC rating of about 33" | high |
| wall.stud_gypsum.insulation_gain | 3 | STC points | same as above | "The addition of sound absorbing material in this wall increases its rating by about only 3 points." | high |
| wall.stud_gypsum.5_8in.16oc.uninsulated | 34 | STC | https://www.usg.com/content/dam/USG_Marketing_Communications/united_states/product_promotional_materials/finished_assets/drywall-wood-framed-systems-SA924.pdf (USG SA924, system D) | "Wd Stud-5/8 SHEETROCK Brand gypsum panels, FIRECODE core ... 2 x 4 16 or 24 o.c.- panels nailed 7 o.c." with "34 Based on 16 stud spacing and screws 6 o.c.-USG-30-FT-G&H" | high (manufacturer lab test) |
| wall.stud_gypsum.5_8in.24oc.uninsulated | 37 | STC | same as above | "37 Based on 24 stud spacing-USG-860807" | high |
| wall.stud_gypsum.5_8in.24oc.insulated | 46 | STC | same as above | "46 Based on 24 stud spacing & 3 SAFB -BBN-700725" | high (mineral wool, 24 in spacing; not the common 16 in case) |
| wall.stud_gypsum.uninsulated.TL_125_160Hz | 25, 20 | dB | same as above (USG-860807 one-third octave row) | "D USG-860807 Lab 25 20 34 37 33 32 37 36 40 42 44 45 38 34 36 41 37" (125 Hz to 4000 Hz, then STC) | high |
| wall.stud_gypsum.5_8in.16oc.R13 | 35 STC, 26 OITC | STC / OITC | https://www.acousticalsurfaces.com/wp-content/uploads/AS_TL1766-1.pdf (Acoustic Systems, NVLAP lab, report AS-TL1766, 2000) | "STC 35" "OITC 26" for "Typical Residential Wall w/ 2x4 Wood Studs and R-13 UltraTouch Blue Insulation" (5/8 in Type X both sides, studs 16 in o.c.) | high |
| wall.exterior_2x4_half_inch_gypsum.STC_minus_OITC | 7 to 9 (seven tests: 33/25, 34/25, 34/25, 33/25, 31/24, 34/26, 34/25) | points | https://insulationinstitute.org/wp-content/uploads/2021/08/NAIMA-AcousticsBrochure8_20212.pdf (NAIMA, Intertek York PA, 2019 tests) | "Fiberglass R-13 Unfaced 33 25" (STC, OITC); build: "One layer, 1/2" Gypsum Board", 2x4 at 16 in, OSB, vinyl siding | high (exterior walls, but same stud and gypsum system) |
| wall.stud.low_freq_resonance | 125 Hz dip for 406 mm stud spacing | Hz | https://jcaa.caa-aca.ca/index.php/jcaa/article/download/1385/1128/1518 (Bradley and Birta, NRC, Canadian Acoustics 29(3) 2001) | "For the base wall, without resilient channels, the dip at 125 Hz is the primary structural resonance of the ribbed panel system" | high |

### Doors

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| door.hollow_core.sealed (1-3/4 in, 1.25 lb/ft2) | 21 | STC | https://nvlpubs.nist.gov/nistpubs/Legacy/BSS/nbsbuildingscience77.pdf (NBS Building Science Series 77, 1975, Fig. 22) | "W-93-T1 Wood flush hollow core 21" | high (exterior-grade 1-3/4 in leaf; a 1-3/8 in interior hollow door is lighter, so likely no better) |
| door.solid_core.sealed (1-3/4 in, 3.9 lb/ft2) | 30 | STC | same as above | "W-91-T1 Wood flush solid core 30" | high |
| door.solid_core.weatherstripped | 27 | STC | same as above | "A solid core flush wood door having an STC of 30 sealed was reduced to STC 27 when normally closed against either a spring brass or a plastic weather strip." | high |
| door.solid_core.no_seals (NRC) | 22 | STC | https://jcaa.caa-aca.ca/index.php/jcaa/article/download/566/251/641 (Quirt, NRC, "Sound transmission through double doors", Table 1) | "Wood door 22 26 - 30 31" (No Seal, Weatherstrip, Fully Sealed) | high (plywood threshold, so perimeter gaps but no undercut) |
| door.gap.R | 0, independent of frequency | dB | https://nvlpubs.nist.gov/nistpubs/Legacy/BSS/nbsbuildingscience77.pdf (Sec. 3.5) | "the transmission loss of the crack is zero at all frequencies" and "the transmission through the crack was almost independent of frequency" | high |
| door.gap.R0_is_optimistic | measured worse than R = 0 area rule | - | same as above | "the measured values were lower than equation (7) would predict" | high |
| door.undercut.typical | 0.5 (field range 3/8 to 3/4 reported second hand) | in | https://www.greenbuildingadvisor.com/article/when-are-door-undercuts-sufficient-for-return-air (Bailes, 2017, citing Semmelhack field tests) | "He finds that a half inch door undercut works just fine in most of the homes he tests." | medium (HVAC practice, not an acoustic source) |
| door.undercut.effect | bottom gap lowers isolation | - | https://bac-lac.wayback.archive-it.org/web/20061211031559/http://dsp-psd.pwgsc.gc.ca/Collection/NH18-22-93-211E.pdf (CMHC Research Highlights 93-211) | "Leaving a gap at the bottom of the access door to allow air in from the corridor to the dwelling diminishes the door's soundproofing ability." | high (qualitative only) |
| door.with_undercut.hollow_core | 18.5 | dB (composite) | derived here from the rows above, see Equations | - | derived |
| door.with_undercut.solid_core | 21.4 | dB (composite) | derived here from the rows above, see Equations | - | derived |

### Floor and ceiling assemblies between storeys

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| floor.wood_joist.direct_gypsum.uninsulated | 38 (39 with carpet) | STC | https://www.usg.com/content/dam/USG_Marketing_Communications/united_states/product_promotional_materials/finished_assets/drywall-wood-framed-systems-SA924.pdf (USG SA924, system I, UL L501) | "5/8 SHEETROCK Brand Gypsum Panels, FIRECODE core ... 2 x 10 wd joist 16 o.c.-panels att with 6d nails 6 o.c." with "38 32 Based on 1-1/4 nom wd flr-CK-6412-7" (STC, IIC) | high |
| floor.wood_joist.direct_gypsum.insulated | 41 (40 with carpet) | STC | same as above (system J) | "3 THERMAFIBER SAFB betw joists-panels att with 6d nails" with "41 32 Based on 1-1/4 nom wd flr-CK-6412-6" | high |
| floor.wood_joist.insulation_gain | +5 | STC points | https://weyerhaeuser.com/blog/sound-performance-of-residential-trus-joist-floor-systems | "small benefit for STC (+5 points), but no benefit for IIC" | low (manufacturer blog citing NRC IR-811) |
| floor.wood_joist.resilient_channel_gain | +10 | STC points | same as above | "greatly improve both STC and IIC (+10 points)" | low |
| floor.concrete.4in_54psf | 49 | STC | https://nonoise.org/epa%20index/roll21/roll21doc10.pdf (DuPree, California Office of Noise Control, "Catalog of STC and IIC Ratings for Wall and Floor/Ceiling Assemblies", 1980; NBS test 1964) | "4" thick flat concrete panel, 54 psf ... National Bureau of Standards ... 49" (OCR of a scan) | medium |
| floor.concrete.6in_75psf | 53 | STC | same as above (Riverbank test) | "6" thick flat concrete panel, 75 psf. ... Riverbank Acoustical Labs. ... 53" (OCR of a scan) | medium |

### Low-frequency derating and small-room validity

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| derate.stud_wall.STC_minus_OITC | 9 (TL1766); 7 to 9, mean 8.3 (NAIMA, 7 walls) | dB | https://www.acousticalsurfaces.com/wp-content/uploads/AS_TL1766-1.pdf and https://insulationinstitute.org/wp-content/uploads/2021/08/NAIMA-AcousticsBrochure8_20212.pdf | "STC 35" "OITC 26"; NAIMA table rows as above | high |
| derate.OITC_meaning | OITC is the A-weighted reduction of a transportation reference spectrum, 80 to 4000 Hz | - | https://store.astm.org/e1332-22.html (ASTM E1332 scope page) | "this classification provides a more reliable ranking of the performance of partitions and facade elements than do other classifications such as Classification E413." | high |
| room_to_room.formula | R' = L1 - L2 + 10 lg(Ss/A) | dB | https://cdn.standards.iteh.ai/samples/70242/d3ac59602f454a409b4265d6eee67477/ISO-12354-1-2017.pdf (ISO 12354-1:2017 clause 3.1.1) | "The index R' is normally determined from measurements according to R' = L1 - L2 + 10 lg (Ss/A) dB" | high |
| room_to_room.formula.field_use_in_homes | TL = NR + 10 log(S/A) | dB | https://jcaa.caa-aca.ca/index.php/jcaa/article/download/568/253/643 (Bradley, 602 homes, ASTM E336) | "TL = NR + 10.log(S/A)" | high |
| room_to_room.small_room_limit | model gives an ensemble average, not one small room | - | https://www.euronoise2018.eu/docs/papers/Plenary_Hopkins.pdf (Hopkins, Euronoise 2018 plenary) | "EN ISO 12354 aims to predict the performance of an ensemble of similar rooms; although it is not able to replicate the modal fluctuations that occur at low-frequencies in small rooms." | high |
| schroeder.constant | 2000 (SI) | - | https://www.prosoundtraining.com/2022/07/15/room-acoustics-case-study-small-room/ | "k is 2000 (SI) or 11,885 (US)" and "As the RT gets shorter, the validity of FS is reduced." | low (practitioner site; formula is standard textbook) |
| iso12354.accuracy | stated only as indications; Annex K | - | https://cdn.standards.iteh.ai/samples/70242/d3ac59602f454a409b4265d6eee67477/ISO-12354-1-2017.pdf (Introduction) | "The accuracy of this document can only be specified in detail after widespread comparisons with field data" | high (the numbers in clause 5 were not in the free sample) |

## Equations

### E1. Absorption area (Sabine), unchanged from the plan

`A = 0.161 * V / T`

- A: equivalent absorption area of the receiving room, m2
- V: room volume, m3
- T: reverberation time, s

Worked example: bedroom 4 x 3.5 x 2.4 m, V = 33.6 m3, T = 0.5 s gives A = 0.161 * 33.6 / 0.5 =
10.82 m2. This matches the plan's T1 test value of 10.8.

Sensitivity: the error in `10*log10(S/A)` from a wrong T is `10*log10(T_true / 0.5)`. With the
Canadian mean of 0.4 s the term is 0.97 dB too high. With the English kitchen value of 0.68 s it is
1.34 dB too low. So one value of 0.5 s costs about plus or minus 1.3 dB per room. That is within
the stated plus or minus 3 dB range.

### E2. Composite partition with a door and an undercut

```
tau_i      = 10^(-R_i/10)
tau_part   = sum(S_i * tau_i) / sum(S_i)
R_part     = -10*log10(tau_part)
```

- S_i: area of each element (wall net of door, door leaf, undercut gap), m2
- R_i: sound reduction of each element, dB; gaps and open doors use R = 0 (NBS BSS 77)

Undercut: a 32 in (0.81 m) door with a 1/2 in (12.7 mm) undercut has a gap of
0.81 * 0.0127 = 0.0103 m2. That is 0.62% of a 1.65 m2 door.

- Hollow core: 1.64 m2 at 21 dB plus 0.0103 m2 at 0 dB gives R = 18.5 dB.
- Solid core: 1.64 m2 at 30 dB plus 0.0103 m2 at 0 dB gives R = 21.4 dB.

Cross-check: NRC measured the unsealed solid-core door at STC 22 with perimeter gaps and no
undercut. NBS found real cracks transmit more than the R = 0 area rule predicts. So 18 to 21 dB is
an upper bound for a closed interior door, not a lower one.

### E3. Room to room (confirmed form, ISO 12354-1 and ASTM E336)

`L_recv = L_send - R_part + 10*log10(S_part / A_recv)`

- L_send, L_recv: space-averaged levels in the source and receiving rooms, dBA
- R_part: composite reduction of the shared surface, dB, derated for traffic (see E4)
- S_part: area of the shared surface, m2
- A_recv: absorption area of the receiving room, m2, from E1, plus any open opening (see E5)

Worked example: hall at 45 dBA feeds the bedroom above through a 7.2 m2 interior wall that holds a
1.6 m2 hollow-core door with a 1/2 in undercut.

- Wall, 5.6 m2: STC 33 minus 8 = 25 dB, so tau*S = 5.6 * 10^-2.5 = 0.0177
- Door leaf, 1.59 m2: STC 21 minus 5 = 16 dB, so tau*S = 0.0399 (the 5 dB for a door leaf is a
  placeholder, see Not found)
- Undercut, 0.0103 m2: R = 0, so tau*S = 0.0103
- tau_part = 0.0680 / 7.2 = 0.00944, so R_part = 20.3 dB
- 10*log10(7.2 / 10.82) = -1.8 dB
- L_recv = 45 - 20.3 - 1.8 = 23.0 dBA

Door open (1.6 m2 at R = 0): R_part = 6.5 dB and L_recv = 36.7 dBA. If the doorway area is also
added to A_recv (E5), L_recv = 36.1 dBA. The door leaf and undercut carry about three quarters of the closed-door energy (0.0502 of 0.0680).
This is why "close the door" and "add a door sweep" are real fixes.

### E4. Traffic derating

`R_traffic = STC - D`

- D: derating, dB. Use D = 8 for wood-stud walls and wood-joist floors. This is the mean
  STC minus OITC of eight lab tests on 2x4 gypsum walls, which ranged from 7 to 9.
- Gaps and open doors: D = 0, because a crack's loss does not depend on frequency.

Worked example: interior wall at STC 33 gives R_traffic = 25 dB, not the plan's 28 dB. In the E3
example, using D = 5 for the wall raises R_part only from 20.3 to 20.9 dB, because the door
dominates. D matters most for walls with no door and for floors.

### E5. House energy balance (iteration scheme, confirmed with two corrections)

Write each room's mean-square pressure as `E_i = 10^(L_i/10)`. Then:

```
E_i = F_i + sum_j  c_ij * E_j
c_ij = sum over shared surfaces k of (S_k * tau_k) / A_i
```

- F_i: energy from the facade paths into room i (section 2.2), linear units
- c_ij: coupling from room j into room i, dimensionless
- A_i: absorption area of room i, m2, from E1

This is the plan's formula written for every room at once. It is a linear system `(I - C) E = F`.

Confirmed:
- Iterating converges when every row of C sums to less than 1. That holds whenever each room's
  total open and transmitting area is smaller than its absorption area. In the E3 example, c is
  0.006 with the door closed and 0.15 with it open. Each pass shrinks the error by about that
  factor, so 10 passes is far more than enough with doors closed. With doors open, a few passes
  bring it within 0.01 dB.
- Iterating does remove order dependence, but only after it converges. Update all rooms from the
  previous pass (Jacobi), or solve the system directly. Both give the same answer, and neither
  depends on the order rooms are visited. Stop when no room changes by more than 0.01 dB. Do not
  stop at a fixed number of passes. We found no source for "two passes is the documented minimum".

Corrections (derived from the Sabine energy balance, not quoted from a source):
1. An open doorway removes sound from the room it leaves as fully as an absorber of the same area.
   Add each open opening's area to A_i on both sides. Without this, two rooms joined by a large
   opening can feed energy back and forth and overshoot.
2. If an opening is about as large as A_recv (c_ij close to 1, as in open-plan living and
   kitchen), the two spaces are one room. Merge them before solving. The formula is not meant
   for this case, and it can predict a receiving room louder than the source room.

### E6. When the diffuse-field model is trustworthy (Schroeder frequency)

`f_S = 2000 * sqrt(T / V)`

- f_S: Schroeder frequency, Hz, below which a room's response is dominated by single modes
- T: reverberation time, s; V: volume, m3

Worked example: the bedroom (T = 0.5 s, V = 33.6 m3) gives f_S = 2000 * sqrt(0.0149) = 244 Hz.
Traffic noise that has come through a stud wall is concentrated around and below the wall's
125 Hz resonance (Bradley and Birta). So in small rooms the most important bands fall below f_S.
There the formula is right on average across many similar rooms, but not for one particular room.

## Conflicts

1. Insulation gain in a stud wall. NRC CBD-239 gives about +3 STC. USG shows +9 (37 to 46), but at
   24 in stud spacing with mineral wool. The NAIMA walls with batts at 16 in rated 33 to 34, the same
   as CBD-239's uninsulated wall. **We take +3**: it matches the common 16 in framing and the NAIMA
   data. Defaults: STC 33 uninsulated, STC 36 insulated. The NAIMA walls also had OSB and siding,
   so they are not a perfect match.
2. Insulation gain in a joist floor. USG direct-attached floors gain +3 (38 to 41). Weyerhaeuser
   says +5. AWC TR-15 says 7 to 11, but only for floors with resilient channels. **We take USG's +3
   for direct-attached ceilings**, which are typical in houses: STC 38 uninsulated, 41 insulated.
3. Hollow-core door. NBS measured STC 21 (sealed, 1-3/4 in). Vendor and blog sources give 20 to 32.
   **We take NBS 21**. It is a US government lab test, and it is generous for lighter 1-3/8 in
   interior doors.
4. Six-inch concrete slab. The OCR of the California catalog reads STC 53 (Riverbank). A secondary
   summary of a PCI table says STC 55. We could not open the PCI source. **We take 53** because it
   is the one we could read, and it is the more conservative value.
5. Derating. The plan says 5 dB. Lab STC and OITC pairs for 2x4 walls give 7 to 9. **We take 8.**
6. Reverberation time. Furnished living rooms and bedrooms measure 0.4 to 0.48 s. ISO uses 0.5 s.
   Older English kitchens measured about 0.68 s. **We keep 0.5 s everywhere**, as the plan does.
   The error is about plus or minus 1.3 dB at most, inside the model's range. A per-type table is
   optional: bedroom and living 0.45 s, kitchen 0.65 s. These are rounded from the sources above
   and are not sourced values themselves.

## Not found

| item | what is missing | fallback |
|---|---|---|
| Bathroom and hallway T | No measured values found (only vendor ranges) | 0.5 s, status `placeholder`; these rooms rarely drive results |
| Field vs lab for interior walls | No primary source for how much lower field STC (ASTC) is in houses; the 3 to 5 points seen are secondary | No extra term. The plus or minus 3 dB range covers it. Note as a known limit |
| Derating for door leaves and concrete | No OITC found for doors or slabs. A PCI table may give a second value next to STC (46 for 6 in) that could be OITC; unverified | Door leaf D = 5 and slab D = 8, status `placeholder`. Gaps D = 0 (sourced) |
| Derating for wood-joist floors | No OITC for floor/ceiling assemblies | D = 8 by analogy with stud walls (same lightweight panel-on-framing system), status `placeholder` |
| Lighter 1-3/8 in interior hollow-core door | Only the 1-3/4 in leaf was tested | Use STC 21. It is likely a slight overestimate |
| Interior door perimeter gaps (sides and top) | Typical clearance not sourced | Use the undercut gap only. NBS shows real gaps are worse, so the result is optimistic |
| ISO 12354-1 clause 5 accuracy numbers | Not in the free sample | Use the plan's plus or minus 3 dB. Small-room scatter is described but not quantified in what we read |
| Primary US floor data for slabs between storeys in houses | Only wall-panel tests of concrete | Use 49 (4 in) and 53 (6 in). Two-storey concrete floors are rare in US detached houses |
| Waterhouse correction (Hopkins mentions it for small rooms) | Formula not taken from a source we read | Do not apply it |
