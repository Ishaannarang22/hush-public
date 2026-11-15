# R6. Criteria and validation targets

Research for issue #7 (plan section 5, R6). US housing only. Every value below has a source URL
and a quote copied from that source, or it is marked `unsourced` or `derived` (our own arithmetic on
sourced numbers). Text in quotes is copied as published; PDF quotes came through text
extraction, so line breaks and some OCR spacing were cleaned up, but no words were changed.

## Answer

HUD's interior goal is a day-night average (DNL) of 45 dB inside, with bedrooms stressed. The
exterior bands, measured 2 m from the building facing the main source, are: Acceptable at 65 dB
or below, Normally Unacceptable above 65 up to 75 dB (5 dB extra attenuation needed for 65 to 70,
10 dB for 70 to 75), and Unacceptable above 75 dB. HUD and FAA guidance assume ordinary
construction gives about 20 dB of outdoor-to-indoor reduction. Measured US houses with windows
closed do better than that. Eighteen rooms in eight US buildings near the Louisville and
Baltimore airports measured 21.5 to 31.7 dB, with a median of about 25 dB. For bedrooms at night, WHO keeps the
1999 indoor values (30 dB LAeq and 45 dB LAmax) and sets outdoor night limits of 45 dB Lnight
for road, 44 for rail and 40 for aircraft (2018). No published simple model claims better than a
few dB: a Swiss field model explains about 62% of the variance, which leaves roughly 3 dB of
error, and two measurement methods on the same house differ by 2 to 5 dB. So we should state
plus or minus 5 dB, and say plus or minus 3 dB only where the facade is well known.

## Values

