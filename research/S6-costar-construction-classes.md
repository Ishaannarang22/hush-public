# S6. What a CoStar construction class implies for outside walls and walls between units

Research for issue #37, task S6. Feeds the two `inferred` wall fields in section 3 of
`docs/UNIT_PROFILE_PLAN.md` (branch `codex/unit-profile-plan`): "Outside wall material"
and "Walls and floors between units". Scope: Houston and Los Angeles apartments, by era.
US housing only. No model code. Every value has a URL and an exact quote, or is marked
`unsourced`. Repo rule kept: a building-level class gives a **default with a stated
confidence**, never a per-wall record.

## Answer

**CoStar's class describes the structure, not the cladding or the partitions.** The sponsor
export codes it as `0 Unknown, 1 Masonry, 2 Metal, 3 ReinforcedConcrete, 4 Steel,
5 WoodFrame, 6 Brownstone, 7 Limestone` (`docs/SPONSOR-DATA-INVENTORY.md`). CoStar's own
definition of the field could not be read (costar.com returns HTTP 403 to automated
clients and the glossary in the search index has no entry for it). So every mapping below
is an inference, labelled `inferred`.

**What the class implies, by the evidence found:**

- **Number of storeys matters more than the class.** Under the IBC, wood can carry up to
  five storeys over a concrete podium (Type III-A) or four (Type V-A); taller buildings are
  concrete or steel (Type I). A 3-storey "Masonry" apartment is therefore almost always a
  wood-frame garden building with brick on the outside. Volterra (2014, 3 storeys,
  "Masonry") and Park Falls (1984, 3 storeys, "Masonry") are this case.
- **Outside wall default:** Masonry, 4 storeys or fewer -> brick veneer on wood studs (R3
  OITC 40). WoodFrame in Los Angeles -> cement stucco (R3 OITC 29); WoodFrame in Houston ->
  no single default was sourced (brick, siding and fibre cement all occur), so keep the era
  default. ReinforcedConcrete and Steel -> no sourced cladding default; keep the era default,
  because the facade is usually glazing or panels whose rating the class does not tell.
  Metal -> rare for apartments; era default. This matters little: R3 and the plan both say
  the wall rating moves the room level under 0.5 dB when the wall has a window.
- **Walls between units, by code era.** The required minimum between dwelling units is
  STC 50 lab (45 field) and IIC 50 lab (45 field) for floors. It applies:
  - **Los Angeles:** to multifamily units permitted after August 1974 (California Noise
    Insulation Standards, Title 25 section 1092), carried forward in today's CBC 1206.
  - **Houston:** confirmed in force from the Houston amendments to the 2006 IBC (effective
    31 Dec 2010), which keep IBC 1207 unchanged. Houston's code before that could not be
    read, so the year the requirement started there is **not found**.
  - Before those dates, no requirement applied. The 1963 FHA/HUD guide suggested STC 50
    (entry), 55 (market) and 60 (luxury), as advice.
- **Typical party walls by class** (lab STC):
  - wood single stud, one layer each side: STC 34 to 38 (pre-code typical);
  - single stud with resilient channel: about STC 45 to 50;
  - staggered stud: STC 56 to 60; double stud: STC 63;
  - 8 in hollow concrete block: STC 48;
  - concrete floors: STC 49 (4 in) and 53 (6 in).
- **Floors between units, wood frame:** STC 37 bare joists, 43 with insulation, 49 with
  gypsum concrete topping, 56 with a resilient ceiling as well, 62 for the best system.
  Lab ratings overstate field results through flanking (see S5 and R4).

**Recommended defaults** (rule R1 below): pre-code wood frame STC 36 walls and STC 38
floors; post-code wood frame STC 50 walls and STC 50 floors (the code minimum, `inferred`);
concrete STC 53 floors; masonry block STC 48 walls. Show them as `inferred` with a plus or
minus 5 STC spread, and list them under "worth checking".

## Values

Confidence: high = primary code text or manufacturer/industry test read directly;
medium = industry paper or primary source seen only through a search snippet; low =
secondary or inference.

