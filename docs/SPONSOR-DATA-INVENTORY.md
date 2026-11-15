# Sponsor data inventory — verified November 14, 2026

**Full-catalog implementation update:** [Portfolio data pipeline](PORTFOLIO-DATA-PIPELINE.md) now joins all floor-plan/listing data and caches 14,929 scan responses; 5,514 scans have at least one valid floor. See that report for current counts and remaining gaps.

Read this before making claims about what CoStar, Matterport or Vexcel supplies.

**Subsequent implementation update:** [Measured wall analysis](MEASURED-WALL-ANALYSIS.md) now starts with three scans / 120 wall segments, exposes measurements and assumed per-wall materials, and computes unobstructed comparisons. The construction-enum and on-demand property-context gaps recorded in the original audit below are resolved. Floor-plan/feature priors, general MatterPak reconstruction and exterior shielding remain pending.
This audit supersedes early availability statements in `research/R5-data-layers.md`
and the older reconstruction notes in `docs/NEIGHBORHOOD.md`.

## What was actually checked

- Opened the supplied `work/costar-hackathon-kit.zip`; parsed **every record in all
  eight JSONL datasets** (139,915 records). Counted populated field paths, read the
  bundled schemas, model documentation and integer-enum dictionary. The inventory
  distinguishes schema possibilities from populated records. Zero/Unknown enum
  values are not evidence of a known material.
- Counted both CSV starter lists and inspected the full records of all seven
  properties in the existing Greenhouse Road crop. This was an inventory, not an
  expansion of the live simulation beyond the existing three-layout limit.
- Queried the live Matterport account count and dimensions/bundle availability for
  **all 53 neighborhood models**. Re-examined the 53 saved geometry responses from
  today's earlier audit and the existing point-cloud/window research.
- Obtained an authenticated byte-range from the downloadable MatterPak ZIP of
  Park Falls model `8Ds6MwLWdLX`, which has no structured room boundaries. Its
  archive directory contains `cloud.xyz`, a textured OBJ/MTL, JPG textures,
  `colorplan.pdf`/JPG and `ceilingcolorplan.pdf`/JPG. Only the ZIP directory was
  fetched; no claim is made that its rooms/windows have been reconstructed yet.
- Queried live Vexcel coverage at (-95.7051799, 29.7955898) for 3D, DSM, DTM,
  oriented imagery, ortho imagery, property and structure products: all returned
  HTTP 200 with coverage. Downloaded bounded 64×64 DSM and DTM GeoTIFF extracts.
  Actual 3D glTF tiles and ortho/structure extraction were also verified during
  the map integration. Coverage queries were capped at ten results per product;
  this is not an exhaustive historical collection list or account-wide entitlement audit.
- Traced current runtime consumers, rather than assuming that available data is
  already used by the sound solver.

Private reproducible evidence is in `work/sponsor-audit/`: `inventory.json`
(record counts and per-dataset populated field paths), `selected-seven-properties.jsonl`,
`matterport-account.json`, `matterport-bundles.json`, `matterpak-pilot.json`,
`vexcel-coverage.json`, `vexcel-extract-pilot.json`, and the two small elevation
extracts. No API credentials or signed download URLs are in those evidence files.
The audit scripts remain local scratch files. Sponsor raw files remain outside Git.

## 1. CoStar export: actual datasets

| Dataset | Verified records | Data supplied | Useful to Hush |
|---|---:|---|---|
| Commercial property | 3,339 | Addresses and geographic coordinates; property type; construction classification and events; stories; floor areas; parcels; parking; amenities; building photos; apartment models and units; Matterport links | Property identity, building context, era/material priors, scan-to-unit joins |
| Commercial listing summary | 1,022 | Lease/sale marketing, offered spaces, areas, rates, attachments, linked property IDs | Available spaces and additional scan/media joins |
| Location occupancy | 74,093 | Tenant locations, occupied space, tenancy periods and recorded lease information | Potential neighboring-use context; not measured noise emissions |
| Company detail | 49,575 | Tenant-company locations, business/industry classifications and profiles | Potential source-category context; not source level or operating schedule |
| Commercial sale comp | 6,120 | Completed sales, properties included, prices and transaction attributes | Later property/value comparisons; not acoustic physics |
| Apartment listing | 1,747 | Apartments.com community listings, year built, unit/floor-plan sizes, bed/bath counts, rents and availability | Unit comparison and selecting a real floor plan |
| Residential listings | 2,120 | Home listings with location, age, size, rooms, structured features, media and Matterport IDs | Detached-home/condo inputs and links to real scans |
| Residential listing features | 1,899 | Readable feature names/values with sources, grouped feature text and derived totals | Window, flooring, construction, insulation and HVAC descriptions where present |