### Criteria

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| HUD interior goal | 45 | dB DNL (indoor) | https://www.law.cornell.edu/cfr/text/24/51.101 | "(9) Interior noise goals. It is a HUD goal that the interior auditory environment shall not exceed a day-night average sound level of 45 decibels. Attenuation measures to meet these interior goals shall be employed where feasible. Emphasis shall be given to noise sensitive interior spaces such as bedrooms. Minimum attenuation requirements are prescribed in § 51.104(a)." | high |
| HUD exterior: Acceptable | at or below 65 | dB DNL (exterior) | https://www.law.cornell.edu/cfr/text/24/51.103 | Table 1: "Acceptable" / "Not exceeding 65 dB(1)" / "None." Note (1): "Acceptable threshold may be shifted to 70 dB in special circumstances pursuant to § 51.105(a)." | high |
| HUD exterior: Normally Unacceptable | above 65 to 75 | dB DNL (exterior) | https://www.law.cornell.edu/cfr/text/24/51.103 | Table 1: "Normally Unacceptable" / "Above 65 dB but not exceeding 75 dB" / "Special Approvals (2)"; "Environmental Review (3)."; "Attenuation (4)." | high |
| HUD exterior: Unacceptable | above 75 | dB DNL (exterior) | https://www.law.cornell.edu/cfr/text/24/51.103 | Table 1: "Unacceptable" / "Above 75 dB" / Note (5): "Attenuation measures to be submitted to the Program Assistant Secretary or their designee for approval on a case-by-case basis." | high |
| HUD extra attenuation, 65 to 70 | 5 | dB (in addition to typical construction) | https://www.law.cornell.edu/cfr/text/24/51.104 | "require a minimum of 5 decibels additional sound attenuation for buildings having noise-sensitive uses if the day-night average sound level is greater than 65 decibels but does not exceed 70 decibels" | high |
| HUD extra attenuation, 70 to 75 | 10 | dB (in addition to typical construction) | https://www.law.cornell.edu/cfr/text/24/51.104 | "or a minimum of 10 decibels of additional sound attenuation if the day-night average sound level is greater than 70 decibels but does not exceed 75 decibels." | high |
| HUD meaning of "attenuation" | relative to typical local construction | n/a | https://www.law.cornell.edu/cfr/text/24/51.104 | "Noise attenuation measures are those required in addition to attenuation provided by buildings as commonly constructed in the area, and requiring open windows for ventilation." | high |
| HUD metric | DNL (Ldn) | dB | https://www.law.cornell.edu/cfr/text/24/51.103 | "Day-night average sound level, abbreviated as DNL and symbolized as Ldn, is the 24-hour average sound level, in decibels, obtained after addition of 10 decibels to sound levels in the night from 10 p.m. to 7 a.m." | high |
| HUD exterior measurement point | 2 m from building, toward main source | m | https://www.law.cornell.edu/cfr/text/24/51.103 | "The standards shall usually apply at a location 2 meters (6.5 feet) from the building housing noise sensitive activities in the direction of the predominant noise source." | high |
| HUD total attenuation, 65 to 70 | 25 | dB | HUD Noise Guidebook ch. 4, copy at https://housingnm.org/uploads/documents/Noise-Guidebook-Chapter-4.pdf | "if the exterior noise level is 65 Ldn to 70 Ldn, 25 db of noise attenuation must be provided; if the exterior noise level is between 70 and 75 Ldn, then 30 db of attenuation is required." | high (HUD text, copy hosted by a state agency) |
| HUD: standard construction at 65 gives 45 inside | 20 (implied) | dB | same as above | "If a barrier can reduce the exterior noise level to 65 Ldn, then standard construction techniques should be sufficient to insure an interior level of 45 Ldn or below." | high (the 20 dB is the implied difference) |
| EPA/FAA 20 dB assumption | 20 | dB NLR | https://www.faa.gov/sites/faa.gov/files/land_use_guidelines.pdf (Wyle for US Navy, 2005) | "have established an interior DNL goal of 45 dB. This is based on the assumption that when the exterior DNL is 65 dB, and a building provides 20 dB of outdoor-to-indoor noise level reduction (NLR), activity interference for most people is minimal" | high |
| FAA program eligibility | interior 45 or above, windows closed | dB DNL/CNEL | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5000-9B-Sound-Insulation-2022.pdf (AC 150/5000-9B, 2022, sec. 6.4.2.1) | "A noise-impacted structure must have interior noise levels that are DNL/CNEL 45 dB or greater with the windows closed to be considered non-compatible." | high |
| FAA treatment goal | below 45 indoors and at least 5 dB gain | dB | same, sec. 6.5.1.1 | "the primary goal of the SIP and treatment measures are to attain an average interior noise level below DNL/CNEL 45 dB and at least a 5 dB NLR" | high |
| FAA basis for 45 | sleep and conversation | n/a | same, footnote 40 | "45 dB is the interior noise level that will accommodate indoor conversations or sleep." | high |
| WHO 2018 road, night | 45 | dB Lnight (outdoor, most exposed facade) | https://iris.who.int/server/api/core/bitstreams/f53c45ba-11d3-4502-a424-c1cf49f5a053/content (WHO Environmental Noise Guidelines for the European Region, 2018, sec. 3.1) | "For night noise exposure, the GDG strongly recommends reducing noise levels produced by road traffic during night time below 45 dB Lnight, as road traffic noise above this level is associated with adverse effects on sleep." | high |
| WHO 2018 road, average | 53 | dB Lden | same, sec. 3.1 | "the GDG strongly recommends reducing noise levels produced by road traffic below 53 dB Lden, as road traffic noise above this level is associated with adverse health effects." | high |
| WHO 2018 rail, night | 44 | dB Lnight | same, sec. 3.2 | "the GDG strongly recommends reducing noise levels produced by railway traffic during night time below 44 dB Lnight" | high |
| WHO 2018 rail, average | 54 | dB Lden | same, sec. 3.2 | "the GDG strongly recommends reducing noise levels produced by railway traffic below 54 dB Lden" | high |
| WHO 2018 aircraft, night | 40 | dB Lnight | same, sec. 3.3 | "the GDG strongly recommends reducing noise levels produced by aircraft during night time below 40 dB Lnight" | high |
| WHO 2018 aircraft, average | 45 | dB Lden | same, sec. 3.3 | "the GDG strongly recommends reducing noise levels produced by aircraft below 45 dB Lden" | high |
| WHO 2018: 1999 indoor values still valid | n/a | n/a | same, introduction | "the GDG recommends that all CNG indoor guideline values and any values not covered by the current guidelines (such as industrial noise and shopping areas) should remain valid." | high |
| WHO bedroom, continuous noise | 30 | dB LAeq (indoor, night) | https://nonoise.org/library/whonoise/whonoise.htm (Berglund and Lindvall, eds., Community Noise, WHO archive document, 1995; same values in the 1999 Guidelines for Community Noise) | "recommended guideline values inside bedrooms are 30 dB LAeq for steady-state continuous noise" | medium (the official 1999 WHO PDF host returned 403; this is the WHO-commissioned source text) |
| WHO bedroom, single events | 45 | dB LAmax (indoor, night) | same | "for a noise event 45 dB LAmax" | medium |
| WHO outside bedroom, window open | 45 | dB LAeq (outdoor, night) | same | "should not exceed 45 dB LAeq, so that people may sleep with bedroom windows open." | medium |
| WHO Night Noise Guidelines target | 40 | dB Lnight,outside | https://www.who.int/europe/publications/i/item/9789289041737 (WHO Night Noise Guidelines for Europe, 2009) | "an Lnight, outside of 40 dB should be the target of the night noise guideline" | high |
| WHO NNG interim target | 55 | dB Lnight,outside | same | "Lnight,outside value of 55 dB is recommended as an interim target" | high |

