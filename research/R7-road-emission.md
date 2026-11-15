# R7. Road noise from traffic counts (FHWA emission model)

Research for issue #17. Checks the detailed road form in section 2.1 of
`docs/NOISE_MODEL_PLAN.md`. All URLs were opened and all service calls were run on
2026-11-14.

## Answer

The plan's starting hypothesis holds. FHWA-RD-77-108 gives a complete closed-form
equation for the hourly Leq of each vehicle class from volume, speed, distance, ground
type and the angle of road the receiver sees (equation E1 below). The three classes are
energy-summed. The report also gives the 24-hour form directly from AADT (constant
-38.8 instead of -25), which is what we need to compare with BTS.

1. **Emission levels and equation.** RD-77-108 reference levels at 15 m are
   `38.1 log S - 2.4` (cars), `33.9 log S + 16.4` (medium trucks) and
   `24.6 log S + 38.5` (heavy trucks), S in km/h. The full equation and the worked
   example are E1 to E5. For the plan's sample Yale St hour (1400 veh/h, 4% trucks,
   50 km/h, wall 15 m from the lane, sees the whole road) the result is 66.4 dBA on
   soft ground and 67.6 dBA on hard ground.
2. **TNM REMELs (FHWA-PD-96-008, 1995 data) versus RD-77-108 (1975 data).** Per class
   they differ by 1 to 3 dB: TNM cars are 1.2 to 2.4 dB louder, TNM medium trucks 0.9
   to 2.6 dB quieter, TNM heavy trucks 1.5 to 3.1 dB quieter (40 to 113 km/h). For
   urban Houston traffic with 3 to 6% trucks these mostly cancel: the total changes by
   about -0.3 to -0.6 dB. **Use the TNM REMELs** (current, required by 23 CFR 772.9 for
   federal analyses, and what BTS used) inside the RD-77-108 closed-form propagation.
   Keep the 1977 equations only as a cross-check.
3. **Truck split.** Texas already publishes the split: the TxDOT Roadway Inventory has
   `AADT_SINGLE_UNIT` and `AADT_COMBINATION` per segment. Map single-unit (FHWA classes
   4 to 7) to medium trucks and combination (classes 8 to 13) to heavy trucks. When only
   a truck share is known, use the Texas urban shares from FHWA Highway Statistics
   VM-4: single-unit is 48.6% of trucks on urban arterials and 28.0% on urban
   interstates.