### The CoStar field

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| costar.enum | 0 Unknown, 1 Masonry, 2 Metal, 3 ReinforcedConcrete, 4 Steel, 5 WoodFrame, 6 Brownstone, 7 Limestone | code | repo `docs/SPONSOR-DATA-INVENTORY.md` (from the sponsor export) | "The material enum is 0 Unknown, 1 Masonry, 2 Metal, 3 ReinforcedConcrete, 4 Steel, 5 WoodFrame, 6 Brownstone, 7 Limestone." | high (for the codes; meaning not defined by CoStar in any page found) |
| costar.coverage | 2,464 of 3,339 nonzero | properties | same file | "Across 3,339 commercial properties, **2,464 have a nonzero construction-material classification**" | high |
| costar.meaning | building-level only | - | same file | "Masonry is building-level context: it does not mean every interior partition is masonry." | high (repo rule) |
| costar.examples | Volterra 2014, 3 storeys, Masonry; Park Falls 1984, 3, Masonry; Terra 1983, 3, WoodFrame; Caldwell 2019, 4, WoodFrame | - | same file | "Volterra at West Lake \| 2014 \| 3 \| Masonry" | high |
| costar.definition | not readable | - | https://www.costar.com/about/costar-glossary | (HTTP 403 to automated fetch; the search-indexed glossary has no construction-material entry) | unsourced |

### Construction type and height

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| ibc.podium.type | podium must be Type I-A | - | https://www.woodworks.org/resources/code-path-and-requirements-for-podium-projects/ | "the podium must be of Type I-A construction." | medium (WoodWorks summary of IBC 510.2) |
| ibc.podium.wood_storeys.III | 5 | storeys | same as above | "a Type III-A or III-B building can include five stories of wood framing" | medium |
| ibc.podium.wood_storeys.V | 4 | storeys | same as above | "Type V-A can include four stories of wood framing." | medium |
| ibc.podium.separation | 3-hour horizontal assembly | - | same as above | "Separated by a 3-hour fire resistance-rated (FRR) horizontal assembly" | medium |
| la.dingbat.form | 2-storey wood and stucco walk-up | - | https://planetizen.com/news/2021/09/114793-how-iconic-dingbat-took-over-los-angeles (quoting Reyner Banham) | "Dingbats are normally a two-story walk-up apartment-block developed back over the full depth of the site, built of wood and stuccoed over." | low (secondary) |
| la.dingbat.era | 1954 to 1968 | years | https://planning.lacity.gov/odocument/1a7b1647-4516-45da-9cff-db2db3b9b440/Multi-FamilyResidentialDevelopment_1910-1980.pdf (LA Citywide Historic Context Statement) | subtheme title "The Stucco Box/Dingbat, 1954-1968" | medium (seen via search index; the PDF returned HTTP 403) |
| la.softstory.scope | wood frame, 2+ storeys, pre-1978 code, open ground floor | - | https://dbs.lacity.gov/services/specialized-services/mandatory-retrofit-programs/soft-story-retrofit-program | "Consist of 2 or more stories wood frame construction" ... "Built under building code standards enacted before January 1, 1978" ... "Contains ground floor parking or other similar open floor space" | high (Ordinances 183893 and 184081) |
| houston.1970s.facades | brick facades on 1970s complexes | - | https://www.texasmonthly.com/articles/brave-new-vacancies/ | "an unremarkable combination of brick facades, iron balconies, wood fenced patios, imitation mansard roofs" | low (journalism, via search snippet; page returned 403) |
| houston.1970s.share_sw | nearly 60% of 1970-77 complexes in Southwest Houston | % | same as above | "nearly 60 per cent of all new apartment complexes built between 1970 and 1977 were built in Southwest Houston" | low |
| us.garden_apartment | wood frame, 1 to 3 storeys | - | https://sah-archipedia.org/node/83211 (SAH Archipedia, "Multifamily Private Housing Since World War II") | "multiple small, wood-frame buildings of one to three stories on a spacious landscaped campus" | medium (scholarly, via search snippet; page returned 403) |
| houston.listing.brick | 964 listing records say "Brick Exterior Construction" | records | repo `docs/SPONSOR-DATA-INVENTORY.md` | "\| Brick Exterior Construction \| 964 \|" | high (houses, not the apartment set) |

