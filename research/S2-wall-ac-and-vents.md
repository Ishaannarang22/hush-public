# S2. Through-wall air conditioners, window units and wall vents

Research for issue #37, task S2. Feeds the "through-wall or window air conditioner" field in
section 3 of `docs/UNIT_PROFILE_PLAN.md` (branch `codex/unit-profile-plan`). US housing. No
model code. Every value has a URL and an exact quote, or is marked `unsourced`. Values
computed here from sourced inputs are marked `derived`. Builds on R3 (facade, E2 composite
and leak term) and R4 (room terms); values there are not repeated.

## Answer

A through-wall air conditioner (PTAC or a through-wall room unit in a sleeve) is a weak
element of the outside wall, about as weak as a cheap window or weaker. The only lab data
found are ASTM E90 tests published by one manufacturer (GE, 2016): its own PTAC rated
**STC 29, OITC 21** in its sleeve with the unit off, and four competing 12,000 BTU units
rated **2 to 8 STC and 4 to 7 OITC lower**, which puts them at **STC 21 to 27, OITC 14 to
17** (derived). Amana states that an open outside-air vent door "dramatically" lowers the
rating; no number was found for that. The standard US sleeve is 42 x 16 in (0.43 m2).

No measured transmission loss was found for a **window air conditioner**. FAA sound
insulation guidance treats in-window and through-wall units the same way: they "allow
aircraft noise to enter the house" and are removed or covered with plywood in treated
homes. No dB figure is given.

A **wall vent** (dryer, bath or kitchen exhaust, fresh-air inlet) is a small open path. The
standard way to rate it is the element normalized level difference Dn,e (ISO 12354-1). An
unducted 4 in (102 mm) round opening works out to Dn,e of about 31 dB if it passes sound
freely (derived, R = 0). UK trickle vents, tested open, rate Dn,e,w 32 to 33 dB for plain
slot vents and up to 44 dB for acoustic ones. FAA guidance requires vent ducts with bends
and gives no dB value for them.

**Effect in the model.** In R3's 1990s bedroom (41.2 dBA), adding a PTAC raises the room by
**0.6 dB (OITC 21) to 2.4 dB (OITC 14)**, and an open 4 in vent by 1.3 dB, because R3's leak
term already dominates. In a tight 2000-onward room (R3 leak 0.1%, 37.4 dBA) the same PTAC
adds **1.4 to 4.5 dB**. So the field is worth having, mainly for newer buildings and for
the low-rated units.

**Self-noise when running:** rated by AHRI 300 / AHRI 350 as sound power. GE's paper
gives only relative values (competitors +1.0 to +3.4 dBA louder); no absolute dBA for any
PTAC or window unit was found from a primary source.

## Values

Confidence: high = primary standard, government guide or lab test read in full; medium =
manufacturer test read in full, or a value seen only in a search snippet of a primary
page; low = vendor summary, or derived on thin data.