4. **Polylines.** Split the road into straight pieces, compute E1 for each piece with its
   own angles and perpendicular distance, and energy-sum (E6). Curves: split until each
   piece subtends at most 10 degrees at the receiver (TNM's rule). The line-source form
   holds only for D >= 15 m from the lane centre. Closer facades are outside the model;
   we propose clamping D at 15 m (a choice, not a sourced rule).
5. **Check against BTS.** Road: N Durham Dr, TxDOT station 102U556, 2020 AADT 16,150,
   4.4% trucks, 35 mph. At the BTS pixel nearest the road line (pixel centre 20 m from
   the TxDOT centreline) the FHWA 24-hour level is 62.3 dBA and BTS 2020 reads 62.6:
   **BTS minus FHWA = +0.4 dB.** But BTS falls much faster with distance than any line
   source: at 40 m BTS is at its 45 dBA floor while FHWA gives 57.8, so **BTS is at least
   12.8 dB below FHWA** there, and 25 to 165 m from Durham the median BTS minus FHWA is
   -5 to -12 dB. At the demo unit on Yale St, BTS reads 52.3 dBA and FHWA at 15 m gives 63.3 dBA
   (Yale's 2016 count). So `checks.road_detailed_minus_bts_db` will often be large and
   positive away from the road line. This is not a bug in our equation: the same falloff
   appears next to I-10 (79 dBA on the road, 45 floor by 180 m). See Conflicts 3 and 4.

## Values

Sources:
- [RD] FHWA-RD-77-108, *FHWA Highway Traffic Noise Prediction Model*, Barry and Reagan, December 1978: https://rosap.ntl.bts.gov/view/dot/30259/dot_30259_DS1.pdf (quotes are from the report's text layer, which is OCR of a scan; equation layout is garbled in places and was rebuilt from the quoted constants)
- [PD] FHWA-PD-96-008 / DOT-VNTSC-FHWA-96-2, *Development of National Reference Energy Mean Emission Levels for the FHWA Traffic Noise Model*, Fleming, Rapoza, Lee, November 1995: https://rosap.ntl.bts.gov/view/dot/6290/dot_6290_DS1.pdf (scanned images, no text layer; the pages quoted were OCR'd locally with tesseract)
- [TM] FHWA-PD-96-010, *FHWA Traffic Noise Model Version 1.0 Technical Manual*, February 1998: https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm10techmanual.pdf
- [BTS20] BTS, *National Transportation Noise Map Documentation* (2022 edition, 2020 data): https://rosap.ntl.bts.gov/view/dot/53773/dot_53773_DS1.pdf
- [VM4] FHWA, *Highway Statistics 2020*, Table VM-4: https://www.fhwa.dot.gov/policyinformation/statistics/2020/vm4.cfm
- [TMG13] FHWA, *Traffic Monitoring Guide 2013*, Appendix C vehicle types: https://www.fhwa.dot.gov/policyinformation/tmguide/tmg_2013/vehicle-types.cfm
- [TMG22] FHWA, *Traffic Monitoring Guide 2022*, federal data reporting: https://www.fhwa.dot.gov/policyinformation/tmguide/tmg_2022/federal-data-reporting.cfm
- [TXA] TxDOT AADT Annuals (public view) feature service: https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_AADT_Annuals_(Public_View)/FeatureServer/0
- [TXRI] TxDOT 2020 Roadway Inventory feature service: https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_2020_Roadway_Inventory_/FeatureServer/0
- [ESRI] Esri copy of BTS 2020 per-mode raster (road = sliceId 3), read as in R1 equation E1: https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer

### FHWA-RD-77-108 model

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| REMEL, automobiles | 38.1 log10(S) - 2.4 | dBA at 15 m, S in km/h | [RD] eq. (4) | "(L~o)e a = 38.1 log (5) - 2.4 (4)" (OCR; "(5)" is "(S)") | high |
| REMEL, medium trucks | 33.9 log10(S) + 16.4 | dBA at 15 m | [RD] eq. (5) | "(L~o)e mt = 33.9 log (S) + 16.4 (5)" | high |
| REMEL, heavy trucks | 24.6 log10(S) + 38.5 | dBA at 15 m | [RD] eq. (6) | "= 24.6 log (S) + 38.5 (6) ... where S is the average vehicle speed of the vehicle class in km/h" | high |
| Same three, restated | 38.1, 33.9 + 16.4, 24.6 + 38.5 | dBA | [RD] eqs. (24) to (26) | "(L~o)e mt = 33.9 log 5 + 16.4 (25) {L~ \) E = 24.6 log 5 + 38.5. (26)" | high |
| Class A (automobiles) | 2 axles, 4 wheels, < 4,500 kg (includes light trucks) | - | [RD] sec. 2(b) | "all vehicles with two axles and four wheels designed primarily for, transportation of nine or fewer passengers (automobiles), or transportation of cargo (light trucks)" | high |
| Class MT | 2 axles, 6 wheels, 4,500 to 12,000 kg | - | [RD] sec. 2(b) | "all vehicles having two axles and six wheels designed for the trans- portation of cargo" | high |
| Class HT | 3 or more axles, > 12,000 kg | - | [RD] sec. 2(b) | "all vehicles having three or more axles and designed for the transpor- tation of cargo" | high |
| Reference distance D0 | 15 | m | [RD] eq. (1) definitions | "In the FHWA model, D Q is 15 metres." | high |
| Terms of eq. (1) | REMEL + traffic flow + distance + finite roadway + shielding | dB | [RD] eq. (1) | "reference energy mean emission level ... traffic flow adjustment ... distance adjustment ... finite roadway adjustment +A S shielding adjustment (1)" | high |
| Traffic flow term | 10 log10(N D0 / S) - 25 | dB | [RD] eqs. (7), (8) | "the expression 10 log (N t ttD /TSj) is simplified to 10 log (N^Do /S t ) -25 (Note: -25 = 10 log it  10 log 1000)" | high |
| N, S, T | vehicles per hour of the class; km/h; T = 1 h | - | [RD] sec. 2(c) | "Nj is the number of vehicles in the zth class passing a given point over a 1-hour period ;D is equal to 15 metres; T is equal to 1-hour; andS,- is measured in kilometres per hour" | high |
| D | perpendicular distance, lane centreline to observer | m | [RD] eq. (1) definitions | "D is the perpendicular distance, in metres, from the centerline of the traffic lane to the observer." | high |
| Distance term | 10 log10((D0/D)^(1+α)) | dB | [RD] eq. (9) | "the distance adjustment factor can be expressed as ( D 1 + a 10 log [-£-) (9)" (OCR of (D0/D)^(1+α)) | high |
| α, hard site | 0 (3 dBA per doubling) | - | [RD] eq. (10) | "when the ground between the roadway and observer is acoustically hard, the site is reflective (a = 0)" | high |
| α, soft site | 1/2 (4.5 dBA per doubling) | - | [RD] eq. (11) | "when the intervening ground is acoustically soft the site is absorptive (a =^ 1/2) ... the drop-off rate is 4.5 dBA per doubling of distance" | high |
| Same α in both terms | use one α for distance and segment terms | - | [RD] sec. 2(e) | "if a = 1/2 is used for the distance adjustment, it should also be used for the finite length roadway adjustment" | high |
| Segment angles φ1, φ2 | measured at the observer from the perpendicular to the (extended) road; left negative, right positive | deg | [RD] sec. 2(e), Fig. 5 | "If 0j is measured to the left of the perpendicular it is negative. If X is measured to the right of the perpendicular it is positive." | high |
| Segment term, hard | 10 log10((φ2 - φ1)/π) | dB | [RD] Fig. 6, Problem 5(a) | worked: "Segment C: : = -22°, 2 = +55°, A0 = ... 77° Adjustment (Figure 5-1) = -3.5 dBA" (formula 10 log(77/180) = -3.7) | high |
| Segment term, soft | 10 log10((1/π) ∫ from φ1 to φ2 of sqrt(cos φ) dφ) | dB | [RD] App. C, eq. (C-1) | "Segment adjustment = 10 log = 10 log  I Vcos0 d<j> . (C-l)" (OCR of the integral of sqrt(cos φ)) | high |
| Infinite road, soft site | -1.2 | dB | [RD] sec. 2(e) | "Figure 7 also indicates that the adjustment for an infinitely long roadway is a -1.2 dBA." | high |
| Total over classes | energy sum of A, MT, HT | dBA | [RD] eq. (2) | "The L e (h) is the sum of the acoustic contributions of the various classes of vehicles using the roadway." | high |
| 24-hour form | AADT_i in place of N_i, constant -38.8 | dB | [RD] App. F, eq. (F-3) | "if we let Nj represent the average annual daily traffic (AADT) for the zth class of vehicles ... This reduces to ... 10 log 5* - 38.8" | high (constant re-derived: 10 log π - 30 - 10 log 24 = -38.83) |
| Minimum distance | 15 m | m | [RD] App. A, p. A-2 | "Practically, the reference distance should not be less than 15 metres ... it is implied that the minimum observer dis- tance, D, should also be 15 metres." | high |
| Closer than 15 m | separate point-source equation, accuracy not established | - | [RD] sec. 6.0(c) | "The accuracy of Equations (36) and (37) has not been established." | high |
| Equivalent lane distance | D_E = sqrt(D_N D_F) | m | [RD] sec. 3, eqs. (20), (21) | "D E = [(Receiver near lane (^distance) X (Receiver far lane (£ distance)] 1/2" (Example Problem 1, App. B) | high |
| ELD caution | do not trust D_E within 15 m of the near lane, or with wide medians or uneven direction split | - | [RD] sec. 3 | "When the observer is located within 15 metres of the centerline of the near lane." | high |

### TNM emission levels (1995 data)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| TNM A-weighted emission form | L = 10 log10((0.6214 s)^(A/10) 10^(B/10) + 10^(C/10)) | dBA (max pass-by at 15 m), s in km/h | [TM] App. A, eq. (5), p. 25 | "TNM needs three constants to compute A-weighted noi se-level emissions: A, B and C." (equation is an image; form confirmed by reproducing PD Table 37 to 0.01 dB, see E3) | high |
| Autos, cruise, average pavement | A 41.740807, B 1.148546, C 50.128316 | - | [TM] Table 5, p. 27 | "41.7 4 0 8 0 7 1.14 85 4 6 50.1 28 3 1 6" (text layer, spaces inserted by the PDF) | high |
| Medium trucks, cruise, average pavement | A 33.918713, B 20.591046, C 68.002978 | - | [TM] Table 5 | "33.9 1 8 7 1 3 20.5 9 1 0 4 6 68.0 02 9 7 8" | high |
| Heavy trucks, cruise, average pavement | A 35.879850, B 21.019665, C 74.298135 | - | [TM] Table 5 | "35.8 7 9 8 5 0 21.0 1 9 6 6 5 74.2 98 1 3 5" | high |
| Full-throttle rows (not used) | C = 67.0 autos, 74.0 MT, 80.0 HT | - | [TM] Table 5 | "41.7 4 0 8 0 7 1.14 85 4 6 67.0 0" | medium (row order read from the table layout) |
| TNM vehicle classes | autos 2 axles 4 tires; MT 2 axles 6 tires; HT 3+ axles | - | [TM] App. A, p. 23 | "Medium trucks: all cargo vehicles with two axles a nd six tires." | high |
| TNM traffic flow constant | -13.2 (= 10 log10 0.0476) | dB | [TM] App. C, eq. (16) | "This factor of 0.04 76 corresponds to the term -1 3.2 dB i n Eq. (2) of Section 2" | high |
| TNM distance and angle | energy x (α/180) x (15/d), α in degrees | - | [TM] App. C, eq. (18) | "In this equation,  is in degrees and d is in meters." | high |
| TNM elemental angle | at most 10 degrees | deg | [TM] App. C.1 | "TNM divides elemental triangles so that the maximum s ubtended angle is no larger than a fixed size (10 degrees in TNM, Version 1.0)" | high |
| TNM collinear case | special formula if d < 0.3 m and α < 20 deg | - | [TM] App. C.2.3 | "(1) the perpendicular distance, d , is less than 0.3 meter s (1 foot); and also (2) the angle subtended, , is less than 20 degrees" | high |
| REMEL measurement ground | generally absorptive, mic 1.5 m high at 15 m | - | [TM] App. A.1 | "Generally the ground between the roadway edge and the microphone was acoustically ab sorptive, although not always." | high |
| Emission trend at 88.5 km/h, 1975 (STAMINA) | A 71.74, MT 82.37, HT 86.30 | dBA | [PD] Table 37, report p. 71 (PDF image 98) | "1975 (STAMINA) 71.74 82.37 86.30" (OCR) | high |
| Emission trend at 88.5 km/h, 1994-95 (TNM) | A 73.81, MT 79.91, HT 83.96 | dBA | [PD] Table 37 | "1994 through 1995 73.81 79..91 83.96 (FHWA TNs)" (OCR) | high |
| Trend, cars | about +1 dB per 10 years since 1975 | dB | [PD] sec. 7.3, p. 71 | "the emission levels for automobiles have increased by approximately 1 4B every 10 years since 1975" (OCR, "4B" = "dB") | high |
| Trend, trucks | about -3 dB 1975 to 1985, flat since | dB | [PD] sec. 7.3 | "The emission levels for medium and heavy trucks decreased by approximately 3 dB from 1975 to 1985" | high |
| Data base size | about 6,000 vehicles, 9 states | - | [TM] sec. 2.1 | "Approximately 6000 vehicles were measu red in 9 states." | high |
| TNM required for federal analyses | yes | - | https://www.law.cornell.edu/cfr/text/23/772.9 | "Any analysis required by this subpart must use the FHWA Traffic Noise Model (TNM)." | high |

### Truck split

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| FHWA class 4 | buses | - | [TMG13] | "All vehicles manufactured as traditional passenger-carrying buses with two axles and six tires or three or more axles." | high |
| FHWA class 5 (= TNM medium truck) | two-axle, six-tire single-unit | - | [TMG13] | "with two axles and dual rear wheels." | high |
| FHWA class 6 (= TNM heavy truck) | three-axle single-unit | - | [TMG13] | "All vehicles on a single frame including trucks, camping and recreational vehicles, motor homes, etc., with three axles." | high |
| HPMS single-unit AADT | FHWA classes 4 to 7 (buses and single-unit trucks) | veh/day | [TMG22] sec. 5.2.1 | "includes FHWA vehicle classes 4-7" | high |
| HPMS combination AADT | FHWA classes 8 to 13 | veh/day | [TMG22] sec. 5.2.1 | "includes FHWA vehicle classes 8-13" | high |
| Texas, urban other arterials, 2020 VMT share | single-unit 3.70%, combination 3.91% (buses 0.28%) | % of VMT | [VM4] | Texas urban "OTHER ARTERIALS" row: "0.21 66.68 25.22 0.28 3.70 3.91 100.00" | high |
| Texas, urban interstate, 2020 VMT share | single-unit 3.77%, combination 9.71% | % of VMT | [VM4] | Texas urban "INTERSTATE SYSTEM" row: "0.10 63.38 22.86 0.18 3.77 9.71 100.00" | high |
| Texas, urban other roads, 2020 | single-unit 3.67%, combination 2.50% | % of VMT | [VM4] | Texas urban "OTHER" row: "0.29 67.37 25.86 0.31 3.67 2.50 100.00" | high |
| Derived MT share of trucks, urban arterials | 0.486 | - | derived from VM-4 | 3.70 / (3.70 + 3.91) | high (arithmetic) |
| Derived MT share of trucks, urban interstate | 0.280 | - | derived from VM-4 | 3.77 / (3.77 + 9.71) | high (arithmetic) |
| Derived MT share of trucks, urban other roads | 0.595 | - | derived from VM-4 | 3.67 / (3.67 + 2.50) | high (arithmetic) |

### Houston test road (TxDOT, BTS)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| N Durham Dr count station | 102U556 at 29.804378, -95.412293; AADT 2020 16,150; 2025 17,824 | veh/day | [TXA] query `geometry=-95.3989,29.8040&distance=1500` | `{'TRFC_STATN_ID': '102U556', 'ON_ROAD': 'N DURHAM DR', ... 'AADT_RPT_QTY': 17824, 'AADT_RPT_HIST_05_QTY': 16150 ...}` (field alias of HIST_05 is "AADT 2020") | high |
| Durham segment, 2020 inventory | AADT 16,150 (2020), trucks 4.4%: single-unit 436, combination 275; 35 mph; 4 lanes; 42 ft surface; F_SYSTEM 3 | - | [TXRI] query near the station | `'STE_NAM': 'DURHAM ', ... 'SPD_MAX': 35, 'NUM_LANES': 4, 'SUR_W': 42, 'TRF_STA_ID': '102U556', 'ADT_YEAR': 2020, 'ADT_CUR': 16150, ... 'TRK_AADT_PCT': 4.4, 'PCT_SADT': 2.7, 'PCT_CADT': 1.7, 'AADT_TRUCKS': 711, 'AADT_SINGLE_UNIT': 436, 'AADT_COMBINATION': 275, 'HPMSID': '10847'` | high |
| Shepherd Dr (parallel, about 125 m east) | AADT 21,492 (2019), single-unit 1,023, combination 201, 35 mph | - | [TXRI] | `'STE_NAM': 'SHEPHERD N ', ... 'ADT_YEAR': 2019, 'ADT_CUR': 21492 ...` | high |
| Yale St (demo unit street) | AADT 21,301 (2016), single-unit 383, combination 298, 30 mph | - | [TXRI] | `YALE ST LS0000 KG 4 2016 21301 30 383 298` (our printout of STE_NAM, HWY, RDBD_ID, F_SYSTEM, ADT_YEAR, ADT_CUR, SPD_MAX, AADT_SINGLE_UNIT, AADT_COMBINATION) | high (count is from 2016) |
| BTS road speeds when HPMS has none | urban principal arterial 21 mph, minor arterial 20, major collector 29 | mph | [BTS20] Table 5-1 | "Principal Arterial - Other Urban 21 Minor Arterial Urban 20 Major Collector Urban 29" | high |
| BTS uses HPMS speed if valid | 20 to 80 mph | mph | [BTS20] p. 3 | "When valid speed information is included in the HPMS data, it is used in the road noise modeling." | high |
| BTS reference point | 50 ft from the road, perpendicular through the segment midpoint | - | [BTS20] footnote 8 | "The source reference location is a point that is 50 feet from the road along a perpendicular line that intersects the midpoint of the road segment." | high |
| BTS vehicle classes | autos, medium trucks, heavy trucks | - | [BTS20] p. 4 | "Automobiles Medium trucks Heavy trucks" | high |
| BTS 2020 road, pixel 20 m from Durham | 62.6 | dBA LAeq,24h | [ESRI] `/tile/9/316/314?sliceId=3`, pixel row 61, col 172 (centre 29.796425, -95.411422) | decoded tile value | high |
| BTS 2020 road, pixel 10 m from Durham (other side of the line) | 51.3 | dBA LAeq,24h | [ESRI] same tile, row 61, col 171 | decoded tile value | high |
| BTS 2020 road, pixel 40 m from Durham | 45.0 (floor, so at most 45) | dBA LAeq,24h | [ESRI] same tile, row 61, col 170 | decoded tile value | high |
| BTS 2020 road, demo unit pixel (29.8058666, -95.3993738) | 52.3 (next pixel east, across the road line: 55.7) | dBA LAeq,24h | [ESRI] same tile, row 26 | decoded tile value | high |

## Equations

### E1. Hourly Leq of one vehicle class (RD-77-108 eq. 1 with eq. 8)

```
Leq(h)_i = L0_i(S_i) + 10*log10(N_i * D0 / S_i) - 25
         + 10*log10((D0 / D)^(1 + alpha))
         + 10*log10(Psi_alpha(phi1, phi2) / pi)
         + Delta_s
```

Variables:
- `i`: class, one of A (cars and light trucks), MT, HT.
- `L0_i(S)`: reference energy mean emission level at 15 m, dBA (E3).
- `N_i`: vehicles of class i per hour (veh/h).
- `S_i`: average speed of class i (km/h).
- `D0` = 15 m. `D`: perpendicular distance from the receiver to the lane centreline, or to
  the extended segment line (m). Valid for `D >= 15` (E6).
- `alpha`: 0 for a hard site (pavement, water), 1/2 for a soft site (grass, yards).
- `phi1 < phi2`: angles to the two ends of the segment, from the perpendicular, in
  radians, left negative.
- `Psi_0 = phi2 - phi1`. `Psi_1/2 = integral from phi1 to phi2 of sqrt(cos phi) dphi` (E5).
- `Delta_s`: shielding (barriers, rows of houses, woods), negative dB. Comes from R2,
  not from this file.
- `-25` = `10*log10(pi) - 10*log10(1000)`, the unit fix for N per hour, S in km/h, D0 in m.

### E2. Total over classes and over segments

```
Leq(h) = 10*log10( sum over i and segments of 10^(Leq(h)_i,seg / 10) )
```

### E3. Emission levels

RD-77-108 (1975 data, S in km/h):

```
L0_A  = 38.1*log10(S) - 2.4
L0_MT = 33.9*log10(S) + 16.4
L0_HT = 24.6*log10(S) + 38.5
```

TNM (1994-95 data, cruise throttle, average pavement, s in km/h):

```
L0_i = 10*log10( (0.6214*s)^(A_i/10) * 10^(B_i/10) + 10^(C_i/10) )
A:  A = 41.740807  B =  1.148546  C = 50.128316
MT: A = 33.918713  B = 20.591046  C = 68.002978
HT: A = 35.879850  B = 21.019665  C = 74.298135
```

Check against FHWA-PD-96-008 Table 37 at 88.5 km/h: the TNM form gives 73.81, 79.91,
83.96 (table: 73.81, 79.91, 83.96) and the RD-77-108 form gives 71.78, 82.40, 86.39
(table, 1975 STAMINA: 71.74, 82.37, 86.30). So the 1977 equations are the 1975 data.

Per-class difference, TNM minus RD-77-108, in dB (computed from the two forms above):

| km/h | 30 | 40 | 50 | 56.3 (35 mph) | 64.4 (40 mph) | 80 | 88.5 | 104.6 | 112.7 |
|---|---|---|---|---|---|---|---|---|---|
| cars | +1.7 | +1.2 | +1.3 | +1.4 | +1.6 | +1.9 | +2.0 | +2.3 | +2.4 |
| medium trucks | +2.9 | +0.3 | -1.1 | -1.6 | -2.0 | -2.4 | -2.5 | -2.6 | -2.6 |
| heavy trucks | +0.1 | -1.9 | -2.9 | -3.1 | -3.1 | -2.7 | -2.4 | -1.8 | -1.5 |

### E4. 24-hour Leq from AADT (RD-77-108 App. F)

```
Leq(24)_i = L0_i(S_i) + 10*log10(AADT_i * D0 / S_i) - 38.8
          + 10*log10((D0 / D)^(1 + alpha)) + 10*log10(Psi_alpha / pi) + Delta_s
```

`-38.8 = 10*log10(pi) - 30 - 10*log10(24)`. Same as E1 with `N_i = AADT_i / 24`. For a
time block of `h` hours with `n_i` vehicles in it, use `N_i = n_i / h` in E1.

TNM's own flow term is `10*log10(V_i / S_i) - 13.2` with `D` and angle handled as
`10*log10(15/d) + 10*log10(alpha_deg/180)` [TM eqs. 16, 18]. That is identical to the hard
site of E1: `10*log10(15) - 25 = -13.24`.

### E5. Segment adjustment

```
hard:  F = 10*log10( (phi2 - phi1) / pi )
soft:  F = 10*log10( (1/pi) * integral_phi1^phi2 sqrt(cos phi) dphi )
```

Integrate numerically (midpoint rule, 400 steps is plenty). Values from this integral,
checked against RD-77-108 Problem 5(b), which reads them off Figure 7:

| segment (deg) | hard, computed | soft, computed | soft, RD-77-108 Problem 5 |
|---|---|---|---|
| -90 to +90 | 0.00 | -1.18 | -1.2 (text) |
| -90 to -57 | -7.37 | -10.38 | -10.5 |
| -57 to -22 | -7.11 | -7.72 | -7.5 |
| -22 to +55 | -3.69 | -3.96 | -4.0 |
| +55 to +90 | -7.11 | -10.00 | -10 |
| -45 to +45 | -3.01 | -3.24 | - |
| 0 to +90 | -3.01 | -4.19 | - |

The four Problem 5 segments energy-sum back to 0.0 dB (hard) and -1.18 dB (soft), so a
segment-by-segment sum is exact for a straight road.

### E6. Polyline road (answer to question 4)

For each straight piece from point a to point b (projected metres, e.g. Albers WKID
102039 as in R1):

```
u      = (b - a) / |b - a|                  unit vector along the piece
t_a    = (a - r) . u ,  t_b = (b - r) . u    along-line position of the ends, from the
                                             foot of the perpendicular from receiver r
D      = | (a - r) x u |                     perpendicular distance to the extended line
phi_a  = atan2(t_a, D),  phi_b = atan2(t_b, D);  phi1 = min, phi2 = max
```

Then E1 or E4 per piece and class, and E2 over everything. Rules:
- Each piece uses its own `D` (to its extended line), not the distance to the nearest point.
  This is how RD-77-108 Figure 5 defines the angles.
- Curves: split until every piece subtends at most 10 degrees at the receiver (TNM App. C.1).
- Validity: the point-source to line-source integration needs `D >= 15 m` (RD-77-108
  App. A). For a piece the receiver sits on the extension of (D near 0), TNM uses a
  separate formula when d < 0.3 m and the angle is under 20 degrees. With E6 the
  product of the distance and angle terms stays finite, so floor D at a small value
  (we used 0.5 m) to avoid a divide by zero.
- A facade closer than 15 m to a lane centre is outside the model. **Proposal
  (`placeholder`, not a sourced rule): clamp D to 15 m** and flag it. RD-77-108 section 6
  gives an equation for D < 15 m but says its accuracy "has not been established".
- Lanes: use the road centreline per direction, or the equivalent lane distance
  `D_E = sqrt(D_near * D_far)` (RD-77-108 eq. 20). Not valid within 15 m of the near lane.

### Worked example 1: the plan's sample hour on Yale St (question 1)

Input from `sources.json` (plan section 1.2): 1400 veh/h, truck share 0.04, 50 km/h,
wall 15 m from the lane, sees the whole road (phi -90 to +90). Split the 56 trucks with
the Texas urban arterial share 0.486: MT = 27, HT = 29, A = 1344.

| term | A | MT | HT |
|---|---|---|---|
| L0 (RD-77-108, 50 km/h) | 62.33 | 74.00 | 80.29 |
| 10 log10(N x 15 / 50) | 26.06 | 9.08 | 9.40 |
| constant | -25 | -25 | -25 |
| distance, D = 15 m | 0 | 0 | 0 |
| segment, soft, -90 to +90 | -1.18 | -1.18 | -1.18 |
| Leq(h)_i, soft | 62.21 | 56.90 | 63.51 |

Total soft: `10*log10(10^6.221 + 10^5.690 + 10^6.351) = 66.4 dBA`.
Hard site (no -1.18, alpha = 0): 67.6 dBA. With the TNM REMELs (63.64, 72.91, 77.44)
and soft propagation: 65.8 dBA. Note that the 2.0% heavy trucks give more energy than
the 96% cars.

### Worked example 2: N Durham Dr, 24 hours (question 5)

AADT 16,150: MT 436, HT 275, A 15,439. S = 35 mph = 56.33 km/h. Receiver 20.1 m from
the centreline, soft, infinite road.

| term | A | MT | HT |
|---|---|---|---|
| L0 (RD-77-108) | 64.30 | 75.75 | 81.57 |
| 10 log10(AADT x 15 / 56.33) | 36.14 | 20.65 | 18.65 |
| constant | -38.8 | -38.8 | -38.8 |
| distance, 15 log10(15/20.1) | -1.91 | -1.91 | -1.91 |
| segment, soft | -1.18 | -1.18 | -1.18 |
| Leq(24)_i | 58.55 | 54.51 | 58.33 |

Total 62.3 dBA. The full polyline sum over the real Durham geometry also gives 62.3.
The TNM REMELs give 61.8.

### E7. Truck split when only a share is known (question 3)

```
trucks = AADT * truck_share
MT     = trucks * m          HT = trucks * (1 - m)          A = AADT - trucks
m      = 0.486 urban arterials, 0.280 urban interstate, 0.595 urban other roads (Texas 2020)
```

Prefer, in order: (1) the segment's own `AADT_SINGLE_UNIT` and `AADT_COMBINATION` from
the TxDOT Roadway Inventory; (2) `m` from VM-4 above; (3) nothing else was found. The
single-unit group includes buses (class 4) and 3+ axle single-unit trucks (classes 6
and 7), which TNM counts as buses and heavy trucks. So `MT = single-unit` slightly
overstates medium trucks and understates heavy trucks. No Houston class 5 versus 6-7
split was found.

### E8. BTS comparison method (question 5)

1. TxDOT station 102U556 on N Durham Dr; 2020 Roadway Inventory segment with the same
   station ID gives AADT, single-unit and combination AADT, speed limit and geometry.
2. All 2020 inventory roads with F_SYSTEM 1 to 5 within 2.5 km (the classes BTS lists)
   were also summed, as a second variant. Interstates: only the `KG` roadbed (two-way
   AADT), plus frontage roads.
3. Road lines and BTS pixel centres were put in Albers WKID 102039 (R1 E1). For each
   pixel E4 + E6 was evaluated with RD-77-108 REMELs, soft, and with the variants in the
   table below.
4. BTS 2020 road slice read from the Esri tiles (R1 E1).

Box west of Durham, 29.7920 to 29.8000 N, -95.4140 to -95.4112 E (away from Shepherd),
all pixels, binned by distance from the TxDOT Durham centreline. BTS at the 45 floor
means "45 or less", so differences in those rows are upper bounds.

| distance (m) | pixels | BTS mean | BTS at floor | FHWA, Durham only, 35 mph | FHWA, all roads, 35 mph | median BTS - FHWA (Durham, 35 mph) | FHWA, Durham only, 21 mph | median BTS - FHWA (21 mph) |
|---|---|---|---|---|---|---|---|---|
| 15-25 | 24 | 58.3 | 0% | 62.8 | 63.4 | -0.5 | 58.2 | +4.2 |
| 25-45 | 36 | 50.4 | 58% | 58.3 | 59.8 | -12.3 | 53.7 | -7.6 |
| 45-75 | 54 | 47.5 | 57% | 55.4 | 58.0 | -8.8 | 50.8 | -4.2 |
| 75-105 | 30 | 45.0 | 100% | 52.3 | 55.9 | -7.0 or less | 47.7 | -2.4 or less |
| 105-165 | 60 | 45.0 | 100% | 49.8 | 54.8 | -4.9 or less | 45.2 | -0.2 or less |

Single pixels (same row, tile 9/316/314, row 61):

| pixel centre | distance to Durham | BTS | FHWA 77 soft | FHWA 77 hard | TNM REMEL soft | BTS - FHWA 77 soft |
|---|---|---|---|---|---|---|
| 29.796425, -95.411422 | 20.1 m east | 62.6 | 62.3 | 64.1 | 61.8 | **+0.4** |
| 29.796427, -95.411732 | 9.9 m west | 51.3 | 66.9 (D < 15, invalid) | 67.1 | 66.4 | -15.6 |
| 29.796428, -95.412043 | 39.9 m west | 45.0 (floor) | 57.8 | 61.1 | 57.4 | **-12.8 or less** |

Demo unit, Yale St (29.8058666, -95.3993738): BTS pixel 52.3, the pixel east of it
55.7, everything 60 m or more away 45.0. FHWA E4 at D = 15 m, Yale 2016 count (21,301,
single-unit 383, combination 298, 30 mph), soft, infinite road: 63.3 dBA (TNM REMELs:
63.0; hard: 64.5). BTS minus FHWA is -8 to -11 dB at the facade.

Same pattern on I-10 (2020 AADT 180,855, 55 mph), BTS column at -95.415, going
north from the road pixel: 79.3, then 65.4, 59.4, 52.3, 48.5, 45.7 and 45.0 one to six
pixels (30 to 180 m) away.
RD-77-108 soft predicts about 64 dBA at 200 m for that traffic (our estimate, not run
through E6 with all ramps).

## Conflicts

1. **RD-77-108 or TNM emission levels.** Per class they differ by up to 3 dB (table in
   E3), in opposite directions for cars and trucks. On the two Houston examples the
   totals differ by -0.6 and -0.5 dB. **Take the TNM REMELs** with the RD-77-108
   propagation equations. Reasons: they are 20 years newer (cars got louder, trucks
   quieter, PD sec. 7.3), FHWA requires TNM for federal analyses (23 CFR 772.9), and BTS
   used TNM, so the check compares like with like. Caveat: TNM REMELs were measured over
   "generally absorptive" ground at 15 m, while RD-77-108 assumes no difference between
   hard and soft at 15 m. Mixing them adds maybe a few tenths of a dB; not quantified.
2. **Hard or soft site.** At 20 m the two differ by 1.8 dB, at 40 m by 3.3 dB, at 100 m
   by 5.3 dB (Durham). BTS assumed soft ground everywhere. For the check against BTS use
   soft. For the model, soft for yards and lawns, hard when the ground between road and
   wall is mostly pavement or water (RD-77-108 sec. 2(d)). Default soft; mark it
   `placeholder` until R2's ground type per wall exists.
3. **Speed.** TxDOT lists Durham at 35 mph. BTS uses the HPMS speed if valid, otherwise
   21 mph for an urban principal arterial. We could not see which BTS used. 35 to 21 mph
   lowers the FHWA level by 4.6 dB at Durham (fewer dB per car, but the cars stay longer
   in the flow term). With 21 mph BTS reads 4 to 5 dB above FHWA at the road pixels
   and 0 to 8 dB below it farther out. Take the posted speed for the model
   (TxDOT `SPD_MAX`); note that BTS may be using a lower default.
4. **BTS falls off far faster than a line source.** Next to Durham BTS drops 11 to 18 dB
   from the road pixel to the next one and sits at the 45 floor 40 to 75 m away. A line
   source drops 4.5 dB per doubling on soft ground. The same is seen on Shepherd, Yale
   and I-10. The BTS documentation does not explain it; its only hint is that the
   reference point is "50 feet from the road ... [at] the midpoint of the road segment".
   Our guess (`unsourced`): BTS computes each 30 m receptor from a narrow set of nearby
   segments or uses a point-source distance from the segment midpoint. Consequence for
   the model: **the simple form (BTS) will under-predict facades set back from arterials
   by about 5 to 13 dB, and the detailed form will read higher.** Show the difference in
   `checks.road_detailed_minus_bts_db` as planned and do not calibrate the detailed form
   to BTS. Real Houston streets also have houses between road and wall, which neither
   number includes (R2's building-row term handles that).
5. **TxDOT inventory values on local streets.** Many 2016 rows near the demo (W 18th to W
   24th St) carry identical truck values, 3.2% with 1.8 single-unit and 1.4 combination,
   which looks like a default, not a count. Yale St's 383 and 298 also come from a 2016
   count. Use them, mark them `placeholder` when `ADT_YEAR` is older than 2020, and prefer
   the 2025 annual station value from [TXA] where one exists (Durham: 17,824).
6. **Demo facade inside 15 m.** By TxDOT's linework the Yale St centreline is within about
   15 m of the demo building's street wall, so D clamps to 15 m there. The answer at the
   street wall depends on that clamp, which is our choice.

## Not found

- **The BTS 2020 inputs for Durham (HPMS speed, AADT, truck split actually used).** Not
  fetched. The 2020 HPMS shapefile for Texas would answer conflict 3. Fallback: report
  both 35 and 21 mph, as above.
- **Why BTS falls off so steeply** (conflict 4). No statement in the BTS documentation.
  Fallback: treat BTS as a lower bound away from the road line.
- **Whether Durham is one-way and its lane layout.** `DIR_TRAV` is empty in the
  inventory. Equivalent lane distance was not applied; the centreline was used.
  `unsourced`.
- **The full FHWA-PD-96-008 regression text.** The PDF is scanned without a text layer.
  Only Table 37 and sec. 7.3 were OCR'd and quoted. The coefficients come from the TNM 1.0
  Technical Manual, Table 5, and reproduce Table 37 exactly.
- **Whether TNM 2.5 (used by BTS) kept the TNM 1.0 constants.** Not checked. The TNM 3.0
  Technical Manual (https://rosap.ntl.bts.gov/view/dot/48763/dot_48763_DS1.pdf) was
  downloaded, but its text layer does not contain the constants table.
- **A Houston split of single-unit trucks into class 5 (MT) and classes 6 and 7 (HT).**
  Not found. Fallback: single-unit = MT (E7), which overstates MT a little.
- **Exact HPMS Field Manual wording for the AADT_SINGLE_UNIT item.** The FHWA field
  manual pages tried did not load; the definition is quoted from the Traffic Monitoring
  Guide 2022, which cites the manual.
- **TxDOT vehicle classification manual** (onlinemanuals.txdot.gov). The server refused
  connections. Not needed once TMG and VM-4 were found.
