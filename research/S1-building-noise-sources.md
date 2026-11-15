# S1. Building noise sources and the partitions between units

Research for issue #37, task S1. Feeds section 5 (building sources) of
`docs/UNIT_PROFILE_PLAN.md` (branch `codex/unit-profile-plan`). US housing where
available. No model code. Every value has a URL and an exact quote, or is marked
`unsourced`.

## Answer

**Source levels.** Only two of the six spaces have a usable measured A-weighted level:

- **Gym, group classes with music:** 88.5 to 91.4 dBA mean (JAMA Otolaryngology 2026,
  one Los Angeles studio, 239 class observations). Weight drops measured about 98 to 103
  dB at the drop (UK, weighting not stated), which is an impact source that the airborne
  relation in section 5 does not cover (see S5).
- **Indoor pool:** LAeq 74 to 82 dBA with 32 to 72 people present (eight public pools,
  Toronto). No US apartment pool data was found; an apartment pool room is smaller and
  less used, so this is an upper bound.

The rest are a **design limit**, an **equipment rating** or nothing:

- **Elevator machine room:** a US federal design cap of 80 dBA at 3 ft from the equipment
  (MIL-HDBK-1191). That is a ceiling, not a typical level.
- **Elevator car:** about 55 dBA in a school-district specification, seen only through a
  search snippet (low).
- **Laundry:** commercial washer-extractors are rated under 70 to under 74 dBA
  (Wascomat spec sheet, distance not stated). No room level was found.
- **Corridor, mechanical room (boilers, pumps, chillers, AHUs), outdoor pool deck,
  treadmills:** no sourced A-weighted room level found. Equipment data exist as octave
  bands at 3 ft in a military design manual, but the tables are images that could not be
  read. These stay `placeholder`.

**Partitions.** The code floor is clear: IBC 1206 (as adopted in the 2025 California
Building Code) requires **STC 50 lab or NNIC 45 field** for walls and floor-ceilings
between units, and between units and public areas such as corridors; **IIC 50 lab or
NISR 45 field** for floor-ceilings. Entry doors are exempt from the airborne requirement.
Typical lab ratings by construction (all sourced below):

| Construction | STC | Notes |
|---|---|---|
| Single wood stud, 1 layer each side, no insulation | about 33 | interior partition, not a code party wall |
| Single wood stud + resilient channel one side, 1+1 layers, insulated | 48 | NRC CBD-239 |
| Staggered wood stud, 1+1, insulated | 50 | NRC; 2+2 gives 55 (CBD-239) or 60 on an 8 in plate (WoodWorks) |
| Double wood stud, 1+1, insulated | 57 | NRC; 2+2 gives 63 |
| Single 4 in steel stud, 1+1 layers 5/8 in, insulated | 47 | IR-761 via consultant summary |
| Double steel stud, 1+1, insulated | 55 | same |
| 8 in CMU, painted, 28 to 48 lb block | 45 to 52 | same; grout-filled 55 |
| Concrete slab 4 in / 6 in / 8 in | 47 to 49 / 53 / 58 | IIC bare 20 / 27 to 29 / 34 |
| Wood joist floor, gypsum direct, no topping | 37 to 43 | WoodWorks progression |
| Wood joist + gypsum concrete + resilient channel | 56 | WoodWorks; STC 50 needs both topping and channel |

Market practice sits above code: WoodWorks gives STC/IIC 50 "entry level", 55 "market
rate", 60 "luxury". NRC recommends an effective STC of at least 55 between dwellings.

**Field loss.** The code's own 50 (lab) versus 45 (field) encodes a 5-point field loss.
That is the sourced default for `derating` in section 5 for airborne building sources.
For bass-heavy sources (gym music, mechanical plant) the low-frequency weakness of stud
walls is larger; R4 found STC minus OITC of 7 to 9 on stud walls.

## Values

Confidence: high = primary source read directly; medium = primary source read through a
secondary report, or a consultant or trade document citing a primary test; low =
search-snippet only, or not US, or a rating rather than a room level.