### Typical outdoor-to-indoor reductions (published rules of thumb)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| EPA, warm climate, windows closed | 24 | dB | https://nonoise.org/library/levels/levels.htm (EPA 550/9-74-004 "Levels Document", 1974, Table II) | Table II rows: Warm climate 12 dB (open) / 24 dB (closed); Cold climate 17 / 27; national average 15 / 25. Text: "the sound level reduction of a building is largely determined by whether its windows are open or closed." | high (Houston is warm climate) |
| EPA, national average, windows closed | 25 | dB | same | as above | high |
| EPA, warm climate, windows open | 12 | dB | same | as above | high |
| FHWA, light frame, ordinary sash closed | 20 | dB | https://www.fhwa.dot.gov/environment/noise/regulations_and_guidance/analysis_and_abatement_guidance/revguidance.pdf (FHWA-HEP-10-025, Dec 2011, Table 6) | "Light Frame Ordinary Sash (closed) 20 dB / Storm Windows 25 dB / Masonry Single Glazed 25 dB / Double Glazed 35 dB" | high |
| FHWA, light frame, storm windows | 25 | dB | same | as above | high |
| FHWA, masonry, single glazed | 25 | dB | same | as above | high |
| FHWA, masonry, double glazed | 35 | dB | same | as above | high |
| FHWA, any building, windows open | 10 | dB | same | "All Open 10 dB" | high |
| FHWA field vs lab wall rating | about 4 lower in field | dB | https://www.fhwa.dot.gov/environMent/noise/noise_barriers/abatement/insulation/high08.cfm (Insulation of Buildings Against Highway Noise) | "the EWNR value for a wall built under field conditions will be, on the average, 4 dB lower than laboratory values." | high |
| Typical home, windows closed | 20 to 30 | dB NLR | https://www.faa.gov/sites/faa.gov/files/land_use_guidelines.pdf (sec. 2.4) | "might provide 20 to 30 dB of NLR when the windows and doors are kept closed if the home is in good condition. In contrast, an acoustically well insulated home can provide 30 to 35 dB of NLR." | high (written for military jet noise) |
| WHO rule of thumb, closed windows | about 25 | dB | WHO 2018 PDF (URL above), sec. 2 | "The differences between indoor and outdoor levels are usually estimated at around 10 dB for open, 15 dB for tilted or half-open and about 25 dB for closed windows." | high (European) |
| Swiss field study, closed windows | median 27.8, range 16.2 to 38.0 | dB(A) | https://pmc.ncbi.nlm.nih.gov/articles/PMC5800248/ (Locher et al. 2018, 102 homes, 157 rooms) | "27.8 ± 4.4 dB(A) for closed windows"; Table 2 range 16.2 to 38.0 dB(A) | high (not US; used only as a model-accuracy benchmark) |

### Real US measurement cases (windows closed)