### Through-wall units (PTAC and sleeve)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| ptac.ge_zoneline.stc | 29 | STC | https://www.geappliances.com/content/migrated-ge/zoneline/downloads/WhitePaperQuietFinal.pdf (GE Appliances, "GE Zoneline: The Quietest PTAC in the Industry", 7 July 2016) | "The new GE Zoneline has an STC rating of 29." | medium (manufacturer, third-party lab, ASTM E90, mean of 3 units rounded down) |
| ptac.ge_zoneline.oitc | 21 | OITC | same as above | "The new GE Zoneline has an OITC rating of 21." | medium |
| ptac.test_condition | unit off, in maker's sleeve and grille | - | same as above | "All units were installed in the appropriate manufacturer's wall sleeve with the appropriate manufacturer's outdoor grill" ... "during this test the PTAC is not operating" | medium |
| ptac.competitors.stc_delta (Amana, Amana Q, LG, Friedrich) | -4, -2, -4, -8 | STC points vs GE | same as above (Figure 2) | "-4 STC" "-2 STC" "-4 STC" "-8 STC" (Amana, Amana Q Series, LG, Friedrich) | medium (bar labels; competitor's paper) |
| ptac.competitors.oitc_delta | -6, -4, -5, -7 | OITC points vs GE | same as above (Figure 4) | "-6 OITC" "-4 OITC" "-5 OITC" "-7 OITC" | medium |
| ptac.competitors.stc | 21 to 27 | STC | derived here: 29 minus the deltas above | - | derived |
| ptac.competitors.oitc | 14 to 17 | OITC | derived here: 21 minus the deltas above | - | derived |
| ptac.oitc_preferred | OITC better for traffic | - | same GE paper | "OITC is considered a better indicator of PTAC's ability to block sound from being transmitted from outside to inside" | medium |
| ptac.vent_door_open | "dramatically" worse, no number | - | Amana PTC123G35QXXX product text, as listed at https://knitec.com/products/amana-ptc123g35qxxx-electric-ptac-11700-btu-230-208-3-5kw-10-4eer-with-5-year-warranty | search snippet: "open vent doors dramatically increase exterior sounds entering the guest room and therefore substantially reduce the STC and OITC ratings" | low (page returned HTTP 429; text seen only in a search result) |
| ptac.amana_current.stc | 29 | STC | Amana PTH153J35CXXX listing, https://www.ajmadison.com/cgi-bin/ajmadison/PTH153J35CXXX.html | search snippet: "Sound Transmission Class (STC 29) rating for all units" | low (page returned HTTP 403; no OITC given) |
| ptac.sleeve.size | 42 x 16-1/16 x 14-1/8 | in (W x H x D) | Amana WS900QW sleeve, https://www.budgetheating.com/amana-ptac-wall-sleeve-ws900qw/ | search snippet: "industry standard dimensions of 42" wide x 16 1/16" high" | low (snippet; the 42 x 16 nominal size recurs across makers) |
| ptac.sleeve.area | 0.43 | m2 | derived here: 1.067 m x 0.406 m | - | derived |
| ahri300.scope | sound rating and TL of PTAC | - | https://www.ahrinet.org/search-standards/ahri-300-2015-sound-rating-and-sound-transmission-loss-packaged-terminal-equipment | "a method to determine sound transmission loss" ... "for packaged terminal air conditioners and packaged terminal heat pumps." | high (scope only; the standard PDF returned HTTP 403) |
| ptac.self_noise.relative | competitors +1.0 to +3.4 dBA sound power vs GE, high cool | dBA (LwA) | GE paper, Figures 7 and 8 | "+2.9 dBA" "+2.1 dBA" "+1.0 dBA" "+1.0 dBA"; second lab "+3.4 dBA" | medium (relative only; absolute level not published in the paper) |
| ptac.self_noise.metric | AHRI 350 sound power | - | same as above | "PTAC operational sound is measured using AHRI 350" | medium |

### Window units and other penetrations (FAA guidance)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| faa.wall_units.path | any wall or ceiling unit lets noise in | - | https://www.faa.gov/sites/faa.gov/files/land_use_guidelines.pdf (FAA, "Guidelines for Sound Insulation of Residences Exposed to Aircraft Operations", April 2005) | "Any mechanical unit that penetrates exterior walls or the ceiling allows aircraft noise to enter the house. This includes in-window or through-wall air conditioners" | high (text extracted from the PDF; qualitative) |
| faa.wall_units.treatment | remove, or plywood cover with seals | - | same as above | "In most sound-insulated homes these units must be removed" ... "operable covers can be installed consisting of ¾" plywood and continuous perimeter neoprene bulb seals" | high |
| faa.wall_units.spec | not used in treated homes | - | same as above | "In-window, through-wall, or through-floor air-conditioning, ventilating, or heating units shall not be used." | high |
| faa.vent_ducts.spec | rigid metal, two 90 degree bends | - | same as above | "All vent ducts, including those for bathroom exhaust fans and dryers, connecting the interior space to the outdoors shall be rigid metal and contain at least two 90° bends" | high (no dB value given) |
| faa.closed_vs_open | 30 to 35 dB closed, 15 dB open | dB NLR | same as above | "an acoustically well-insulated home can provide 30 to 35 dB of noise reduction, this figure drops to 15 dB whenever the windows and doors are open" | high |
| window_ac.transmission_loss | not found | - | - | - | unsourced |

### Vents and small openings

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| dne.definition | level difference due only to a small element, normalized to A0 = 10 m2 | dB | https://cdn.standards.iteh.ai/samples/70242/d3ac59602f454a409b4265d6eee67477/ISO-12354-1-2017.pdf (ISO 12354-1:2017, 3.2.3) | "difference in the space and time average sound pressure level produced in two rooms by a source in one room, where sound transmission is only due to a small technical element (e.g. transfer air devices" ... "Ao = 10 m2" | high |
| nrc.small_openings | 120 cm2 of cracks turns a 50 dB, 12 m2 wall into 30 dB | dB | https://nrc-publications.canada.ca/eng/view/ft/?id=005ee3e2-8073-4473-ba5f-13afc877f67d (Bradley, NRC, "Sound Insulating Homes Against Aircraft Noise", 1998) | "If for example a 12 m2 wall, that reduces aircraft noise by 50 dB, included only 120 cm2 (18.6 in2) of openings due to cracks around a window or door, the actual aircraft noise reduction would be no more than 30 dB." | high |
| nrc.vents.treatment | quiet side, soffit, lined ducts | - | same as above | "Ventilation openings cannot be sealed but can be located so that they are less exposed to the incident aircraft noise." | high (qualitative) |
| trickle_vent.titon_s13.open | 33 (closed 45) | Dn,e,w dB | Titon Trimvent Select S13/C13 2700EA, https://dgsupplyline.co.uk/product/titon-trimvent-select-s13-c13-slot-vent | search snippet: "2700EA version – vent open 33 (-1;0), vent closed 45 (-1,-2)" | low (UK product; page returned HTTP 403; snippet only) |
| trickle_vent.titon_xtra.open | 32 (closed 35 to 41) | Dn,e,w dB | Titon Trimvent Select Xtra S13 data sheet (search result) | search snippet: "4400EA version – vent open 32 (0;1), vent closed 41" ... "5000EA version – vent open 32 (-1;0), vent closed 35" | low |
| trickle_vent.acoustic.open | 37 to 42 | Dn,e,w + Ctr dB | https://act-acoustics-website.pages.dev/knowledge-base/facades/acoustic-performance-of-trickle-vents/ (ACT Acoustics, Greenwood products) | table: "5000EA.AC1 ... 37", "2500EA.AC1 ... 40", "EAR24 ... 42" | low (consultant table; UK products) |
| open_vent_4in.area | 0.0081 | m2 | derived here: pi x 0.0508^2 | - | derived |
| open_vent_4in.dne | 30.9 | dB | derived here: 10 lg(A0 / S) with R = 0, see E1 | - | derived (ignores duct length, bends, hood and end reflection, all of which help) |

## Equations

### E1. A small element in the facade (ISO 12354-1 definition, R3 E2 extended)

From the Dn,e definition (same normalization as Dn, A0 = 10 m2), a small element adds a
transmission term equivalent to `A0 * 10^(-Dn,e/10)` m2 of fully open area. Added to R3 E2:

```
tau_facade = [ S_wall*10^(-R_wall/10) + sum S_i*10^(-R_i/10) + f(era)*S_win
               + S_ptac*10^(-R_ptac/10)                 # through-wall unit, area element
               + sum_k A0*10^(-Dn,e_k/10) ] / S         # vents, small elements
R_facade   = -10*log10(tau_facade)
A0 = 10 m2
```

- `S_ptac`: sleeve opening, 0.43 m2 for a 42 x 16 in sleeve; it replaces that much wall.
- `R_ptac`: OITC of the unit in its sleeve (21 best found; 14 to 17 for the others).
- For a plain open hole of area S_open with R = 0, `A0*10^(-Dn,e/10) = S_open`, so
  `Dn,e = 10*log10(A0/S_open)` (my derivation from the definition, not quoted text).

Worked example, R3's 1990s bedroom (S = 9.6 m2, window 1.44 m2 at OITC 23, wall OITC 40,
leak f = 0.01, L_ff = 65 dBA, C = +3, 10 lg(S/A) = -0.52, so L_room = 67.48 - R_facade):