The export covers Houston and Los Angeles; it is a dated export, not a live CoStar
feed and not every building in those cities.

Starter-list counts independently checked:

- Commercial CSV: **13,147 rows, 3,339 properties, 12,994 distinct nonempty scan IDs**.
  Multiple scans per property explain repeated rows. The kit documents 51 properties
  without scans. There are 2,765 apartment communities within the commercial set.
- Residential CSV: **2,224 rows, 2,120 listing IDs, 1,938 distinct nonempty scan IDs**.
  The kit identifies 1,867 homes; listings and scans are not unique houses.
- The live Matterport account reports **14,945 models**. This account total is a
  separate inventory; it is not the number of verified, ready-to-simulate houses.

Join commercial records using `PropertyId → commercial-property.id`; join their
scan IDs through the CSV and the matching Matterport attachments. Apartment
listings join on `propertyId`; apartment floor plans join on `apartmentModels[].id`
to `propertyApartment.models[].id`. Residential features join on MLS listing `id`.
Do not join by a similar-sounding unit name alone. Areas are generally ft² in
CoStar, while the imported scan geometry uses metres.

### Populated acoustic-relevant fields

Across 3,339 commercial properties, **2,464 have a nonzero construction-material
classification** and **3,327 have a positive above-grade story count**. Construction
event years are populated in 3,331 records. There are 32,473 nested apartment
floor-plan records. These are descriptions and contextual measurements, not
complete wall assemblies.

The residential feature dataset contains these feature labels in actual records
(counts are listing records, not unique homes and not the seven apartment properties):

| Feature label | Listing records containing the label |
|---|---:|
| Double Pane Windows | 79 |
| Low Emissivity Windows | 361 |
| Energy-Efficient Windows | 363 |
| Insulated Doors | 109 |
| Energy-Efficient Insulation | 240 |
| Brick Exterior Construction | 964 |
| No Common Walls | 177 |
| Tile Flooring | 1,026 |
| Wood Flooring | 530 |

Also present: other floor/roof materials, wall/ceiling descriptions, central and
window-unit HVAC, shared-wall counts, and unit-entry-floor descriptions. A feature's
source and boolean/value must be preserved; a missing feature is not a confirmed
absence. Low-e or energy-efficient glazing does not specify an acoustic rating.
These residential records must not be applied to unrelated apartment communities.

### Confirmed context for the seven properties already on the map

| Property | CoStar completion year | Stories | Construction code decoded | CoStar floor-plan records | Tours |
|---|---:|---:|---|---:|---:|
| Terra at Park Row | 1983; renovation completed 1999 | 3 | WoodFrame | 21 | 7 |
| Park Falls Apartments | 1984 | 3 | Masonry | 6 | 5 |
| Volterra at West Lake | 2014 | 3 | Masonry | 8 | 6 |
| Greenhouse | 2017 | 4 | Unknown | 11 | 4 |
| Caldwell | 2019 | 4 | WoodFrame | 11 | 18 |
| Radius West Apartments | 2019 | 4 | Unknown | 10 | 6 |
| Lenox Katy Creek | 2024 | 3 | Unknown | 8 | 7 |

All seven have property photos and construction-event context. Six have records in
`apartment-listing.jsonl`; Terra does not, although its commercial-property record
still supplies floor plans. The material enum is 0 Unknown, 1 Masonry, 2 Metal,
3 ReinforcedConcrete, 4 Steel, 5 WoodFrame, 6 Brownstone, 7 Limestone. Masonry is
building-level context: it does not mean every interior partition is masonry.

