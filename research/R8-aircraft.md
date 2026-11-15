# R8. Aircraft noise at a building from flight tracks

Research for issue #18. Checks the aircraft part of section 2.1 of `docs/NOISE_MODEL_PLAN.md`
(detailed form: closest point of the track, then a noise-versus-distance curve, then a sum
of events per block). All URLs were opened, and all files and services were downloaded or
called, on 2026-11-14.

## Answer

**1. Event levels from a track.** The public source is the international ANP (Aircraft Noise
and Performance) database. EUROCONTROL used to host it. EASA now publishes the legacy
versions 1.0 to 2.3 as free zip files of CSV tables, with no login. Version 2.3 has
noise-power-distance (NPD) tables for SEL, LAmax, EPNL and PNLTmax. Each table covers 10
slant distances from 200 ft to 25,000 ft, at several thrust settings, for each aircraft and
engine pair. It also has engine thrust coefficients, flap drag coefficients, default
procedures and an ICAO-type-code substitution table. EASA's newer "EASA verified" data is
not open: you have to request it, and only listed user groups qualify. EASA's site terms
allow reproduction "provided the source is acknowledged". No other licence is named. FAA AEDT
holds the same kind of data in its fleet database, but AEDT is paid software (US $1,200 for a
site licence) and needs a BADA licence, so AEDT is not a usable source for us.

The method is ECAC Doc 29 (5th edition, 2026), which matches ICAO Doc 9911. Look up the NPD
level, linear in thrust and linear in log distance. Add a speed correction
`10*lg(160 kt / V)` for SEL only. Subtract the lateral attenuation for receivers off to the
side at low elevation angles. The plan's "closest point of the track" hypothesis is a
simplified Doc 29. It is defensible for a building under or beside a straight path, and it
leaves out the finite-segment and installation corrections.

**2. EPNdB to SEL or LAmax: no.** No defensible fixed conversion exists. Doc 29 says model
EPNLs "are generally not comparable to certificated values". A TU Delft thesis that tried the
conversion found "no straightforward conversion exists". In the official 737-800 NPD tables,
the gap between EPNL and LAmax at the same thrust grows from about 6 dB at 200 ft to about
15 to 17 dB at 6,300 ft. The gap between EPNL and SEL changes sign with distance. Doc 29 uses
certified EPNdB for one thing only: the *difference* between a missing type and its ANP
proxy, as a dB offset on the proxy's NPD curves. The substitution table publishes that offset
per ICAO type code. That is what we should do.

**3. Block Leq.** The issue's equation is confirmed. It is Doc 29 eq. 5-1a with no time
weighting, a reference time t0 of 1 s, and T in seconds. Worked example in E3.

**4. Fallback table.** For a narrow-body jet whose type is unknown, use the ANP v2.3
Boeing 737-800 / CFM56-7B26 NPD tables. Use three thrust rows, derived here from the ANP's own
coefficients: arrival on a 3 degree glide (4,258 lb per engine), departure at max takeoff
thrust (21,643 lb), and departure at max climb thrust (17,115 lb). The table is in Values. At
1,000 ft slant distance the SEL is 84.7 (arrival), 97.3 (takeoff) and 93.0 (climb) dB.

**5. Night share.** No Part 150 noise exposure map for IAH or HOU was found online. Two FAA
NEPA documents give modelled day and night operations. Night is 22:00 to 07:00.

| Airport | Night share | Year and basis | Source |
|---|---|---|---|
| IAH | 6.1% | 2012 | FAA Houston Metroplex EA, IFR operations only |
| HOU | 8.4% | 2012 | same EA |
| HOU | 12.5% | 2027 forecast | HOU Runway 13R-31L EA, AEDT 3f, all operations |

The ADS-B day checked here (1 October 2026) gave 8.9% at IAH and 10.3% at HOU.

**6. Check against BTS 2020.** It was done with real tracks. OpenSky refuses historical data
without an account ("You cannot access historical flights"), so no account was made. The
tracks come from ADS-B Exchange's free first-of-month sample instead, which needs no login.
That sample is published "for testing and evaluation" only, so it suits this check and not
production use.

Method: take the day of 2026-10-01 UTC (1,174 IAH and 496 HOU operations seen), apply the
ANP plus Doc 29 method, and compare with the BTS 2020 aviation layer at four points:

| Point | Tracks, LAeq,24h | BTS 2020 | Difference |
|---|---|---|---|
| HOU_S | 52.2 | 52.3 | -0.1 dB |
| IAH_E | 55.2 | 56.1 | -0.9 dB |
| IAH_W | 60.8 | 54.6 | +6.2 dB |
| IAH_SE | 53.1 | 45.6 | +7.5 dB |