All cases are A-weighted noise level reduction (NLR) = exterior level minus room-average interior
level, measured with the room's doors closed. The FAA loudspeaker tests (ASTM E966 / SAE ARP 6973)
apply an aircraft spectrum to the measured third-octave reductions. None of these reports give
absolute outdoor and indoor levels for the loudspeaker tests, because the loudspeaker level is
arbitrary. Only NLR matters for us: indoor = outdoor minus NLR.

| case | location | building | construction | windows | room | NLR (dB) | method | source URL | exact quote | confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Louisville, KY (next to SDF airport) | House #3, one storey, insulated attic | vinyl siding (wood frame implied, not stated) | prime + storm, closed and locked | LR | 26.9 | loudspeaker, outdoor to indoor | https://rosap.ntl.bts.gov/view/dot/68585/dot_68585_DS1.pdf (DOT/FAA/TC-23/42, Aug 2023, Table 6) | "Both houses were one-story buildings with insulated attic space. House #3 was constructed with vinyl siding on all exterior facades"; test conditions "All doors closed; prime and storm windows closed and locked." | high |
| C1 | same | same | same | same | BR1 | 25.3 | same | same | Table 6 row "BR1 25.3" | high |
| C1 | same | same | same | same | BR2 | 23.0 | same | same | Table 6 row "BR2 23.0" | high |
| C1 | same | same | same | same | DR/K (one facade, large window) | 22.2 | same | same | "The dining room had one exterior facade with a large window area."; row "DR/K 22.2" | high |
| C2 | Louisville, KY (next to SDF) | House #4, one storey, insulated attic | "wood-frame construction with brick veneer exterior", vinyl-sided dining addition | prime + storm, closed and locked | LR (one windowless facade) | 22.9 | same | same | "House #4 was a wood-frame construction with brick veneer exterior, having an add-on dining room of vinyl siding at the rear." | high |
| C2 | same | same | same | same | BR1 | 26.0 | same | same | Table 6 row "BR1 26.0" | high |
| C2 | same | same | same | same | BR2 | 24.8 | same | same | Table 6 row "BR2 24.8" | high |
| C2 | same | same | same (vinyl addition) | bay window | DR (three facades) | 22.3 | same | same | "The dining room had a bay window ... forming a combined kitchen/dining area with three exterior facades."; row "DR 22.3" | high |
| C3 | not stated | Parameter test house 2, one storey | "exterior vinyl siding facade" | not stated | Den, 15.5 x 11.5 x 8 ft | 24.9 | same | same (sec. 3.1.2, Table 5) | "a single-story house with an exterior vinyl siding facade" | medium (location and windows not stated) |
| C3 | same | same | same | two 2.5 x 4.3 ft windows | BR, 12 x 9.5 x 8 ft, two exterior walls | 23.8 | same | same | "a bedroom, 12 ft x 9½ ft x 8 ft, also with two exterior walls, each with a 2½-ft x 4⅓-ft window" | medium |
| C4 | not stated | Parameter test house 1: second-floor apartment in a two-storey building | not stated | one 3.5 x 3.75 ft window | Large room, 20 x 17 x 10 ft | 31.7 | same | same (sec. 3.1.1, Table 5) | "two rooms of an apartment on the second floor of a two-story building" | medium |
| C4 | same | same | not stated | not stated | Small room, 13.5 x 7.5 x 10 ft | 28.8 | same | same | Table 5 row "Small 10 28.8" | medium |
| C5 | Louisville, KY (east of SDF) | House 2: occupied, never sound-insulated, cape style with finished second floor | not stated | dormer windows, closed | Main bed (first floor) | 28.2 (aircraft); 26.5 (loudspeaker) | real aircraft departures, exterior mic 50 ft from house; room-centre mic | https://rosap.ntl.bts.gov/view/dot/57751/dot_57751_DS1.pdf (DOT/FAA/TC-18/15, Apr 2018, Tables 7 and 13) | "House 2 was an occupied house to the east of the airport that had not been insulated"; "Both were cape-style houses with finished second floors." | high |
| C5 | same | same | same | same | Bed 2 | 29.5 (aircraft); 24.7 (loudspeaker) | same | same | Table 13 row "Bed 2 29.5 24.7" | high |
| C6 | Louisville, KY (north of SDF) | House 1: insulated demo house, one sash of each double window raised to mimic an uninsulated house | not stated | double windows, one sash raised | Living | 28.5 (aircraft); 26.1 (loudspeaker) | aircraft arrivals and loudspeaker | same (Table 13) | "one sash of each window was raised so as to simulate a non-insulated condition." | low (not a real uninsulated state; the report flags its own Bed result as an anomaly) |
| C7 | Louisville, KY (next to SDF) | House #1, one storey, corner room (June 2018) | not stated | not stated | NE corner room | 21.7 | loudspeaker, corner method, 25 ft | https://rosap.ntl.bts.gov/view/dot/57801/dot_57801_DS1.pdf (DOT/FAA/TC-19/34, Sep 2019, Table 4) | "tests conducted on two houses adjacent to Louisville International Airport (SDF)"; Table 4 "Corner Mix 2 21.7" | medium (construction not given in the text I read) |
| C8 | Louisville, KY (next to SDF) | House #2, one storey, corner room | not stated | not stated | corner room | 21.5 | same | same (Table 4) | Table 4 "Corner Hard 2 21.5" | medium |
| C9 | Baltimore, MD (next to BWI) | House #3, two storey | not stated | north facade has the larger window | first-floor NW corner room | 28.4 | loudspeaker, corner method, 15 ft | same (Table 5) | "a two-story house adjacent to Baltimore Washington International Thurgood Marshall Airport (BWI)"; Table 5 "15 Corner Hard 2 28.4" | medium |
| C9 | same | same | same | same | second-floor NW corner room | 27.6 to 29.0 | loudspeaker, combined facades | same (sec. 5.2.2) | "results in the NLR 1-in. Scan Comb column in table 6 of 28.4, 27.6, and 29.0 dB for loudspeaker heights of 0.7, 10, and 30 ft" | medium |