| case | added term (m2) | R_facade (dB) | L_room (dBA) | change |
|---|---|---|---|---|
| R3 base | 0 | 26.31 | 41.2 | 0 |
| + PTAC OITC 21 (0.4335 m2 replaces wall) | 0.4335 x 10^-2.1 = 0.00344 | 25.70 | 41.8 | +0.6 |
| + PTAC OITC 14 | 0.4335 x 10^-1.4 = 0.01727 | 23.84 | 43.6 | +2.4 |
| + open 4 in vent, Dn,e 30.9 | 10 x 10^-3.09 = 0.00813 | 24.97 | 42.5 | +1.3 |
| + Titon slot vent open, Dn,e,w 32 | 10 x 10^-3.2 = 0.00631 | 25.24 | 42.2 | +1.0 |

Same, with R3's 2000-onward leak f = 0.001 (base R_facade 30.06, L_room 37.4): PTAC OITC 21
gives 38.8 (+1.4), PTAC OITC 14 gives 41.9 (+4.5), open 4 in vent gives 40.1 (+2.7).

### E2. Running unit (not computed)

When the unit runs, its indoor sound power LwA adds a source in the room:
`L_room,unit = LwA + 10*log10(4/A)` (diffuse-field, standard textbook relation, `unsourced`
here). No absolute LwA was found, so this term cannot be filled yet.