## 2. Matterport: actual geometry and unlocked assets

**All 53 neighborhood tours have an unlocked `mp:matterpak` bundle and a ZIP asset.**
Missing structured boundary polygons does not mean a missing mesh or point cloud.
The Park Falls download check above verifies this distinction on a previously
unsupported tour. The official bundle description lists OBJ/MTL, colored point
cloud, reflected ceiling plan and photogrammetry floor plan:
https://developers.matterport.com/api/model/ordering-addons/

Current neighborhood coverage:

- 53 models / 258 returned rooms.
- 15 models have structured boundaries and geographic registration; 108 rooms
  have boundaries. The saved geometry has 569 edges after deduplication by edge
  ID within each model; all have positive API thicknesses (0.02–0.22 m).
  These are API estimates, not an independent survey of wall assemblies.
- 13 models pass the existing strict importer. Two fail opening-within-wall
  validation; 38 lack structured boundary geometry. Mesh reconstruction is a
  possible recovery path, not something already completed or guaranteed accurate.
- Unique structured openings: **12 windows, 67 doorways, 31 generic openings,
  8 dividers**. Counts are deduplicated within each model, not across scans of
  potentially overlapping physical spaces. Window fields include width, height,
  sill elevation and relative position on a wall.
- All 12 labeled windows are in four Terra scans: 6 in `4a9K7eimQDB`, 3 in
  `fHDCqmJJdsT`, 2 in `iA4JF6Mbk8R`, and 1 in `no7hKNuhfXq`. The three windows
  in `fHDCqmJJdsT` belong to a model currently rejected by validation. Thus nine
  are in currently accepted models; the bad model needs review, not silent resizing.
- Fresh dimensions query: floor area on 200 rooms, wall area on 198, width on
  178, depth on 169, height on 152 and volume on 162. Not all 258 rooms have every
  dimension. Model-level floor area is present on 52/53 models and volume on 49/53.
- Defurnished bundles report unlocked for 15 models, unavailable for 38; their
  downloadable contents were not inspected in this audit.
- E57, schematic floorplans, BIM, standard CAD, separately listed OBJ bundles and
  **exterior drone splats** report unavailable on all 53 models. This does not
  negate the OBJ inside the unlocked MatterPak. Advanced imagery reports locked
  on 33 and unavailable on 20. No add-ons were purchased or unlocked by this audit.

Existing measurements also matter:

- `samples/windows.zzvymDx5ty7.json` contains a **1.60 × 1.59 m bedroom window**
  and **2.40 × 2.02 m glazed sliding door** derived from the Volterra MatterPak,
  with uncertainties and occlusion notes. These are not direct CoStar CSV fields
  or automatically labeled Matterport windows. Glazing build-up is unknown.
- `research/R10-window-geometry.md` and `samples/R10_yale_exterior_walls.csv`
  contain earlier Yale wall/window measurements and a point-cloud workflow.
  Automatic detections had false positives from mirrors/occlusion and require
  confirmation. Raw MatterPaks from that research were deleted from scratch;
  retained measurements and methods are available.
- The SDK supplies interactive tours, camera/scan positions and room boxes.
  Room boxes are not a substitute for complete wall polygons.

## 3. Vexcel: confirmed access at this site

| Product | Verification | Current use / opportunity |
|---|---|---|
| 3D Cities mesh | Collection + binary glTF fetched and rendered | Actual visual exterior mesh now used |
| Ortho aerial imagery | Coverage + district/apartment extracts | Map/satellite imagery used |
| Structure attributes | Coverage + paged structure extraction | Footprints, classes, selected heights and roof attributes used |
| Property/parcel data | Site coverage; prior Yale property extract retained | Parcel/tree-cover/context available; not fully integrated in the current solver |
| DSM (surface elevations) | Site coverage and 64×64 GeoTIFF downloaded | Potential terrain/building/obstruction heights; not yet in acoustic propagation |
| DTM (ground elevations) | Site coverage and 64×64 GeoTIFF downloaded | Potential sloping-ground datum; not yet in acoustic propagation |
| Oriented / oblique imagery | Site coverage returned for nadir and oblique directions | Side views for visual assessment; image extraction not tested in this audit |