The two large gaps are what one day should produce. IAH ran east flow all day (568 of 598
arrivals landed eastbound), so every arrival passed over IAH_W. BTS is an annual average over
both flow directions, and its 2020 traffic was a pandemic year. At IAH_E the detailed form
matches BTS within 1 dB. The HOU_S match is weak evidence, because that point sits close to
two runway ends (see E2). The single-day level depends strongly on runway
direction, which the model cannot know from one day of tracks. Use a week or more of
tracks, or show the BTS value next to the track value.

## Values

Sources:
- [ANP] EASA ANP page: https://www.easa.europa.eu/en/domains/environment/policy-support-and-research/aircraft-noise-and-performance-anp-data
- [ANPZIP] ANP v2.3 archive tables (zip of 10 CSV files, 889 kB unzipped, files dated 2023-06-26): https://www.easa.europa.eu/en/downloads/138164/en
- [ANPNOTE] ANP v2.3 release note: https://www.easa.europa.eu/en/downloads/138159/en
- [SUBS] ANP aircraft substitutions, jets and heavy props (xlsx, 22-02-2018): https://www.easa.europa.eu/en/downloads/138165/en
- [EASAC] EASA copyright notice: https://www.easa.europa.eu/en/copyright-disclaimer
- [AEDT] FAA AEDT pricing: https://aedt.faa.gov/Purchase.aspx
- [D29V1] ECAC Doc 29 5th ed. Vol 1: https://ecac-ceac.org/images/documents/ECAC-CEAC-DOC_29_5th_Edition-REPORT_ON_STANDARD_METHOD_OF_COMPUTING_NOISE_CONTOURS_AROUND_CIVIL_AIRPORTS-Volume_1-APPLICATIONS_GUIDE.pdf
- [D29V2] ECAC Doc 29 5th ed. Vol 2: https://ecac-ceac.org/images/documents/ECAC-CEAC-DOC_29_5th_Edition-REPORT_ON_STANDARD_METHOD_OF_COMPUTING_NOISE_CONTOURS_AROUND_CIVIL_AIRPORTS-Volume_2-TECHNICAL_GUIDE.pdf
- [VH] Van Hemelen, TU Delft MSc thesis, 2017: https://repository.tudelft.nl/file/File_2275073e-68cf-4654-8196-b20cf948d2b3
- [P36] 14 CFR Part 36 Appendix B: https://www.law.cornell.edu/cfr/text/14/appendix-B_to_part_36
- [MPX] FAA Houston Metroplex EA, Appendix G2, Noise Modeling Technical Report, Jan 2013: https://www.faa.gov/sites/faa.gov/files/air_traffic/environmental_issues/ared_documentation/Appendix_G2_Aircraft_Noise_Analysis_Noise_Modeling_Technical_Report.pdf
- [HOUEA] HOU Runway 13R-31L Final EA with FONSI/ROD, Apr 2025 (Appendix C, HMMH noise memo of 3/4/2025): https://assets.ctfassets.net/fwldykjthzos/4Shf1lkWJT7rnFq1JHufsU/8250c9be65737ee533dfa39295b2eaaa/HOU_RWY_13R-31L_Final_EA_with_appendices_and_FONSIROD_20250423_508.pdf
- [BTSV2] BTS NTNM documentation (covers the 2020 data): https://rosap.ntl.bts.gov/view/dot/53773/dot_53773_DS1.pdf
- [BTS20] Esri copy of the BTS 2020 layers (see R1, E1): https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer
- [ADSBX] ADS-B Exchange sample data: https://www.adsbexchange.com/data-products/sample-data/ (files under https://samples.adsbexchange.com/)
- [OA] OurAirports runway table: https://davidmegginson.github.io/ourairports-data/runways.csv

Page numbers are the document's own page footers.