## Conflicts

1. **Whose numbers.** All PTAC transmission data come from one manufacturer's paper about its
   own product. The competitor values are bar labels relative to GE. **Take GE 21 as the
   best case and 14 as the low case**, and say the values are manufacturer data.
2. **OITC versus STC.** GE's STC 29 and OITC 21 differ by 8 points, in line with R4's 7 to 9
   point gap for stud walls. **Use OITC**, as R3 does for windows.
3. **Vent door.** Ratings are for the outside-air door closed (Amana says open doors cut the
   rating; GE does not state the door position). No number for the open case. Fallback below.
4. **Trickle vents are a UK product.** US apartments rarely have them; they are included only
   as tested examples of a vent-sized opening. **For US vents use E1 with R = 0** unless a
   duct with bends is known, which only makes things quieter.
5. **ISO small-element term versus area term.** A PTAC is large (0.43 m2) and has a lab TL, so
   it is entered as an area element with its OITC, not as Dn,e.

## Not found

- **Window air conditioner transmission loss.** No lab or field value. Fallback: treat as a
  window replaced by the low PTAC case (OITC 14 over the unit's face area) plus the side
  accordion panels as part of the window leak; label `unsourced`.
- **PTAC with the outside-air vent door open.** Fallback: treat the vent door as an open
  hole of its free area (E1, R = 0) once a free area is known; until then, flag as
  `unsourced` and use OITC 14.
- **Absolute self-noise (AHRI 300/350 LwA) of any PTAC or window unit.** Spec sheets
  (Carrier 52P, Amana, Friedrich) were not readable. Fallback: no running-unit source; show
  the unit as an opening only.
- **FAA AC 150/5000-9B (2022) and the 1992 Wyle report text on wall units with numbers.**
  The 2022 AC returned HTTP 403 to the fetch tool; the 2005 guideline gives no dB value.
- **US field measurements of rooms with and without a PTAC.** Not found. Fallback: E1.
- **Dn,e of US bath, kitchen or dryer vents with hoods and ducts.** Not found. Fallback:
  open-hole Dn,e (about 31 dB for 4 in), an upper bound on the sound let in.