### Code requirements between units

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| ca.1974.start | after August 1974, multifamily | date | https://store.astm.org/stp35976s.html (ASTM STP, 1979) | "Requirements for noise insulation are included in the design of all new multi-family dwelling units to be constructed in California after August 1974." | high |
| ca.1974.citation | Title 25 section 1092 | - | same as above | "Noise Insulation Standards are part of the California Administrative Code (Title 25, Section 1092)" | high |
| ca.cbc.1206.stc | STC 50 lab, NNIC 45 field | STC | https://up.codes/viewer/california/ca-building-code-2022/chapter/12/interior-environment (CBC 2022 1206.2) | "shall have a sound transmission class of not less than 50 where tested in accordance with ASTM E90" ... "or have a Normalized Noise Isolation Class (NNIC) rating of not less than 45 if field tested." | high |
| ca.cbc.1206.iic | IIC 50 lab, NISR 45 field | IIC | same as above (1206.3) | "shall have an impact insulation class rating of not less than 50 where tested in accordance with ASTM E492." | high |
| ca.cbc.1206.masonry | masonry STC by TMS 302 | - | same as above (1206.2.1) | "The sound transmission class of concrete masonry and clay masonry assemblies shall be calculated in accordance with TMS 302" | high |
| houston.2006ibc.stc | STC 50 (45 field) | STC | https://www.houstonpermittingcenter.org/media/2441/download?inline (Houston Amendments to the 2006 IBC, Ord. 2010-847, effective 12/31/2010) | "1207.2 Air-borne sound. Walls, partitions and floor/ceiling assemblies separating dwelling units from each other or from public or service areas shall have a sound transmission class (STC) of not less than 50 (45 if field tested)" | high |
| houston.2006ibc.iic | IIC 50 (45 field) | IIC | same as above | "shall have an impact insulation class (IIC) rating of not less than 50 (45 if field tested) when tested in accordance with ASTM E 492." | high |
| houston.2006ibc.entry_door | entry doors exempt, tight fitting | - | same as above | "This requirement shall not apply to dwelling unit entrance doors; however, such doors shall be tight fitting to the frame and sill." | high |
| houston.airport.exterior | STC 40 walls, windows, doors near airports; 45 dBA indoors | STC | same as above (Appendix N) | "All windows shall have a minimum STC rating of 40 when tested in accordance with ASTM E 90." and "to achieve an interior sound level of 45 dBA" | high (only where an airport land-use permit applies) |
| houston.airport.brick_veneer | brick veneer plus 1/2 in gypsum deemed compliant | - | same as above | "When exterior walls are constructed using brick veneer, a minimum of ½ inch gypsum drywall shall be applied as the interior finish." | high |
| houston.current_code | 2021 IBC, effective 1 Jan 2024 | - | https://www.houstonpermittingcenter.org/houston-code-archive | "The latest revision was approved by City Council on October 25, 2023, and became effective on January 1, 2024." | high |
| fha.1963.grades | STC/IIC 50 entry, 55 market, 60 luxury | STC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf (Thorburn, WoodWorks, Table 1) | "The FHA/HUD Noise Control in Multi-Family Housing document of that year suggested three levels of acoustical isolation" ... "Entry level 50 50 Market rate 55 55 Luxury 60 60" | medium (secondary account of the 1963 guide) |
| ubc.appendix35 | UBC Appendix Chapter 35 "Sound Transmission Control" | - | https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nbsir81-2366.pdf (NBSIR 81-2366) | "the current building noise control provisions contained in the Appendix, Chapter 35, \"Sound Transmission Control,\" of the Uniform Building Code" | medium (via search snippet; an appendix applies only where adopted) |
| ibc.exterior | no exterior acoustic requirement in IBC | - | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf | "the 2012 IBC does not include acoustic requirements for exterior walls." | medium |