### Source levels inside the spaces

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| gym.group_class.music.louder | 91.4 (95% CI 91.1 to 91.9) | dBA, class mean | https://medicaldialogues.in/amp/ent/news/lower-music-volume-in-fitness-classes-may-reduce-hearing-risk-without-affecting-exertion-jama-167371 (reporting JAMA Otolaryngol Head Neck Surg, 5 Mar 2026, doi 10.1001/jamaoto.2026.0028) | "The mean sound levels were 91.4 dBA (95% CI, 91.1-91.9 dBA) for louder classes (n = 122)" | medium (one LA commercial studio, not an apartment gym; JAMA page not read directly) |
| gym.group_class.music.quieter | 88.5 (95% CI 88.0 to 88.9) | dBA, class mean | same as above | "and 88.5 dBA (95% CI, 88.0-88.9 dBA) for quieter classes (n = 117)." | medium |
| gym.spin_class.music | about 95.7 to 101.0 (terciles) | dBC | https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33753680&resultType=core&format=json (Noise & Health 2021, "Music level preference and perceived exercise intensity in group spin classes", PMID 33753680) | "When mean sound levels exceeded 98.4 dBC, respondents were 23 times more likely to report the music as too loud" | medium (C-weighted, not dBA; Baltimore-area authors) |
| gym.weight_drop | 98.3 to 102.7 | dB (weighting not stated) | https://research.birmingham.ac.uk/portal/en/publications/insights-into-noise-and-vibration-stemming-from-the-gyms-heavy-lifting(9b9a5593-7a86-4edf-94d1-a07dc57e3f5a).html (Sport Sciences for Health, 2021) | "the average noise level for each drop weight only varies by a range of 4.4 dB between 102.7 and 98.3 dB." | low (UK university gym; impact event, not a room average) |
| pool.indoor.occupied | 74 to 82 LAeq; 102 to 122 peak | dBA | https://canadianaudiologist.ca/loudness-perception-and-sound-levels/ (Behar, Canadian Audiologist 7(5) 2020, reporting Lowry and Hon 2018) | "Measurements of LAEq ranged between 74 and 82 dBA, with maximum sound levels of 102 – 122 dBAPeak." | medium (public pools, Toronto; attendance "between 32 and 72") |
| elevator.machine_room.cap | 80 | dBA at 3 ft from equipment | https://ufgscriteria.tpub.com/1191/11910270.htm (MIL-HDBK-1191, 17.10.1) | "Noise level relating to the elevator equipment and its operation shall not exceed 80 dBa in the machine room," ... "measured three feet above the finished floor and three feet from the equipment." | medium (US federal design limit for medical facilities; a ceiling, not a typical level) |
| elevator.car | 55 or less | dBA | https://www.fcps.edu/sites/default/files/media/pdf/Division-14.pdf (Fairfax County Public Schools Division 14, traction elevators) | search-index text: "In Car Noise: ≤ 55 dB(A) (Otis: 55-60)" | low (not found in the text extracted from the PDF; a specification limit) |
| laundry.washer_extractor.rating | under 70 to under 74, by model size | dBA (distance not stated) | https://www.wash.com/wp-content/uploads/2021/03/Wascomat-WLD-Coin-Specs-071818.pdf (Wascomat WLD coin-op spec sheet) | "Noise level (dBA)<70 <70 <70<72<71<74" | low (machine rating, not a room level; several machines in a hard room will be higher) |
| corridor.level | not found | dBA | - | - | unsourced |
| mechanical_room.level (boilers, pumps, chillers, AHUs) | not found as dBA | dBA | https://pdhonline.com/courses/m505/m505content.pdf (Guyer, PDH M505, octave-band SPL at 3 ft for chillers, boilers, pumps, fans) | "Table 1 Sound pressure levels (in db at 3-ft. distance) for packaged chillers with reciprocating compressors" | unsourced as a value (tables are images and could not be read) |
| pool.outdoor_deck | not found | dBA | - | - | unsourced |
| gym.treadmill | not found | dBA | - | - | unsourced |

