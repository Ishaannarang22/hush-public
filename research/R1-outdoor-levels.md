# R1. Outdoor source levels

Research for issue #2. Checks section 2.1 of `docs/NOISE_MODEL_PLAN.md`.
All URLs were opened and all service calls were run on 2026-11-14.

## Answer

The BTS National Transportation Noise Map gives an A-weighted 24-hour LAeq for an
average annual day. Road and rail are computed on a 30 m grid of receptors 1.5 m above
ground. Values below 45 dBA are left out. Road, rail and aviation come as separate
layers and as combined layers. Two releases matter. The 2020 data (released 2022) can
be read as real numbers per mode. The 2022/2023 data (Version 3, released 2026) is
newer, but BTS publishes it only as colored map tiles, so it gives a 5 to 10 dB class,
not a number. BTS models no shielding at all: no barriers, no buildings, no terrain,
and no trees. So our barrier and foliage terms do not double-count. They are the only
place shielding enters the model.

A 24-hour LAeq has no night weighting. BTS spreads road traffic evenly over 24 hours,
so the map gives us no day/night split. We have to add it. The HUD default is that 15%
of daily traffic runs at night (22:00 to 07:00), for both roads and railroads. That
gives day = L24 + 1.3, night = L24 - 4.0, DNL = L24 + 3.7. The plan's starting values
(+1.5 / -5 / +3.2) imply 11.8% at night. They are energy-consistent but not sourced.
I found no sourced night share for Houston aviation.

The FHWA RCNM table is complete below, with page references. The RCNM equations match
the plan's construction formula. Houston publishes weekly building-permit lists by
address. There is no permit feed with coordinates in the city's open data portal.

## Values

### BTS National Transportation Noise Map (NTNM)

Sources:
- [V3] BTS, *National Transportation Noise Map Documentation, Version 3, Release Year 2026*: https://rosap.ntl.bts.gov/view/dot/90910/dot_90910_DS1.pdf
- [V2] BTS, *National Transportation Noise Map Documentation* (2022 edition, covers the 2020 data): https://rosap.ntl.bts.gov/view/dot/53773/dot_53773_DS1.pdf
- [NTAD20] BTS, NTAD 2020 noise data note: https://maps.dot.gov/NTAD_Data/2020_Noise_Data.txt

Page numbers are the document's own page footers.

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Metric | LAeq,24h, A-weighted | dBA | [V3] p.2 | "developed using a 24-hr equivalent A-weighted sound level (denoted by LAeq) noise metric" | high |
| Averaging period | average annual day | - | [NTAD20] | "represent potential noise levels across the nation for an average annual day for the specified year" | high |
| Data year, current release | 2022 aviation and rail, 2022/2023 highway; released 2026 | year | [V3] p.1, Table 1-1 | "3 2022 /2023 Aviation (2022) Highway (2022/2023) Passenger and Freight Rail (2022) combined Released in 2026" | high |
| Data year, previous release | 2020, released November 2022 | year | https://catalog.data.gov/dataset/noise-data-2020 | "utilized transportation mode data from 2020 ... released in November 2022" | high |
| Road receptor grid | 30 | m | [V3] p.4 | "The road noise receptors are defined by a uniform grid with a resolution of 98.4 feet (30 m)" | high |
| Rail receptor grid | 30 | m | [V3] p.6 | "The receptors are defined by a uniform grid with a resolution of 98.4 feet (30 m)" | high |
| Receptor height (road, rail) | 1.5 | m | [V3] p.4, p.6 | "Each receptor is modeled at a height of 4.92 feet (1.5 m) above ground level" | high |
| Aviation receptor grid | AEDT dynamic grid, refined per airport; published at 30 m | - | [V3] p.2 | "The starting grid for each airport was 4-point box, spaced 0.1 nautical miles apart" | high (method); medium (30 m is the published pixel, not the model grid) |
| Lowest value reported | 45 (below this: no data) | dBA LAeq,24h | [V3] p.8 | "Noise level results below 45 dB(A) LAeq,24 are not included." | high |
| Shielding by barriers, buildings, terrain | not modeled | - | [V3] p.8 | "Shielding is not considered (i.e. attenuation due to barriers, buildings and terrain are not considered)." | high |
| Attenuation that is modeled | ground effect (soft ground) and divergence only | - | [V3] p.8 | "noise level attenuation is considered to be due only to ground effects (assumes all soft ground) and free-field divergence" | high |
| Trees / foliage | not modeled (only ground effect and divergence are) | - | [V3] p.8 | same quote as above; trees are not mentioned anywhere in [V3] | high |
| Road time-of-day profile | flat over 24 h | - | [V3] p.9 | "Average Annual Daily Traffic (AADT) are distributed evenly across 24 hours." | high |
| Road model | FHWA TNM 2.5 algorithms, HPMS AADT, autos / medium / heavy trucks | - | [V3] p.3-4 | "acoustical algorithms from the Federal Highway Administration's (FHWA) Traffic Noise Model (TNM) version 2.5" | high |
| Rail model | FTA / FRA manual methods; horns within 1/4 mile of grade crossings | - | [V3] p.5 | "Horn noise is included for track segments within 1/4 mile of each grade crossing, unless a quiet zone is identified." | high |
| Aviation model | AEDT 3e; airports with 1 or more jet departures per day; no helicopters | - | [V3] p.2 | "Helicopter operations are not included in this effort." | high |
| Separate layers | yes: aviation, road, rail, plus combined | - | [V3] p.7 | "Aircraft, road and rail noise inventories are provided both separately and as combined GIS image service layers." | high |
| Combined layer rule | energy sum of the modes | - | [V3] p.7 | "The combined aircraft, road, and rail noise inventories are acoustically summed to produce the composite layers." | high |
| File format | Esri file geodatabase raster (V3); tif before | - | [V3] p.7 | "For the 2022 version 3 release, the image / raster layers were stored within a Esri file geodatabase format." | high |
| Intended use | trends, not single sites | - | [V3] p.1 | "should not be used to evaluate noise levels in individual locations or at specific times" | high |