The 3D collection is `us-tx-houstonr2-2023`, captured **December 7–11, 2023**.
Coverage also reports newer ortho/DSM/oriented collections, including
`us-tx-houston-2026` (collection capture range December 2025–January 2026).
The site's existing ortho response has a December 19, 2025 estimate. The DTM
coverage returned `n29w95-us-tx-houston-2025`. Collection date ranges are not
per-pixel capture dates. Do not subtract DSM/DTM or merge local/ECEF heights
without checking datum, units, resolution, capture date and alignment.

**Time mismatch:** Lenox's CoStar construction-complete event is April 2024,
later than the December 2023 3D mesh. Do not treat that historical mesh as a
complete present-day representation of Lenox. Retain the property date and use
newer structure/height data and verified interiors when modeling the current site.

Official product/API context:
https://vexceldata.com/products/
https://vexceldata.com/stories/api-2-0-improve-your-workflow-with-new-features/
https://app.vexcelgroup.com/map/v2/doc/tutorial-third-party-cesium.html

## 4. What the application really consumes, and the gaps

| Data | Current implementation |
|---|---|
| CoStar property/model joins and names | Tour catalog uses seven properties / 53 real scan IDs |
| CoStar construction context | Original apartment pipeline reads the two-property selected context; neighborhood server recognizes only code 1 as Masonry, dropping other material classes |
| CoStar context on newly loaded tours | On-demand `loadPropertyUnit(unit, env)` receives no property records, so story/material/photo enrichment is missing there |
| CoStar age, renovation, floor-plan, residential features | Mostly not connected to neighborhood acoustic inputs |
| Structured Matterport boundaries/openings | Imported where available; strict validation excludes malformed layouts |
| MatterPak meshes/point clouds | Used in earlier surveys; no general importer for the other 38 boundary-free models |
| Room materials in neighborhood solver | `makeApartments` still defaults to plasterboard walls, generic floor and glass, doors open; it does not assign measured assemblies from CoStar |
| Vexcel visual mesh | Rendered, but its triangles are not used for acoustic reflection/shielding |
| Surrounding buildings, DSM, DTM | Not yet used for neighborhood acoustic shielding/ground propagation |
| Real emissions | Traffic counts/positions and source spectra remain scenario inputs; CoStar does not supply a measured environmental-noise time series |

Relevant code: `web/server/neighborhood.ts`, `web/scripts/prepare-costar-tours.py`,
`web/src/neighborhood/simulation.ts`, `web/src/acoustics/engine/importer.ts`,
`noisemodel/pipeline.py`, `web/server/vexcel.ts`, `web/server/vexcel-3d.ts`.

No building-specific frequency-dependent absorption/transmission coefficients,
complete wall-layer assemblies, exact glazing thickness/air gaps, leakage/seal
measurements, verified open/closed state, or calibrated outdoor source time series
were found in the audited datasets. Literature material tables can be used as
explicit assumptions informed by real features; they are not sponsor measurements.

## 5. Integration order

1. Preserve full CoStar context for every selected unit, decode all enums, join
   dates/floor plans/photos, and retain known/unknown/provenance. Remove the
   code-1-only and on-demand-missing-context gaps before claiming materials are used.
2. Use the existing structured Terra windows and verified Volterra survey. Keep
   per-opening dimensions and confidence; validate the two rejected scans.
3. Pilot the existing MatterPak reconstruction method on **two or three layouts**,
   including Park Falls, with manual checks for windows, mirrors, exterior/party
   walls and scan registration. Do not bulk-simulate thousands of units.
4. Add date-aware exterior obstruction geometry and a checked terrain datum from
   structure/DSM/DTM data. Keep the visual mesh's role distinct until its geometry
   is actually used by the propagation engine.
5. Add source observations later through the existing traffic/construction/rail/
   aircraft/mechanical adapters; preserve scenario labels until real data arrives.

An audit of availability is not an implementation of these remaining steps.