### Code minimums (IBC 1206)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| ibc1206.scope | walls and floor-ceilings between units, and between units and public areas | - | https://gocodebook.com/library/us/ca/ca-building-code/chapter-12-interior-environment/section-1206-sound-transmission (2025 California Building Code, based on IBC) | "common interior walls, partitions and floor/ceiling assemblies between adjacent dwelling units and sleeping units" ... "or between dwelling units and sleeping units and adjacent public areas" | medium (code text on a third-party code library; codes.iccsafe.org returned 403) |
| ibc1206.2.airborne.lab | 50 | STC (ASTM E90) | same as above | "not less than 50 where tested in accordance with ASTM E90." | medium |
| ibc1206.2.airborne.field | 45 | NNIC (ASTM E336) | same as above | "Normalized Noise Isolation Class (NNIC) rating of not less than 45 if field tested" | medium |
| ibc1206.2.entry_doors | exempt from penetration sealing requirement | - | same as above | "This requirement shall not apply to entrance doors." | medium |
| ibc1206.3.impact.lab | 50 | IIC (ASTM E492) | same as above | "not less than 50 where tested in accordance with ASTM E492." | medium |
| ibc1206.3.impact.field | 45 | NISR (ASTM E1007) | same as above (summary of the clause) | NISR "of not less than 45 if field tested" | medium |
| ibc1206.3.exception (CA amendment) | no IIC over garages, mechanical rooms, storage | - | same as above | "Impact sound insulation is not required for floor-ceiling assemblies over nonhabitable rooms" | medium (California amendment, not model IBC) |
| market.entry | 50 / 50 | STC / IIC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf (Thorburn, WoodWorks, "Acoustical Considerations for Mixed-Use Wood-Frame Buildings", 2014, Table 1) | "Entry level5050Market rate5555Luxury6060" (Table 1, STC and IIC columns; PDF text extraction) | medium |
| nrc.recommended_between_dwellings | 55 | effective STC | https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd239_e.html (Warnock, NRC CBD-239) | "the effective STC between dwelling units should be at least 55." | high (Canadian recommendation) |

### Walls between units (lab STC)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| wall.wood_single.interior | about 33 (+3 with insulation) | STC | https://web.mit.edu/parmstr/Public/NRCan/CanBldgDigests/cbd239_e.html | "has an STC rating of about 33" ... "increases its rating by about only 3 points." | high |
| wall.wood_single.rc_one_side | 48 [40]; 52 [44]; 56 [52] for 1+1, 1+2, 2+2 layers | STC, [no insulation] | same as above (Table 2) | "38 x 89 mm wood studs with resilient steel channels on one side" with "48 [40] 52 [44] 56 [52]" | high |
| wall.wood_staggered | 50 [41]; 53 [47]; 55 [52] | STC | same as above | "Staggered 38 x 89 mm wood studs" with "50 [41] 53 [47] 55 [52]" | high |
| wall.wood_double | 57 [46]; 60 [52]; 63 [57] | STC | same as above | "Double row of 38 x 89 mm wood studs with small gap" with "57 [46] 60 [52] 63 [57]" | high |
| wall.wood_staggered_8in_plate | 60 | STC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf | "a staggered 2x4 stud wall on an 8-inch nominal plate achieves a rating of STC 60 and with a wider double stud system the assembly achieves a rating of STC 63" | medium |
| wall.wood.misbuilt | 63 down to 48 | STC | same as above | "a wall that commonly separates luxury units could go from STC 63 to STC 48 and not even meet building code requirements." | medium |
| wall.steel_single.1+1 | 47 | STC | https://leeduser.buildinggreen.com/sites/default/files/credit_documentation/STC%20Introduction.pdf (consultant note, Aurora CO, 17 June 2009, "Based on NRC-IRC ... IRC-IR-761") | "4" steel studs with batt insulation STC 1-Layer 5/8" thick gypsum, both sides 47" | medium |
| wall.steel_single.2+2 | 56 | STC | same as above | "2-Layers 5/8" thick gypsum, both sides 56" | medium |
| wall.steel_single.rc.1+1 | 50 | STC | same as above | "1-Layer 5/8" gyp. attached w/ resilient channel*, 1-Layer 5/8" gyp. other side 50" | medium (Dietrich RC Deluxe only) |
| wall.steel_double.1+1 | 55 | STC | same as above | "Dual Stud ... 1-Layer 5/8" thick gypsum, both finish sides 55" | medium |
| wall.steel_double.2+2 | 65 | STC | same as above | "2-Layers 5/8" thick gypsum, both finish sides 65" | medium |
| wall.cmu8.painted | 45 / 49 / 52 for 28 / 34 / 48 lb block | STC | same as above | "8" CMU (28 lbs/block) 45 8" CMU (34 lbs/block) 49 8" CMU (48 lbs/block) 52" | medium |
| wall.cmu8.grouted | 55 | STC | same as above | "8" CMU (34 lbs/block), cells filled with grout 55" | medium |
| wall.cmu8.rc_gypsum_both | 56 | STC | same as above | "8" CMU (34 lbs/block), resilient channels* and 5/8" gypsum both sides 56" | medium |
| wall.cmu6.hollow | 45 to 46 | STC | https://www.structuremag.org/article/6-inch-cmu-masonrys-weight-loss-plan/ (Ledent, STRUCTURE, May 2022, citing NCMA TEK 13-01C) | "STC ratings for 6-inch walls comprising hollow units vary from 45 to 46" | medium |