### Access for Houston (tested)

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| 2020 per-mode raster, numeric (tested, works) | `USA_Transportation_Noise_2020` ImageServer, float32, 30 m, Albers WKID 102039, tiles only (LERC2 v6) | dBA LAeq,24h | https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer?f=json | service JSON: `"pixelSizeX":30`, `"pixelType":"F32"`, `"minValues":[45]`, `"maxValues":[124.90000915527344]`, `"capabilities":"Image,TilesOnly"` | high |
| Mode slices on that service | sliceId 0 Aviation, 1 Rail, 2 Rail+Road+Aviation, 3 Road, 4 Road+Aviation | - | https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer/slices?f=json | `{"sliceId":3,"multidimensionalDefinition":[{"variableName":"Road", ...}]}` | high |
| Who publishes it | Esri Living Atlas (republished BTS 2020) | - | https://www.arcgis.com/home/item.html?id=439250230a414e46aa2846c7e2ae2048 | "values of the USDOT model below 45 dBA have been changed from NoData to a value of 45.0 by Esri" | high |
| Combined-only 2020 raster | `USA_Transportation_Noise___Rail_Road_and_Aviation_2020`, Web Mercator, z11 = 30 m | dBA | https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise___Rail_Road_and_Aviation_2020/ImageServer?f=json | `"pixelSizeX":29.9999961896375` | high |
| Tested level, Houston City Hall 29.7604, -95.3698, 2020 | road 54.8, rail 51.2, aviation 45.0 (floor), combined 56.4 | dBA LAeq,24h | road: https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer/tile/9/316/315?sliceId=3 (pixel row 193, col 51); rail `?sliceId=1`; aviation `?sliceId=0`; combined `?sliceId=2` | decoded from the tile, see Equations E1 | high |
| Tested level, south of Hobby airport 29.6600, -95.2800, 2020 | aviation 52.3, road 45.0 (floor), combined 52.4 | dBA LAeq,24h | https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Transportation_Noise_2020/ImageServer/tile/9/318/316?sliceId=0 (pixel row 50, col 87) | decoded from the tile | high |
| 2022/2023 release, class only (tested, works) | BTS-owned cached PNG tiles per mode, Web Mercator, max zoom 12 (about 38 m pixels at the equator, 33 m at Houston) | dBA class | https://tiles.arcgis.com/tiles/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Noise_2022_CONUS_road/MapServer?f=json | service JSON: `"format":"PNG8"`, `"maxLOD":12`, `"capabilities":"Map,TilesOnly,Tilemap"` | high |
| 2022 legend classes | 45.0-49.9, 50.0-54.9, 55.0-59.9, 60.0-69.9, 70.0-79.9, 80.0-89.9, > 90.0; transparent = below 45 | dBA | https://tiles.arcgis.com/tiles/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Noise_2022_CONUS_road/MapServer/legend?f=json | `"label":"55.0 - 59.9"` | high |
| Tested class, City Hall, 2022/2023 | road 55.0-59.9, rail 50.0-54.9, aviation below 45, combined 55.0-59.9 | dBA LAeq,24h | https://tiles.arcgis.com/tiles/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Noise_2022_CONUS_road/MapServer/tile/12/1693/962 (pixel col 231, row 13); same path with `_rail`, `_aviation`, `_aviation_rail_road` | pixel RGB (255,0,0) = legend "55.0 - 59.9" | high |
| Tested class, south of Hobby, 2022/2023 | aviation 50.0-54.9, road below 45 | dBA LAeq,24h | https://tiles.arcgis.com/tiles/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Noise_2022_CONUS_aviation/MapServer/tile/12/1694/963 (pixel col 236, row 94) | pixel RGB (255,128,0) = legend "50.0 - 54.9" | high |
| Official 2020 BTS map services | listed, but every `identify` and `export` call returned HTTP 500 | - | https://geo.dot.gov/server/rest/services/Hosted/NTAD_Noise_2020_CONUS_Road/MapServer | response: `{"error":{"code":500,"message":"Error performing identify"}}` | high (tested several times) |
| Bulk download | BTS download page; mosaic needs path repair in ArcGIS | - | https://www.bts.gov/geospatial/national-transportation-noise-map | page returned HTTP 403 to our client; contents known only from search snippets | low |