### 1. Public NPD data, access and licence

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Who publishes ANP | EASA, under Regulation (EU) 598/2014 | - | [ANP] | "EASA has a mandate to collect, verify and make available aircraft noise and performance (ANP) information for noise modelling purposes" | high |
| Legacy versions are public | v1.0 to v2.3, first published by EUROCONTROL | - | [ANP] | "EUROCONTROL published consecutive versions of the ANP data (versions 1.0 to 2.3) which are now published on the EASA website" | high |
| v2.3 download (tested) | direct zip, HTTP 200, no login | - | [ANPZIP] | response header `content-disposition: attachment; filename="archive_anp_v2.3.zip"` | high |
| v2.3 tables | Aircraft, NPD_data, Jet_engine_coefficients, Aerodynamic_coefficients, Default_weights, approach and departure procedural steps, fixed point profiles, spectral classes | - | [ANPZIP] | zip listing: `ANP2.3_NPD_data.csv` (201,956 bytes), `ANP2.3_Aircraft.csv`, ... | high |
| NPD table layout | NPD_ID; Noise Metric (SEL, LAmax, EPNL, PNLTmax); Op Mode (A or D); Power Setting; L at 200, 400, 630, 1000, 2000, 4000, 6300, 10000, 16000, 25000 ft | dB, ft | [ANPZIP] | header `NPD_ID;Noise Metric;Op Mode;Power Setting;L_200ft;L_400ft;...;L_25000ft` | high |
| Newer EASA-verified data | by request form, for eligible users only | - | [ANP] | "To request the data, please fill in the data request form" ; users are authorities, operators, ANSPs, airports and "other parties that can demonstrate a need for modelling purposes" | high |
| Licence | reproduction allowed with acknowledgement; no named licence | - | [EASAC] | "Reproduction is authorised, provided the source is acknowledged, save where otherwise stated." | medium (site-wide notice; the ANP page has no data-specific terms) |
| Substitution table | ICAO type code to ANP proxy, with dB offsets for departure and approach | dB | [SUBS] | "provides ANP proxies for each ICAO aircraft code" | high |
| Offset sign | positive = louder than the proxy | dB | [SUBS] | "A positive DELTA_db or N greater than 1 means that the aircraft to be modelled has higher certified noise levels than the proposed ANP proxy." | high |
| Example offsets (DEP, APP) | B738 to 737800: +0.6, +0.4; B38M to 7378MAX: +0.2, 0; E75L to EMB175: +0.7, +0.2; A320 (CFM) to A320-211: +0.2, 0; B739 to 737800: +1.2, +0.2 | dB | [SUBS], sheet "by ICAO code" | row `The Boeing Company;B738;737800;0.6;0.4;1.15;1.1` | high |
| FAA AEDT | paid; site licence US $1,200, extra seat US $170, BADA licence required | USD | [AEDT] | "AEDT 4 Site License: US $1200" ; "must apply for the "BADA License for AEDT 4"" | high |
| Where the NPD data come from | manufacturers, from certification tests | - | [D29V1] p.41 | "generally compiled and supplied by the aircraft manufacturer from noise certification test data" | high |
| NPD reference speed | 160 kt groundspeed | kt | [D29V2] p.9 | "Groundspeed: 160 knots" | high |
| NPD measurement height and ground | 1.2 m over soft level ground | m | [D29V2] p.36 | "generally based on measurements made 1.2m above soft level ground beneath the aircraft" | high |
| NPD validity envelope | under 30 °C, temperature (°C) times RH (%) over 500, wind under 8 m/s | - | [D29V2] p.10 | "Air temperature less than 30 C" | high (Houston summer afternoons fall outside it; Appendix D of Doc 29 adjusts) |
| Event scatter | standard deviation of Lmax about 2 dB in operations | dB | [D29V2] p.49 | "observed from operational measurements to be around 2 dB" | high |

### 2. Certification levels (EPNdB)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Model EPNL vs certified EPNL | not comparable | - | [D29V1] p.11, fn 9 | "point EPNLs calculated using noise contour models are generally not comparable to certificated values" | high |
| Direct conversion EPNL to LA | none found | - | [VH] p.v | "EPNL and LA are fundamentally different and no straightforward conversion exists" | high |
| Empirical fit attempt | failed | - | [VH] p.51 | "despite trying several methods no relationship could be found suiting the ten aircraft" | high |
| Sanctioned use of EPNdB | proxy offset: dep = mean of (flyover + lateral) difference; arr = approach difference | dB | [D29V1] p.45-46, eq. 6-1, 6-2 | "all NPD curves of the proxy aircraft should be corrected by adding specific decibel adjustments" | high |
| Flyover point is not typical | certification flyover uses deep cutback | - | [D29V1] p.44 | "the flyover level is measured for a deep-cutback procedure which is not representative for real operations" | high |
| Certification points | lateral 450 m from centreline; flyover 6,500 m from start of roll; approach 2,000 m before threshold, 120 m below a 3 degree path | m | [P36] B36.3 | "6,562 feet (2,000 m) from the runway threshold" | high |
| SEL vs LAmax (rule of thumb) | SEL above LAmax by about 10 dB | dB | [D29V1] p.11 | "usually exceeds L_Amax numerically, typically by around 10dB" | high |
| EPNL minus LAmax, 737-800, same row | approach A4000: 10.7 at 1,000 ft, 12.7 at 2,000 ft, 15.1 at 6,300 ft; departure D23500: 10.4 at 1,000 ft, 16.5 at 6,300 ft | dB | [ANPZIP] `ANP2.3_NPD_data.csv` rows CF567B EPNL / LAmax | `CF567B;EPNL;A;4000.0;98.4;93.7;90.1;86.2;80.3;...` and `CF567B;LAmax;A;4000.0;92.4;85.4;80.6;75.5;67.6;...` | high (arithmetic on official rows) |
| EPNL minus SEL, 737-800, same row | A4000: 1.6 at 1,000 ft, -0.9 at 6,300 ft; D23500: 3.0 at 1,000 ft, 1.5 at 6,300 ft | dB | same | `CF567B;SEL;A;4000.0;95.2;90.9;87.8;84.6;79.2;73.0;68.3;...` | high |