Summary of the cases (`derived`): 18 rooms in 8 buildings, leaving out C6, which is not a true
baseline. The SDF houses in C1, C2, C7 and C8 come from different reports and years. The text does
not say whether any of them is the same building. Loudspeaker NLR spans 21.5 to 31.7 dB, with a
median of 24.9 dB (18 values; C5 uses its loudspeaker values, C9 uses 28.4 for both rooms). The
two best-described one-storey houses (C1 vinyl siding, C2 brick veneer, both with storm windows)
span 22.2 to 26.9 dB. The brick-veneer house is not quieter than the vinyl house room for room;
its rooms are limited by windows and the vinyl addition, not by the brick.

### Accuracy that published methods and models claim

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| FAA on modeled NLR | not accurate enough to decide eligibility | n/a | https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5000-9B-Sound-Insulation-2022.pdf (sec. 8.7.1.1) | "Modeling of individual rooms or homes can result in a fair level of fidelity, but it cannot take into consideration all factors that determine noise reduction such as vents, leaks, and the condition of windows, doors, etc. ... Accordingly, the modeled results are not sufficiently accurate to determine airport sound insulation program eligibility." | high |
| Loudspeaker vs real aircraft, same rooms | 2 to 5 or more | dB (loudspeaker lower) | https://rosap.ntl.bts.gov/view/dot/57801/dot_57801_DS1.pdf (sec. 6) | "the method leads to a lower NLR measurement (higher interior noise levels) than the aircraft flyover test by several decibels ... averaging from 2 dB at low values to 5 dB or more at the higher values." | high |
| Two loudspeaker methods, same rooms | within 1 | dB | https://rosap.ntl.bts.gov/view/dot/68585/dot_68585_DS1.pdf (abstract) | "The differences between the O-I and I-O measured values of noise reduction for the 10 rooms tested were all well within ±1 dB, the average difference being 0.1 dB." | high (repeatability floor, not model accuracy) |
| FAA target measurement precision | ±0.5 | dB at 95% confidence | AC 150/5000-9B (URL above), sec. 8 | "achieve a 95 percent confidence that the reported value of NLR is within ± 0.5 dB" | high |
| FHWA wall rating spread | ±0.6 to ±1.1 | dB (90% confidence) | https://www.fhwa.dot.gov/environMent/noise/noise_barriers/abatement/insulation/high08.cfm | Tables 22 and 23 list EWNR 90% confidence intervals of ±0.6 dB (across rating schemes) and ±0.9 to ±1.1 dB (across four highway spectra). | medium (rating spread from computed cases, not field error) |
| Swiss statistical model, closed windows | adjusted R² 0.62 | fraction | https://pmc.ncbi.nlm.nih.gov/articles/PMC5800248/ | closed-window model "explained variance of 62% (adjusted R2)", predictors: outdoor level, frame material, gaskets, number of windows | high (not US) |
| Swiss model residual error | about 2.7 | dB (1 sd) | derived: 4.4 × sqrt(1 − 0.62) | `derived` from the two values above; the paper gives no RMSE | medium |
| HUD/BTS outdoor input | no stated accuracy found | n/a | n/a | `unsourced` | n/a |