### Floor-ceilings between units

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| floor.wood_joist.progression | 37, 43, 49, 56, 62 | STC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf (Figure 9) | "STC 49 Gypsum concreteTongue and groove wood structural panelGypsum boardJoistBatt insulation STC 43Tongue and groove wood structural panelGypsum boardJoistBatt insulation" (figure labels, PDF extraction) | medium |
| floor.wood_joist.stc50_needs | topping and resilient ceiling | - | same as above | "To achieve a rating of STC 50, both topping with additional mass (such as gypcrete) and a resilient system on the bottom of the joist are required." | medium |
| floor.wood_joist.direct_gypsum | 38 STC / 32 IIC | STC / IIC | https://www.usg.com/content/dam/USG_Marketing_Communications/united_states/product_promotional_materials/finished_assets/drywall-wood-framed-systems-SA924.pdf (see R4) | "38 32 Based on 1-1/4 nom wd flr-CK-6412-7" | high (from R4) |
| floor.wood_joist.IIC_by_finish | 38 to 73 | IIC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf (Figure 12) | "Bare floor ... Tile Thin carpet Heavy carpet Cushion backedvinyl Floating wood floor ... IIC 73IIC 64IIC 56IIC 43IIC 38IIC 38" | low (figure labels; finish-to-value pairing not recoverable from text; see S5) |
| floor.concrete.4/6/8in | STC 47/53/58, IIC 20/27/34 bare | STC / IIC | https://commercial-acoustics.com/iic-rating-calculator/ (search-index text of a vendor table) | "Concrete Slab Solid cast-in-place 4″STC 47IIC 20 6″STC 53IIC 27 8″STC 58IIC 34" | low (vendor table) |
| floor.concrete.4in / 6in | 49 / 53 | STC | https://nonoise.org/epa%20index/roll21/roll21doc10.pdf (DuPree 1980, see R4) | "4" thick flat concrete panel, 54 psf ... 49"; "6" thick flat concrete panel, 75 psf ... 53" | medium (from R4) |
| floor.concrete.6in.bare_IIC | 29 | IIC | https://www.floorexpert.com/knowledge-base/acoustical-data (AHF Products; cites Intertek ASTM E90/E492/E2179 report, Dec 2015) | "6″ Thick Concrete Slab Floor (150 lbs/cu ft)" with "None (bare)" and "29" | medium |
| floor.concrete.6in.carpet_IIC | 55 or more | IIC | same as above | "Equal to or greater than 55" (carpet, directly applied) | medium |
| floor.post_tensioned | not found separately | STC / IIC | - | - | unsourced (treat as solid slab of the same thickness) |

## Equations

### E1. Building source into a room (plan section 5)

```
L_room = L_source_space - (R - derating) + 10*log10(S_partition / A_room)
A_room = 0.161 * V / T          (R4, T = 0.5 s)
```