### 3. Block Leq

There are no table values for this question. The equation and its source are in E3.

### 4. Fallback table: narrow-body jet, type unknown

Proxy: ANP `737800`, "Boeing 737-800 / CFM56-7B26", NPD_ID `CF567B`, 2 engines, max landing
weight 146,300 lb [ANPZIP] `ANP2.3_Aircraft.csv`. The values are A-weighted. SEL is in dB
(re 20 µPa, 1 s) and LAmax is in dBA. They hold directly beneath a straight path at 160 kt.
Apply E2 for other speeds and for receivers off to the side.

Thrust rows (corrected net thrust per engine, lb):
- **Arrival, 4,258.** From the ANP coefficients by force balance on a 3 degree glide. Landing
  flap A_30 has R = 0.117166 (`ANP2.3_Aerodynamic_coefficients.csv`). Weight is 90% of max
  landing weight, the Doc 29 reference ([D29V2] p.10: "90 percent of maximum landing gross
  weight"). Interpolated between the published A 4000 and A 5000 rows.
- **Departure, takeoff and initial climb, 21,643.** MaxTakeoff coefficients E = 26089.1,
  F = -29.10981, Ga = 0.143559 at 160 kt and 1,000 ft. Use below about 3,000 ft above the
  field. The ANP default 737-800 procedure flies MaxTakeoff to about 2,000 to 3,000 ft
  (`ANP2.3_Default_departure_procedural_steps.csv`).
- **Departure, climb, 17,115.** MaxClimb coefficients E = 22403.5, F = -27.26452, Ga = 0.305603
  at 250 kt and 5,000 ft. Use above about 3,000 ft.

| Slant distance ft (m) | Arrival SEL | Arrival LAmax | Takeoff SEL | Takeoff LAmax | Climb SEL | Climb LAmax |
|---|---|---|---|---|---|---|
| 200 (61) | 95.3 | 92.5 | 106.5 | 105.3 | 102.5 | 101.3 |
| 400 (122) | 91.0 | 85.5 | 102.6 | 98.9 | 98.5 | 94.6 |
| 630 (192) | 87.9 | 80.7 | 100.1 | 94.5 | 95.9 | 90.2 |
| 1,000 (305) | 84.7 | 75.6 | 97.3 | 89.9 | 93.0 | 85.5 |
| 2,000 (610) | 79.3 | 67.7 | 92.9 | 82.6 | 88.3 | 78.2 |
| 4,000 (1,219) | 73.2 | 58.9 | 87.8 | 74.7 | 83.1 | 70.1 |
| 6,300 (1,920) | 68.4 | 52.4 | 84.2 | 69.2 | 79.3 | 64.5 |
| 10,000 (3,048) | 63.4 | 45.7 | 79.3 | 62.5 | 74.5 | 57.8 |
| 16,000 (4,877) | 55.9 | 36.9 | 73.4 | 55.4 | 68.4 | 50.4 |
| 25,000 (7,620) | 49.8 | 28.8 | 67.1 | 48.1 | 61.4 | 43.1 |

Confidence: high for the published rows. Medium for the choice of thrust row, which is my own
derivation from ANP coefficients and Doc 29 forms. Airlines often take off at reduced thrust,
so the takeoff column is an upper bound.

The published rows behind it, verbatim from `ANP2.3_NPD_data.csv` [ANPZIP]:

```
CF567B;SEL;A;4000.0;95.2;90.9;87.8;84.6;79.2;73.0;68.3;63.2;55.6;49.4
CF567B;SEL;A;5000.0;95.7;91.4;88.3;85.0;79.6;73.6;68.8;63.9;56.6;51.0
CF567B;SEL;D;16000.0;101.7;97.6;95.0;92.1;87.4;82.1;78.3;73.5;67.3;60.0
CF567B;SEL;D;19000.0;103.9;99.9;97.3;94.5;89.9;84.7;81.0;76.2;70.3;63.7
CF567B;SEL;D;23500.0;108.4;104.5;102.0;99.3;95.0;89.9;86.4;81.5;75.5;69.5
CF567B;LAmax;A;4000.0;92.4;85.4;80.6;75.5;67.6;58.8;52.3;45.5;36.6;28.5
CF567B;LAmax;A;5000.0;92.9;85.8;81.0;76.0;68.0;59.2;52.8;46.1;37.7;29.7
CF567B;LAmax;D;16000.0;100.5;93.7;89.3;84.6;77.3;69.2;63.5;56.8;49.4;42.1
CF567B;LAmax;D;19000.0;102.7;96.0;91.7;87.1;79.7;71.7;66.1;59.5;52.2;44.9
CF567B;LAmax;D;23500.0;107.2;100.9;96.5;91.9;84.7;76.8;71.4;64.6;57.7;50.4
```

A second narrow-body for comparison, A320-211 / CFM56-5A1 (`CFM565`). SEL at 1,000 ft is
84.2 for the A 2700 row and 96.4 for the D 22500 row. It is within 1 dB of the 737-800 on
arrival.

### 5. Night share of operations

Night is 22:00 to 07:00 in every source below.

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Night definition (Metroplex) | 22:00 to 06:59 | - | [MPX] p.G-35 | "10:00 p.m. through 6:59 a.m. (Night)" | high |
| IAH 2012 average annual day, day / night ops | 1,433.62 / 93.70, so 6.1% night | ops/day | [MPX] Table 11, p.G-35 | "IAH 1,433.62 93.70 1,560.80 101.07 1,854.56 111.25" | high (share is my division) |
| IAH 2014 and 2019 (forecast) night share | 6.1%, 5.7% | % | same row | same | high |
| IAH 2012 jets, night share by direction | arrivals 8.3%, departures 4.3% (all jets 6.3%) | % | [MPX] Appendix B fleet rows | e.g. "IAH AC Jet B738 737700 737800 108.26 12.36 116.18 4.43" | medium (summed by the research agent from per-type rows; matches the Table 12 jet total) |
| HOU 2012 average annual day, day / night ops | 453.78 / 41.76, so 8.4% night | ops/day | [MPX] Table 11 | "HOU 453.78 41.76 461.98 42.60 566.26 52.84" | high |
| Metroplex scope | IFR operations only, NIRS model | - | [MPX] Table 7, p.G-33 | "IAH 559,910 557,474 2,436" (all / IFR / VFR, 2012) | high |
| HOU 2027 forecast, arrivals day / night, departures day / night | 290.7 / 36.3, 281.8 / 45.3; total 654.1; 12.5% night | ops/day | [HOUEA] App. C memo p.28, Table 6 | "Total 290.7 36.3 281.8 45.3 654.1" | high |
| HOU 2027 night definition | 22:00 to 06:59 | - | [HOUEA] App. C memo p.25 | "nighttime is defined as 10:00 p.m. to 6:59 a.m." | high |
| HOU 2027 air carrier night share | 14.6% (arr 13.0, dep 16.2) | % | [HOUEA] App. C memo p.27 | "Subtotal 182.6 27.2 175.8 34.0 419.6" | high |
| Day/night split of the BTS 24 h level, IAH f = 0.061 | day +1.8, night -7.9, DNL = L24 + 1.9 | dB | R1 equation E2 with f above | computed | high (arithmetic) |
| Same, HOU f = 0.084 / 0.125 | day +1.7 / +1.5, night -6.5 / -4.8, DNL + 2.5 / + 3.3 | dB | R1 E2 | computed | high (arithmetic) |
| One-day check, 2026-10-01 (this study) | IAH 104 of 1,174 ops at night (8.9%); HOU 51 of 496 (10.3%) | ops | [ADSBX] traces, see section 6 | counted | medium (one day, ADS-B only) |

### 6. Track data access and the check

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| OpenSky historical flights (tested) | refused without an account | - | https://opensky-network.org/api/flights/arrival?airport=KIAH&begin=1762992000&end=1763078400 | HTTP 403 "You cannot access historical flights" | high |
| OpenSky historical states (tested) | refused without an account | - | https://opensky-network.org/api/states/all?time=1763000000&lamin=29.8&lomin=-95.5&lamax=30.2&lomax=-95.1 | HTTP 403 "Authenticate to get historical data" | high |
| OpenSky public state-vector samples | bucket now empty | - | https://s3.opensky-network.org/data-samples?list-type=2&prefix=states/ | only `states/placeholder.txt` listed | high |
| ADS-B Exchange free sample | full data for the 1st of each month | - | [ADSBX] | "Complete data from the 1st of each month are made available free of charge." | high |
| Its permitted use | testing and evaluation | - | [ADSBX] | "we offer free access to the first-of-the-month data sets for testing and evaluation" | high |
| Snapshot product used | global snapshots every 5 s; one every 5 min was read (288 files, about 5 MB each) | - | https://samples.adsbexchange.com/readsb-hist/2026/10/01/120000Z.json.gz | page: "archived every 5 seconds starting May 2020" | high |
| Trace product used | full-day track per aircraft, 1,018 aircraft fetched | - | e.g. https://samples.adsbexchange.com/traces/2026/10/01/21/trace_full_a44521.json | page: "Activity by individual ICAO hex for all aircraft during one 24-hour period." | high |
| BTS 2020 aviation traffic | AEE schedules scaled to 2020 tower counts | - | [BTSV2] p.8 | "operations scaled to the official tower count provided by FAA Air Traffic Activity System (ATADS)" | high |
| BTS 2020 aviation model | AEDT 3d, soft ground, no shielding | - | [BTSV2] p.2 | "Aviation noise is computed in the Aviation Environmental Design Tool (AEDT) version 3d" | high |
| Runway ends, IAH 09/27 | 29.97760, -95.33410 to 29.97760, -95.30250 | deg | [OA] | `"KIAH",10000,"09",29.97760009765625,-95.33409881591797` | medium (community data) |

Check results, 2026-10-01 00:00 to 24:00 UTC (19:00 CDT the day before to 19:00 CDT).
Jets only. "Tracks" means ANP v2.3 with the method in E1 and E2, the nearest point of each
flight, and the ICAO-code proxies and offsets from [SUBS]. BTS is the 2020 aviation slice,
decoded as in R1 E1.

| Point | lat, lon | Events | Tracks LAeq,24h | BTS 2020 | Tracks DNL | Night (22-07) share of events / of energy | Max LAmax |
|---|---|---|---|---|---|---|---|
| IAH_E, 5.0 km east of runway 27 end on its centreline | 29.9776, -95.2500 | 1,366 | 55.2 | 56.1 | 55.7 | 9.1% / 1.2% | 84.0 |
| IAH_W, 6.3 km west of runway 08R end | 29.9934, -95.4200 | 1,287 | 60.8 | 54.6 | 65.2 | 8.5% / 19.6% | 83.8 |
| IAH_SE, 5 km beyond runway 15L end | 29.9190, -95.3156 | 1,369 | 53.1 | 45.6 | 55.0 | 8.5% / 5.9% | 79.5 |
| HOU_S, R1's tested point, about 0.8 km south of the HOU runway 13L and 17 ends | 29.6600, -95.2800 | 553 | 52.2 | 52.3 | 54.4 | 11.4% / 7.6% | 72.8 |

BTS tile URLs: `.../ImageServer/tile/9/313/316?sliceId=0` (IAH_E), `9/313/314` (IAH_W),
`9/314/315` (IAH_SE), `9/318/316` (HOU_S), under [BTS20].

Block levels from the same day, LAeq over each block in dB, using the plan's time blocks in
CDT:

| Point | overnight 00-06 | morning_rush 06-10 | midday 10-16 | evening_rush 16-20 | evening 20-24 |
|---|---|---|---|---|---|
| IAH_E | 34.7 (44 events) | 54.1 | 57.2 | 59.6 | 46.9 |
| IAH_W | 57.4 (41 events) | 61.4 | 62.0 | 61.4 | 60.9 |
| IAH_SE | 44.4 | 51.9 | 56.5 | 53.9 | 51.0 |
| HOU_S | 42.4 | 52.9 | 54.3 | 54.4 | 49.4 |

Runway use that day: 568 of 598 IAH arrivals landed eastbound (east flow), and 198 of 224 HOU
arrivals landed in the 045 to 135 degree sector.

## Equations

### E1. Event level from the NPD table (Doc 29 Vol 2, eq. 4-3 and 4-4, p.28-29)

Variables:
- `P` is the corrected net thrust per engine, in lb. `P_i` and `P_i+1` are the tabulated
  rows on either side of it.
- `d` is the slant distance at the closest point of approach, in ft, with a floor of 30 m
  (98 ft), [D29V2] p.29.
- `L(P_i, d_j)` is the tabulated SEL or LAmax.

```
L(P, d_j) = L(P_i, d_j) + (L(P_i+1, d_j) - L(P_i, d_j)) * (P - P_i) / (P_i+1 - P_i)
L(P, d)   = L(P, d_j) + (L(P, d_j+1) - L(P, d_j)) * (lg d - lg d_j) / (lg d_j+1 - lg d_j)
```

Outside the table, extrapolate from the last two values. Doc 29 warns against more than 5 dB
of power extrapolation ([D29V2] p.28: "Users should be cautious of excessive power
extrapolation").

Thrust when ANP gives no fixed profile (Doc 29 Vol 2 Appendix B forms; coefficients from
`ANP2.3_Jet_engine_coefficients.csv` and `ANP2.3_Aerodynamic_coefficients.csv`):

```
Departure:  P = E + F*Vc + Ga*h + Gb*h^2            (Vc calibrated airspeed kt, h altitude ft)
Approach:   P = W * (R*cos(gamma) + sin(gamma)) / N  (W weight lb, R drag/lift ratio of the flap,
                                                      gamma flight path angle, negative descending,
                                                      N engines)
```

Worked example. A 737-800 on approach, 3 degree glide, `P = 131,670 * (0.117166 * 0.99863 - 0.05234) / 2 = 4,258 lb`.
At `d = 1,500 ft`:
`L(4258, 1000 ft) = 84.6 + 0.4 * 0.258 = 84.70`.
`L(4258, 2000 ft) = 79.2 + 0.4 * 0.258 = 79.30`.
`L(4258, 1500 ft) = 84.70 - 5.40 * 0.585 = 81.54 dB SEL`.

### E2. Corrections to the NPD level (Doc 29 Vol 2, eq. 4-14 p.34; eq. 4-18 and 4-19 p.37-38)

Variables:
- `V` is the groundspeed at the closest point, in kt. `V_ref = 160 kt`.
- `l` is the lateral distance from the receiver to the ground track, in m.
- `beta` is the elevation angle of the aircraft seen from the receiver, in degrees, in the
  plane normal to the path.
- `Delta_sub` is the substitution offset from [SUBS], departure or approach column.

```
SEL   = L_E(P, d)    + 10*lg(V_ref / V) - Lambda(beta, l) + Delta_sub
LAmax = L_Amax(P, d)                    - Lambda(beta, l) + Delta_sub
Lambda(beta, l) = Gamma(l) * Lambda(beta)
Gamma(l)     = 1.089 * (1 - exp(-0.00274 * l))      for 0 <= l <= 914 m;  1 for l > 914 m
Lambda(beta) = 1.137 - 0.0229*beta + 9.72*exp(-0.142*beta)   for 0 <= beta <= 50 deg;  0 above
```

Worked example (continuing E1): `V = 140 kt` gives `+0.58 dB`, so SEL = 82.1 dB directly
beneath. To the side, with the aircraft 300 m up and the receiver `l = 500 m` off the track:
`beta = 31.0 deg`, `Lambda(beta) = 0.548`, `Gamma = 0.812`, so the attenuation is 0.44 dB.
That is small, but the slant distance has grown to 583 m. At 100 m up and 1,000 m off:
`beta = 5.7 deg`, and the attenuation is 5.33 dB.

Left out (Doc 29 includes them): engine installation directivity (eq. 4-15), the
finite-segment correction, start-of-roll directivity, and the impedance adjustment. Of
these, the finite-segment correction and start-of-roll directivity matter most, for receivers
off the ends of a path: near a runway end, or beyond a turn. The three IAH check points are
5 km or more from a runway end. HOU_S is only about 0.8 km from two runway ends, and the
ground roll was not modelled there (only airborne track points were used). The close HOU
match is therefore partly luck. Treat the HOU_S result as weak.

### E3. Events to a block Leq (Doc 29 Vol 2, eq. 5-1a, p.46)

Doc 29 gives the general form, quoted verbatim: "L_eq,W = 10 lg [ (t0/T0) Σ g_i 10^(L_E,i/10) ] + C".
With no time weighting (`g_i = 1`, `C = 0`), `t0 = 1 s` (the SEL reference duration,
[D29V2] glossary p.x: "equal to 1 second in the case of → SEL") and `T0 = T` in seconds, this is the
issue's equation:

```
Leq,T = 10*log10( sum_i 10^(SEL_i/10) / T )        T in seconds (4 h block = 14,400 s)
peak  = max_i LAmax_i
```

Worked example. A 4 h `morning_rush` block with 30 departures at SEL 90 and 30 arrivals at
SEL 80:
`sum = 30*10^9.0 + 30*10^8.0 = 3.30e10`, so `Leq = 10*log10(3.30e10 / 14400) = 63.6 dB`.
The departures alone give 63.2 and the arrivals alone give 53.2. Doubling the number of
events adds 3.0 dB.

Real example from the check: the 41 events in the IAH_W `overnight` block (00:00 to 06:00 CDT)
give `Leq = 57.4 dB` with `T = 21,600 s`. The loudest LAmax was 83.8 dBA, a 767-300 on
approach at 325 m.

DNL from blocks or from day and night totals, same as R1 E2:
`DNL = 10*log10((15*10^(Ld/10) + 9*10^((Ln+10)/10)) / 24)`.

### E4. Fallback when the type is unknown

Use the section 4 table as `L(P, d)`. Pick the column by phase: arrival; departure below
about 3,000 ft above the field; departure above that. Then apply E2 with `Delta_sub = 0`. If
the phase is unknown too, a descending track is an arrival and a climbing track is a
departure. Worked example: an unknown narrow-body climbing out at 2,000 ft slant distance,
directly overhead at 160 kt, gives SEL 92.9 dB and LAmax 82.6 dBA.

### E5. Splitting the BTS aviation level into day and night (simple form)

R1 E2 applies with `f` = the night share of operations:
`L_night = L24 + 10*log10(f*24/9)` and `L_day = L24 + 10*log10((1-f)*24/15)`.
With IAH f = 0.061: night = L24 - 7.9, day = L24 + 1.8.

## Conflicts

1. **Operations share vs energy share at night.** The airport-wide night share of operations
   (6 to 9% at IAH) is not the share of sound energy at a given house. On the check day, the
   night share of energy was 1.2% at IAH_E and 19.6% at IAH_W, because night traffic at IAH
   is mostly arrivals. Doc 29 and BTS both work from operations. **Take the operations share**
   for the simple form, since it is sourced. Mark it `placeholder` for any single property,
   and use the detailed form when tracks exist.
2. **HOU night share: 8.4% (2012) or 12.5% (2027 forecast).** The 2012 Metroplex study is
   IFR only and uses an older model. The 2025 EA uses AEDT 3f on all operations. The
   one-day count gives 10.3%. **Take 12.5%** for HOU, because it is the newer full-operations
   AEDT study. Keep 8.4% as the low end.
3. **IAH night share: 6.1% (2012) or 8.9% (one ADS-B day in 2026).** No newer IAH study was
   found. **Take 6.1%** as `sourced`, and note that the 2026 day ran higher.
4. **One day of tracks vs an annual average.** At IAH_W and IAH_SE the track level is 6 to
   7.5 dB above BTS. On a day with the opposite runway flow, IAH_W would get departures
   instead of arrivals. BTS 2020 also has pandemic-year traffic, scaled to 2020 tower counts
   [BTSV2]. **Do not replace the BTS value with one day of tracks.** Use at least a week, or
   report both.
5. **Takeoff thrust.** ANP default procedures and this table use full rated thrust. Airlines
   often take off at reduced thrust. The departure columns are therefore upper bounds, likely
   by a few dB (unsourced estimate). The check still matched BTS within 1 dB at the
   departure-dominated IAH_E point, but one point is not a calibration.
6. **"LAmax = EPNL - 12 to 13" and "SEL = EPNL - 3" rules of thumb.** These circulate
   informally. The official NPD rows show they hold only near 2,000 ft and 1,000 ft
   respectively (section 2). **Do not use them.**

## Not found

- **Part 150 noise exposure maps for IAH or HOU.** None found online. The 2015 IAH Master Plan
  chapter 7 has no day/night table. Fallback: the FAA NEPA documents in section 5.
- **IAH 2020 tower count (ATADS) and its ratio to 2026 traffic.** Not found in a primary
  source within the time available, so the pandemic offset in BTS 2020 is not quantified.
  Fallback: treat BTS 2020 aviation as a low estimate for current traffic, size not known.
- **A free historical track source without login, licensed for production.** OpenSky needs
  an account (not created). ADS-B Exchange's free sample is only for testing and evaluation.
  Fallback: the BTS layer for the averages. Use the ADS-B sample only for checks and demo
  visuals, unless the team gets a licence or an OpenSky account.
- **NPD data for aircraft with no ANP entry and no listed proxy.** E45X, B39M, B78X, CL35 and
  C68A were not in the substitution table. In the check I mapped them by hand to EMB145,
  7378MAX, 7878R, CL600 and CNA560XL with a 0 dB offset (unsourced choice). B753 and MD11
  were dropped because the proxy had no usable coefficients, along with all propeller
  aircraft and helicopters. That is 228 aircraft traces in all, mostly light props.
- **Measured SEL against altitude at Houston noise monitors.** Not found. Houston Airports
  noise monitor data was not reached. Fallback: the check against BTS.
- **ICAO Doc 9911 text.** It is sold in the ICAO store. Doc 29 5th edition says it is
  harmonised with Doc 9911, so Doc 29 is quoted instead.