### Day, night and DNL

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| DNL definition (HUD) | 24 h average with +10 dB from 22:00 to 07:00 | dB | https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.103 | "the 24-hour average sound level, in decibels, obtained after addition of 10 decibels to sound levels in the night from 10 p.m. to 7 a.m." | high |
| DNL definition (FAA) | same, midnight to midnight | dB | https://www.ecfr.gov/current/title-14/chapter-I/subchapter-I/part-150/section-150.7 | "obtained after the addition of ten decibels to sound levels for the periods between midnight and 7 a.m., and between 10 p.m., and midnight" | high |
| HUD highway shortcut | DNL ≈ Leq(design hour), valid if night traffic ≤ 15% of ADT and trucks ≤ 10% | dB | https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.106 | "the traffic flow between 10 p.m. and 7 a.m. does not exceed 15 percent of the average daily traffic flow" | high |
| Default night share, roads | 15 | % of ADT | https://www.in.gov/ihcda/files/Appendix-11.-Noise-Abatement-and-Control-2025.pdf (Indiana housing agency, HUD noise training) | "Roadways ... Night time traffic = 15% of ADT" | medium (state agency restating HUD guidance; HUD Guidebook PDF would not download) |
| Default night share, railroads | 15 | % of trains | same as above | "Railroads ... Night time traffic = 15% of ADT" | medium |
| Default night share, aviation | not found | % | - | - | unsourced |

### FHWA RCNM construction equipment