## Equations

### E1. Indoor DNL from outdoor DNL and a measured NLR

```
DNL_in = DNL_out - NLR
```

- `DNL_out`: exterior DNL at the facade, free-field (incident) level, dB.
- `NLR`: A-weighted outdoor-to-indoor noise level reduction, windows and doors closed, dB.
  NLR depends on spectrum but not on time of day, so the same NLR applies to day, night and DNL.
- `DNL_in`: room-average indoor DNL, dB. Compare with HUD 45.

Worked example: case C2 BR1 (brick veneer, storm windows) has NLR 26.0 dB. If the facade sees
DNL 65 dB, then DNL_in = 65 - 26.0 = 39.0 dB, which passes HUD 45. At DNL 72 dB, 72 - 26.0 = 46.0 dB,
which fails, and matches HUD's rule that 70 to 75 dB sites need about 30 dB.

### E2. Converting the plan's room formula to an NLR, so it can be checked against the cases

The plan (section 2.2) predicts `L_room = L_facade + 3 - R_facade + 10*log10(S/A)`. Therefore:

```
NLR_model = L_facade - L_room = R_facade - 3 - 10*log10(S/A)
```

- `R_facade`: composite sound reduction of the room's exterior surfaces, dB.
- `S`: exterior facade area of the room, m². `A`: absorption area, m² (Sabine).
- The FAA tests define the exterior level as the level incident on the facade, after removing the
  6 dB (1 in. scan) or 3.5 dB (60 in. scan) facade reflection (TC-19/34). That matches the plan's
  free-field `L_facade`, so NLR_model can be compared directly with the table.

Worked example (numbers from plan section 2.4; arithmetic `derived`): lab ratings only give 65 dB
outside and 33.8 dBA inside, so NLR_model = 31.2 dB. With 2% leaks, 42.8 dBA inside gives 22.2 dB.
The measured one-storey bedrooms (C1, C2, C3) are 23.0 to 26.0 dB. So lab ratings alone are about
5 to 8 dB too optimistic. The 2% leak case is about 1 to 4 dB too pessimistic for a house with
storm windows. Leak fractions should be tuned until a Houston-type 1990s bedroom gives NLR of
about 24 dB. That figure is the EPA warm-climate, windows-closed value, and it sits in the middle
of the measured US bedrooms.

### E3. Validation error

```
error_i = NLR_model_i - NLR_measured_i
mean_error = (1/n) * sum(error_i)
worst_error = max(|error_i|)
```

Run each case through the model with its room size, facade count and window area as close as the
source describes. Pass if `|error_i| <= 5 dB` for every case (plan T1) and the mean is within 3 dB
(plan Phase 3). Worked example with the E2 numbers: the 2% leak case scored against C2 BR1 gives
error = 22.2 - 26.0 = -3.8 dB, which passes the 5 dB test. Lab-only scored against the same room
gives 31.2 - 26.0 = +5.2 dB, which fails.

## Conflicts

1. **How much a typical house reduces noise: 20 dB (HUD, FAA, FHWA light frame) or 24 to 28 dB
   (EPA warm and national averages, WHO, measured US rooms)?** HUD's 20 dB is a conservative
   planning assumption, not a measurement. The US rooms measured with closed windows give 21.5 to
   31.7 dB, median 24.9. **We take:** calibrate to the measurements (target about 24 dB for a 1990s
   Houston bedroom, the EPA warm-climate value). Keep the HUD 45 test as the pass or fail line. Plan
   section 2.4 assumed "HUD assumes about 20 dB" and set its target to "about 45 dBA" at 65 dB
   outside. The measurements say a closed 1990s house at 65 dB outside should land near 39 to
   43 dBA. The R3 sanity band of 40 to 47 dBA still contains that, but its centre should move
   down.