- `R`: lab STC of the partition (tables above). `derating`: 5, from the IBC lab 50 versus
  field 45 (sourced); R4's 8 for stud walls against low-frequency sources is the
  alternative for bass-heavy sources.
- STC is a single number tuned to speech. Using it as a broadband dBA reduction for music
  or plant noise is an approximation; the eight-band solver should use band data where
  it exists.

**Worked example 1: gym beside a bedroom.** Quieter group class, `L_source` = 88.5 dBA.
Code-minimum staggered wood stud wall, STC 50, derating 5, so effective 45. Shared wall
4.0 m by 2.4 m, S = 9.6 m2. Bedroom from R4: V = 33.6 m3, A = 10.82 m2.
10*log10(9.6/10.82) = -0.52. L_room = 88.5 - 45 - 0.52 = **43.0 dBA** during the class.
With a double wood stud wall 2+2 (STC 63): 88.5 - 58 - 0.52 = 30.0 dBA.

**Worked example 2: elevator machine room beside a bedroom.** `L_source` = 80 dBA (the
MIL-HDBK-1191 cap, so an upper bound). 8 in CMU, 34 lb block, painted, STC 49, derating
5. Same wall and room. L_room = 80 - 44 - 0.52 = **35.5 dBA** while the machine runs.

### E2. Several sources in one space

Sum energies, not decibels: `L = 10*log10( sum 10^(L_i/10) )`. Example: two washers each
rated 72 dBA at the same point give 10*log10(2 * 10^7.2) = 75.0 dBA, before any room
build-up.

## Conflicts

1. **Staggered stud 2+2: STC 55 (NRC CBD-239) or STC 60 (WoodWorks, 8 in plate).** Both
   are credible; the NRC figure is a lab table, WoodWorks a design paper with a wider
   plate. **Take NRC's 55** as the default for "staggered stud" and note 60 as achievable.
2. **Field loss: 5 (IBC 50/45) or 8 (R4, STC minus OITC on stud walls).** These answer
   different questions: 5 is lab-to-field for speech; 8 is low-frequency weakness.
   **Take 5 for corridor, laundry and elevator car; 8 for gym music and mechanical plant**,
   and label which was used.
3. **6 in slab bare IIC: 27 (vendor table) or 29 (AHF, Intertek report).** **Take 29**,
   which cites a lab report.
4. **Gym levels: class music (88.5 to 91.4 dBA) versus open gym use.** No open-floor
   (treadmills, free weights, no class) level was found. The class values are the loud
   case and should be tied to class hours, not all opening hours.
5. **Machine-room 80 dBA is a cap.** Treat it as an upper bound. Hydraulic and
   machine-room-less traction units in low-rise apartments are probably quieter, but no
   number was found.

## Not found

- **Corridor level (footsteps, doors, voices).** Fallback: `placeholder`, and route
  corridor noise through the entry door (door rating from R4), since IBC 1206 exempts
  entry doors and the door is the weak element.
- **Mechanical room level as dBA (boilers, pumps, chillers, AHUs).** The octave-band
  tables at 3 ft (PDH M505, from US Army TM data) are images. Fallback: `placeholder`; a
  person can read those tables, or use manufacturer sound data for the actual plant.
- **Laundry room level.** Only machine ratings. Fallback: energy-sum the rated machines
  (E2) and mark `derived`.
- **Elevator hoistway and lobby levels; hydraulic machine rooms.** Fallback: in-car 55
  dBA (low) and the 80 dBA cap as an upper bound.
- **Outdoor pool deck.** Fallback: treat as an outdoor source through the facade, not a
  building source; level `placeholder`.
- **Apartment gym (not a commercial studio) and treadmill levels.** Fallback: the JAMA
  class means, limited to class hours.
- **Post-tensioned slab ratings.** Fallback: a solid slab of the same thickness.
- **NRC IR-761 and NCMA TEK 13-01 read directly.** Values above come through a
  consultant summary and STRUCTURE magazine. Fallback: keep medium confidence.
- **ICC's own IBC text.** codes.iccsafe.org returned 403; the California adoption on a
  third-party code library was used.