### Typical assemblies (lab ratings)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| wood.wall.progression | 34, 38, 45, 50, 56, 63 | STC | https://www.woodworks.org/wp-content/uploads/Acoustics_Solutions_Paper.pdf (Figure 4, "Acoustical Progression in Wood-Framed Walls") | "STC 34 STC 38 STC 45 STC 50 STC 56 STC 63" | medium (figure labels; which drawing has which value is read from the figure order, single stud to double stud) |
| wood.wall.single_stud_rc_vs_double | 38 single stud one layer + batt; 45 with resilient channel; 63 double stud | STC | same as above (Figure 5) | "(1) Layer gypsum board both sides of studs" ... "STC 38 STC 45 STC 63" | medium |
| wood.wall.staggered | 60 | STC | same as above | "a staggered 2x4 stud wall on an 8-inch nominal plate achieves a rating of STC 60" | medium |
| wood.wall.double | 63 | STC | same as above | "this wall can achieve a rating of approximately STC 63 when insulated with batt insulation and covered with two layers of gypsum wallboard" | medium |
| wood.wall.badly_built | 63 can drop to 48 | STC | same as above | "a wall that commonly separates luxury units could go from STC 63 to STC 48 and not even meet building code requirements." | medium |
| wood.floor.progression | 37 bare, 43 batt, 49 gypsum concrete, 56 plus resilient channel, 62 best | STC | same as above (Figure 9) | "STC 37" ... "STC 43" ... "STC 49" ... "STC 56" ... "STC 62" | medium |
| wood.floor.stc50_needs | topping and resilient ceiling | - | same as above | "To achieve a rating of STC 50, both topping with additional mass (such as gypcrete) and a resilient system on the bottom of the joist are required." | medium |
| wood.floor.usg | 38 STC / 32 IIC, uninsulated, direct gypsum | STC / IIC | see R4 (`research/R4-rooms.md`, USG SA924 system I) | "38 32 Based on 1-1/4 nom wd flr" | high |
| wood.wall.stud_uninsulated | 33 | STC | see R4 (NRC CBD-239) | "has an STC rating of about 33" | high |
| cmu.8in.hollow | 48 | STC | https://www.nationalgypsum.com/ngconnects/blog/acoustics/fire-sound-assemblies-by-building-type | "Standard 8\" CMU walls are highly durable but only yield an STC 48 unless filled with sand or grout." | low (manufacturer blog) |
| masonry.stc_equation | STC = 0.18 W + 40 | STC | https://masoncontractors.org/1997/04/07/sound-transmission-class-rating-for-masonry-walls | "STC = 0.18W + 40" | medium (W = wall weight, psf) |
| concrete.floor.4in | 49 | STC | see R4 (DuPree 1980 catalogue, NBS test) | "4\" thick flat concrete panel, 54 psf ... 49" | medium |
| concrete.floor.6in | 53 | STC | see R4 (same catalogue, Riverbank test) | "6\" thick flat concrete panel, 75 psf. ... 53" | medium |
| steel_stud.party_wall | not found | STC | - | - | unsourced |

### Outside walls (ratings already in R3)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| wall.brick_veneer.oitc | 40 | OITC | see R3 (NRC) | "adding brick as the outer layer ... OITC rating which is increased to 40" | high |
| wall.cement_stucco.oitc | 29 | OITC | see R3 (NRC) | "and to 29 when a heavier cement stucco exterior is used" | high |
| wall.vinyl_siding.oitc | 24 to 25 | OITC | see R3 (NRC) | "reduction of the OITC rating from 25 to 24" | high |

## Equations

### R1. Decision rule for the two `inferred` fields (a default, not a record)