Source: FHWA *Roadway Construction Noise Model User's Guide*, FHWA-HEP-05-054 /
DOT-VNTSC-FHWA-05-01, January 2006: https://www.fhwa.dot.gov/environment/noise/construction_noise/rcnm/rcnm.pdf
Table 1 is on p.3 ("Table 1. CA/T equipment noise emissions and acoustical usage factors
database"). The same rows appear in FHWA Construction Noise Handbook Table 9.1, section 9.4.1:
https://www.fhwa.dot.gov/environment/noise/construction_noise/handbook/handbook09.cfm

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Excavator | Spec Lmax 85, Actual Lmax 81, usage 40%, not impact, 170 samples | dBA at 50 ft | RCNM guide p.3 | "Excavator No 40 85 81 170" | high |
| Jackhammer | Spec 85, Actual 89, usage 20%, impact, 133 samples | dBA at 50 ft | RCNM guide p.3 | "Jackhammer Yes 20 85 89 133" | high |
| Dump truck | Spec 84, Actual 76, usage 40%, not impact, 31 samples | dBA at 50 ft | RCNM guide p.3 | "Dump Truck No 40 84 76 31" | high |
| Concrete mixer truck | Spec 85, Actual 79, usage 40%, not impact, 40 samples | dBA at 50 ft | RCNM guide p.3 | "Concrete Mixer Truck No 40 85 79 40" | high |
| Crane | Spec 85, Actual 81, usage 16%, not impact, 405 samples | dBA at 50 ft | RCNM guide p.3 | "Crane No 16 85 81 405" | high |
| Impact pile driver | Spec 95, Actual 101, usage 20%, impact, 11 samples | dBA at 50 ft | RCNM guide p.3 | "Impact Pile Driver Yes 20 95 101 11" | high |
| Concrete saw | Spec 90, Actual 90, usage 20%, not impact, 55 samples | dBA at 50 ft | RCNM guide p.3 | "Concrete Saw No 20 90 90 55" | high |
| Compressor (air) | Spec 80, Actual 78, usage 40%, not impact, 18 samples | dBA at 50 ft | RCNM guide p.3 | "Compressor (air) No 40 80 78 18" | high |
| Lmax distance term | Lmax - 20 log(D/50) - shielding | dBA | RCNM guide p.20, eq. (1) | "LmaxCalc = selected_Lmax - 20log(D/50) - shielding" | high |
| Usage factor term | Leq = LmaxCalc + 10 log(U.F.%/100) | dBA | RCNM guide p.20, eq. (2) | "Leq = LmaxCalc + 10log(U.F.%/100)" | high |
| Usage factor meaning | share of the operation spent at full power | % | RCNM guide p.7 footnote 1 | "Usage factor is the percentage of time during a construction noise operation that a piece of construction equipment is operating at full power." | high |

### Construction in Houston

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Allowed construction hours (defense in Sec. 30-7(5)) | 07:00 to 20:00, and not above 75 dBA at the nearest home | h, dBA | https://nonoise.org/lawlib/cities/houston.htm (copy of the code "Codified through Ord. No. 97-1394, adopted November 5, 1997") | "conducted between the hours of 7:00 a.m. and 8:00 p.m. and which activity did not produce a sound exceeding seventy-five (75) dB(A)" | low (old copy; Chapter 30 was amended in 2022, current text not checked) |
| Weekly permit lists | weekly .xlsx, Jan 2026 to Oct 2026 posted; fields: Zip Code, Permit Date, Permit Type, Project No, Address, Comments; no coordinates | - | https://houstonpermittingcenter.org/sold-permits-search ; sample: https://www.houstonpermittingcenter.org/sites/g/files/nwywnm431/files/2026-10/Oct%2019-25.xlsx | header row of the sample file: "Zip Code / Permit Date / Permit Type / Project No / Address / Comments" | high |
| 3-year permit search | basic permit history, rolling 3 years | - | http://cohtora.houstontx.gov/approot/soldpermits/online_permit.htm | "Basic permit history is available for the previous 3 years." | medium (link listed on the page, not opened) |
| City open data portal | only a monthly summary of residential permits; no per-site permit feed | - | https://data.houstontx.gov/dataset/residential-building-permits | CKAN `package_list` (107 datasets) has no per-permit dataset | high |

## Equations

### E1. Reading a BTS level for a lat/lon (tested)

Numeric 2020 value per mode, from the Esri ImageServer `USA_Transportation_Noise_2020`.

1. Project (lat, lon) to USA Contiguous Albers Equal Area Conic USGS (WKID 102039):
   NAD83 / GRS80, standard parallels 29.5 and 45.5, latitude of origin 23, central
   meridian -96, no false easting or northing.
   Parameters checked at https://spatialreference.org/ref/esri/102039/esriwkt.txt
2. Tile grid from the service JSON: origin x0 = -2359826.6667 m, y0 = 3175690 m,
   level 9 resolution r = 30 m, tiles of 256 x 256.
   `px = (x - x0) / r`, `py = (y0 - y) / r`, `col = floor(px / 256)`, `row = floor(py / 256)`,
   pixel `(floor(py) mod 256, floor(px) mod 256)`.
3. GET `.../ImageServer/tile/9/{row}/{col}?sliceId={0 aviation | 1 rail | 3 road | 2 all}`.
   The reply is a LERC2 version 6 blob with lossless float32 data. It needs a LERC
   decoder (Esri `lerc` library, or the 200-line port I used for this test, which is
   not committed). Read the pixel. A value of exactly 45.0 means "at or below 45".

Worked example, City Hall (29.7604, -95.3698): Albers x = 60,916 m, y = 742,995 m,
so tile 9/316/315, pixel row 193, col 51. The road slice decodes to 54.8 dBA LAeq,24h.

Check that the decoding is right. In one tile, over 10,000 pixels where only road is above
45, the combined slice minus the road slice has median 0.08 dB, as an energy sum
requires. The decoded tile also shows the freeway lines.

Class value for the newer 2022/2023 release, from BTS's own PNG tiles:
`n = 2^12`, `xt = (lon + 180) / 360 * n`,
`yt = (1 - ln(tan(lat) + sec(lat)) / pi) / 2 * n`, tile `12/floor(yt)/floor(xt)`, pixel
`(frac(xt)*256, frac(yt)*256)`. Match the pixel color to the legend colors.
Worked example, City Hall: tile 12/1693/962, pixel (231, 13), RGB (255, 0, 0),
which is "55.0 - 59.9". This agrees with the 2020 value of 54.8, give or take one class.

### E2. Day, night and DNL from a 24-hour LAeq

Variables: `L24` = BTS level (dBA). `f` = share of the day's sound energy that falls
between 22:00 and 07:00. For traffic at a constant mix and speed, energy is proportional
to vehicle count, so `f` = the night share of ADT.

```
L_day   = L24 + 10*log10((1 - f) * 24 / 15)       07:00 to 22:00
L_night = L24 + 10*log10(f * 24 / 9)              22:00 to 07:00
DNL     = L24 + 10*log10(1 + 9*f)
```

These follow from the DNL definition (24 CFR 51.103(a)) and from
`L24 = 10*log10((15*10^(Ld/10) + 9*10^(Ln/10)) / 24)`.

Worked example, L24 = 65 dBA, f = 0.15 (HUD default):
`L_day = 65 + 10*log10(1.36) = 66.3`, `L_night = 65 + 10*log10(0.40) = 61.0`,
`DNL = 65 + 10*log10(2.35) = 68.7`.
Check: `10*log10((15*10^6.634 + 9*10^7.102) / 24) = 68.7`.

The plan's +1.5 / -5 correspond to f = 0.118 and give DNL = L24 + 3.15.

### E3. Construction (FHWA RCNM)

Variables: `Lmax50` = Table 1 level at 50 ft (dBA). `D` = distance in ft. `UF` = usage
factor (%). `IL` = barrier insertion loss (dB).

```
Lmax = Lmax50 - 20*log10(D/50) - IL          (RCNM eq. 1)
Leq  = Lmax + 10*log10(UF/100)               (RCNM eq. 2)
```

This is the same formula as plan section 2.1. The `Leq` holds over the hours the
equipment is working, not over 24 hours.

Worked example: an excavator (Spec 85 dBA, UF 40%) 200 ft from the facade, with no barrier:
`Lmax = 85 - 20*log10(4) = 73.0`, `Leq = 73.0 + 10*log10(0.40) = 69.0 dBA` while working.
With the Actual level (81 dBA) it is 65.0 dBA. Several machines are energy-summed.
To spread this over our 15-hour day: `L_day = Leq + 10*log10(hours_worked / 15)`.
`hours_worked` is unsourced. Houston's old code allows 07:00 to 20:00, which is at most 13 h.

### E4. Energy sum across modes, with the 45 dB floor

`L = 10*log10(sum 10^(Li/10))`, summing only modes that are above 45.
Worked example, City Hall: road 54.8 and rail 51.2 give 56.4, which matches the
combined slice exactly. If the aviation fill value of 45.0 is wrongly added too, the
result is 56.7.

## Conflicts

1. **Day/night split.** The plan uses +1.5 / -5 (night share 11.8%). HUD guidance uses
   a 15% night share for roads and rails (+1.3 / -4.0, DNL = L24 + 3.7). The DNL
   differs by 0.55 dB. **Take HUD's 15%**, because it is sourced and is the default the
   HUD 45 dB goal itself is built on. Mark it `sourced` for road and rail and
   `placeholder` for aviation.
2. **BTS road time profile.** BTS spreads AADT evenly over 24 hours, which is a 37.5%
   night share. This does not change L24, which depends only on daily totals. But BTS
   offers no night value of its own. Apply E2 to the BTS number, and do not try to read
   a split out of BTS.
3. **2020 numbers or 2022/2023 classes.** The newer release is only public as color
   classes 5 to 10 dB wide. The 2020 release is public as numbers through Esri. **Take
   the 2020 numbers** for the model. Show the 2022/2023 class as a check in the UI if
   wanted. At City Hall they agree within one class.
4. **Official service or Esri copy.** The BTS 2020 services on geo.dot.gov fail (HTTP 500).
   The Esri copy is a republication under the Esri Master License Agreement, not a BTS
   service. Take the Esri copy, cite BTS as the data source, and cache the Houston tiles.
5. **Mode slices are offset by about one pixel.** In the tile tested, the combined slice
   sits one row (30 m) off the rail slice near a rail hotspot, so a sum of slices can
   differ from the combined slice at sharp edges. Read each mode from its own slice and
   sum them ourselves (E4). Do not mix in the combined slice.
6. **Web Mercator combined layer or Albers layer.** At City Hall the combined value is
   54.5 in the Web Mercator copy and 56.4 in the Albers copy. The Web Mercator copy was
   resampled after reprojection. Take the Albers layer, which is the native grid.
7. **RCNM Spec or Actual level.** The Spec column is the Big Dig contract limit. The
   Actual column is the average of field measurements, and RCNM lets the user pick
   either. Take **Actual where it exists**, because it is measured. Use Spec where Actual
   is "N/A". For impact pile driver and jackhammer, Actual is higher than Spec.
8. **Steep gradients near roads.** Pixels on a freeway reach 85 to 99 dBA. The value
   changes by more than 1 dB per 30 m pixel near major roads (mean |dx| over a downtown
   tile is 1.2 dB per pixel). Sample at the facade point, not the parcel centroid.

## Not found

- **Night share for Houston aviation (IAH, HOU).** Not found. The Part 150 noise exposure
  maps of the Houston Airport System should hold it. Fallback: use the HUD 15% as a
  `placeholder`. Aviation then gets the same split as road.
- **A numeric 2022/2023 BTS value.** No public numeric service was found, only PNG
  classes. Fallback: the 2020 numbers (E1).
- **Exact BTS download URL and file size for the CONUS geodatabase.** bts.gov returned
  403 to our client. Fallback: tile access (E1). Ishaan's agents can try a browser for
  the bulk file.
- **HUD Noise Guidebook text on the 15% default.** The PDF on huduser.gov returned an
  empty body. Fallback: the Indiana housing agency's HUD training slide (medium confidence)
  plus 24 CFR 51.106(a)(2), which uses the same 15% as its validity limit.
- **Current Houston construction hours.** Only a 1997 copy of Chapter 30 was readable.
  The 2022 amendments were not checked. Fallback: 07:00 to 20:00, marked `placeholder`.
- **Daily operating hours for construction equipment.** Unsourced. Fallback: assume work
  across the whole 07:00 to 20:00 window (13 h). That is the loudest legal case.
- **Active construction sites with coordinates.** The city publishes addresses only.
  Fallback: geocode the weekly .xlsx rows whose comments say new construction or
  demolition. CoStar under-construction records belong to R5 and were not checked here.
- **LERC decoding in the model environment.** The tiles need a LERC v6 decoder, and
  `numpy` plus `pyyaml` alone do not have one. Fallback options: (a) add the `lerc`
  package, which needs the team's approval to install; (b) Ishaan's agents cache the
  decoded Houston values as a small `.npy` or JSON grid in `samples/cache/`; (c) the
  typed-in `--road-dba` override already in the plan.