2. **Loudspeaker NLR or real-aircraft NLR?** On the same rooms, real flyovers measure 2 to 5 dB
   higher (TC-19/34, and C5: 28.2 vs 26.5, 29.5 vs 24.7). The report puts this down to the house
   shielding its own facades and the changing angle of incidence. **We take:** the loudspeaker NLR
   for road and rail cases, because it measures sound landing directly on one facade, which is how
   our model treats a road. For aviation, expect real indoor levels 2 to 5 dB below what the
   loudspeaker cases suggest.
3. **The WHO bedroom 30 dB LAeq (indoor) and HUD 45 dB DNL (indoor) are different metrics.**
   WHO's value is an 8-hour night average inside the bedroom. HUD's is a 24-hour DNL with a 10 dB
   night penalty. **We take:** HUD 45 DNL for the pass or fail flag (the product spec requires it),
   and in the pitch show the WHO 30 dB night bedroom value as a secondary "sleep" line, compared
   against the model's `night_dba`.
4. **Where the outdoor level is measured.** HUD applies its bands "2 meters (6.5 feet) from the
   building". That point picks up some facade reflection. The BTS map and the FAA NLR exterior
   level are free-field or incident levels. **We take:** compare the BTS free-field value with the
   HUD bands directly, and note that this may read 0 to 3 dB below a true 2 m measurement. The
   0 to 3 dB figure is `unsourced` and comes from the plan's +3 convention. R3 owns the +3 term.
5. **Brick vs siding.** Wyle/FAA says "brick is a better sound insulator than siding". In C2, the
   brick-veneer house is not quieter than the vinyl house C1 (rooms 22.3 to 26.0 vs 22.2 to 26.9).
   This is consistent: windows and leaks set the result, not the wall. **We take:** the model
   should let window area, window type and leaks dominate. It must not give brick a large bonus.

## Not found

- **Absolute outdoor and indoor levels for real US houses under real traffic.** I found no US
  public report that gives both levels with construction and window type for single houses near a
  road. All nine cases are FAA airport-program tests near SDF and BWI, mostly with a loudspeaker.
  Fallback: validate on NLR (E1, E2), which our model can predict for any outdoor level. No Houston
  case was found.
- **Construction and window details for C4, C7, C8 and C9.** These are not stated in the text I read.
  The report figures (photos and plans) may show them. Fallback: use these as range checks
  (the model must land in 21 to 32 dB), not as exact tests.
- **Window type for C1 and C2.** The reports say "prime and storm windows". The glazing of the
  prime sash (single or double) is not given. Fallback: treat as single-pane prime plus storm,
  which TC-19/34 Table 10 rates at STC 32 for the window type "Single + storm".
- **An official WHO-hosted copy of the 1999 Guidelines for Community Noise** (iris.who.int
  returned 403). The 30 dB LAeq and 45 dB LAmax bedroom values are quoted from the WHO-commissioned
  1995 source document. WHO 2018 confirms they "remain valid".
- **A published accuracy figure (RMSE in dB) for a simple facade model on US houses.** Not found.
  Fallback: state plus or minus 5 dB by default. Use plus or minus 3 dB only when window area and
  type are known. Basis: the Swiss closed-window model leaves about 2.7 dB of error (`derived`),
  rooms in one house vary by up to 4.7 dB (C1: 22.2 to 26.9), and the FAA says models miss leaks and condition.
- **ACRP Report 105 contractor report and FAA "Aging Sound Insulation" report to Congress**, which
  may hold more before-and-after NLR data. Downloads were refused (connection reset, HTTP 403) and
  were not read. Fallback: none needed; the nine cases above meet the five-case requirement.
- **HUD Noise Guidebook full PDF from hud.gov** did not download. Chapter 4 was read from a copy
  hosted by the New Mexico housing agency (URL above).