```
outside_wall  = listing feature if present
              else if class == Masonry and storeys <= 5         -> brick_veneer       (inferred, medium)
              else if class == WoodFrame and city == LA         -> cement_stucco      (inferred, low)
              else                                              -> era default        (assumed)

party_wall    = if city == LA and year >= 1975                  -> STC 50 wood stud   (inferred, code minimum)
                if city == Houston and year >= 2011             -> STC 50             (inferred, code minimum)
                if class in {ReinforcedConcrete, Steel} or storeys > 5 -> STC 50      (inferred, code era unknown)
                if class == Masonry and storeys > 5 (pre-1950 LA)  -> STC 48 block    (inferred, low)
                else                                            -> STC 36 stud        (assumed, pre-code)
party_floor   = wood frame post-code -> STC 50 / IIC 50; pre-code -> STC 38 / IIC 32;
                concrete -> STC 53 (IIC not found)
```

Spread for "worth checking": plus or minus 5 STC around each default (the code field
allowance is 5 points; the WoodWorks example shows a 15-point loss from bad detailing).
The STC 36 pre-code value is the midpoint of the 34 and 38 single-stud figures, `derived`.

Worked example, Volterra (Houston, 2014, 3 storeys, Masonry): outside wall = brick veneer,
OITC 40 (`inferred`, medium); party walls and floors = STC 50 / IIC 50 (`inferred`, code
minimum, since 2014 is after Houston's 2006-IBC amendments took effect). Terra at Park Row
(1983, WoodFrame, Houston): outside wall = era default; party wall = STC 36 (`assumed`,
because no Houston requirement before 2010 was found).

### R2. Masonry wall STC from weight

`STC = 0.18 * W + 40`, W in lb/ft2. Example: a wall of 45 lb/ft2 gives 0.18 * 45 + 40 = 48.1.
(45 lb/ft2 is a chosen input to show the arithmetic, not a sourced block weight.)

## Conflicts

1. **"Masonry" means structure or cladding?** CoStar's label is a structural class, but on
   a 3-storey Houston apartment the structure is almost certainly wood (Type V) with brick
   veneer. **Take brick veneer outside and wood-stud party walls inside** for Masonry at 5
   storeys or fewer. Do not infer masonry party walls from it.
2. **Code minimum or what was built.** STC 50 is a minimum on paper. WoodWorks shows a wall
   designed at 63 can test at 48, and the code allows 45 in the field. **Take STC 50 as the
   default for post-code buildings**, with the 5-point spread, and do not raise it for
   "luxury" without a listing or manager edit.
3. **Houston start date.** Confirmed only from 31 Dec 2010. Some earlier Houston buildings
   may have been built to STC 50 (UBC appendix, FHA guidance, or market practice). **Take
   the pre-code STC 36 default before 2011** and mark it `assumed`; a manager edit wins.
4. **California 1974 field values.** Today's CBC field allowance is 45 (NNIC/NISR). Whether
   the 1974 text had the same field figure was not confirmed. Use the lab value 50.
5. **Concrete and steel buildings.** The class says the frame is concrete or steel, but
   partitions inside are often light-gauge steel studs. No sourced STC for those was found.
   **Take STC 50 (code minimum)**, `inferred`, and keep the concrete STC 53 only for floors.

## Not found

- **CoStar's definition of its construction-material field.** costar.com blocks automated
  reads. Fallback: treat each code as a structural class per the repo inventory; ask CoStar.
- **Houston's building code before the 2006 IBC amendments (pre-2011)**, and whether it
  required STC 50. The archive lists amendments only from 2006 IBC on. Fallback: STC 36
  `assumed` before 2011.
- **Typical cladding for Houston WoodFrame apartments, and for concrete/steel buildings in
  either city.** Fallback: the era default already in `assumptions.yaml`.
- **Steel-stud demising wall STC** from a primary test. Fallback: code minimum STC 50.
- **IIC for concrete floors** and for the WoodWorks floor figure (labels could not be tied
  to drawings). Fallback: R4 USG IIC 32 for bare wood joists; code minimum IIC 50 post-code;
  concrete IIC `unsourced`.
- **Surveys of what was actually built by era** (AHS or permit data on party-wall type).
  Fallback: the code-era rule R1.
- **Thickness from the Matterport mesh** as a check on the class (plan section 14) was not
  researched here.
