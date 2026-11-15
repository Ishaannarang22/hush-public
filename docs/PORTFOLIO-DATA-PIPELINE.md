# Full property, floor-plan and measurement pipeline

Verified 2026-11-14. Open `/lab/portfolio` → select a property → **Floor plans & listing data**.
This extends the earlier lightweight atlas described in `PORTFOLIO-SOUND-MAP.md`.

## Completed inventory

| Data | Indexed / downloaded |
|---|---:|
| Geolocated properties | 5,204 |
| Residential homes / units after listing deduplication | 1,865 |
| Floor-plan records | 32,524 |
| Unit inventory records (including historical inventory) | 489,565 |
| Acoustic-relevant building-feature entries | 35,958 |
| Homes with structured feature entries | 1,835 |
| Properties with floor plans | 2,762 |
| Properties with linked listings | 4,069 |
| Floor-plan matches between property and rental listing, by ID | 23,755 |
| Listing-only floor plans without a matching property plan | 51 |
| Floor-plan media references | 33,828 |
| Floor-plan media references with supplied HTTPS URLs | 7,362 |
| Linked Matterport scan IDs checked | 14,930 |
| Scan measurement responses cached locally | 14,929 |
| Scans with at least one valid measured floor | 5,514 |
| Valid floors | 5,832 |
| Wall segments across valid floors | 230,118 |
| Rooms across valid floors | 47,374 |
| Labeled windows across valid floors | 13,956 |
| Doorways across valid floors | 39,704 |
| Rooms with assumed missing heights across valid floors | 12,404 |

These are different units of counting. A tour is not a house. A community can
contain several buildings; a unit inventory includes historical records. Wall and
room totals include all valid scanned floors, and can include repeat scans of the
same physical unit. They are not counts of unique physical walls across the cities.

Missing inputs remain explicit:

- Four source listing records lack usable coordinates and are excluded from the map.
- 8,155 scans lack usable structured boundaries or geographic registration.
- 1,260 scans have no valid floor under the importer's current geometry checks.
  Across all models, 2,669 individual floors failed checks; some of those scans
  still have another valid floor. 8,436 floors lack required geometry/registration.
- `zten2ECqDuX` remained unavailable in the account after retry. No geometry was
  invented for it.
- Plan attachments without a URL retain their attachment IDs. We did not invent
  CDN links or claim those images were downloaded. The complete original ZIP is
  retained privately. The bulk download retrieves structured Model API geometry,
  not all MatterPak point clouds, photo albums, textured meshes or plan images.

## Data joins and provenance

Five datasets are read in full: commercial-property (3,339), apartment-listing
(1,747), residential-listings (2,120), residential-listing-features (1,899), and
commercial-listing-summary (1,022). The two tour CSVs provide the property/scan joins.
Financial transactions, tenant contact information, and company records are not
converted into acoustic measurements or source emission levels.

- Commercial property ID joins apartment and commercial listings.
- Floor-plan ID joins `propertyApartment.models` to `apartmentModels`; names alone
  never establish a match. Conflicting source values are preserved and shown.
- Residential listing ID joins structured features; property ID deduplicates homes.
- Explicit Matterport attachment IDs establish plan-to-scan links (3,203 links).
- Unit numbers, per-unit dimensions and plan associations are retained. Units
  without a precise geolocation remain attached to their property, without invented
  positions on the aerial map.
- Every property has an on-demand private dossier with source record IDs, all plan
  records, all retained unit inventory, features, listing metadata, media references,
  and scan availability. The map does not repeatedly transfer these larger dossiers.

## What now affects calculations

**Measured geometry:** 1,195 residential properties use a measured representative
room area from their directly linked valid scans. Across apartment floor plans,
486 plans have valid measured areas through explicit scan attachments. Select such
a plan to use its measured representative room area. The representative area is a
mean measured bedroom area, or the largest measured room when no bedroom tags are
available, on the scan's selected valid floor. It is a screening input, not a claim
that the whole unit has identical acoustics.

**Floor-plan sizes:** the property default uses a unit-count-weighted plan size where
weights are supplied, otherwise a mean available plan size. A selected plan uses its
listed size. This replaces the earlier error-prone community-sized receiving-room
proxy. Unmeasured room subdivisions remain explicitly assumed.

**Listing features:** unambiguous carpet-only or hard-floor descriptions select a
provisional frequency-dependent floor absorption profile. Mixed/unknown coverage
keeps the fallback. Source area, octave energy sums and exterior exposure are not
changed by these interior choices. Wood/stone/tile profiles remain generic assumed
hard-floor coefficients, not tested materials.

Glazing, insulation, doors, roofs, construction and HVAC descriptions are retained
as evidence. Low-E or energy-efficient windows do not justify an invented acoustic
rating, glazing thickness, window area, or fixed dB bonus. Exact wall/window assembly
transmission coefficients still require specifications or calibration.

**Detailed scans:** selecting a usable tour reads its cached measurement data.
Every valid floor is selectable, retaining measured elevations. Invalid floors are
listed but disabled. Detailed calculations keep the existing frequency-dependent
transmission, reflection and diffraction solver. The city-wide map remains a fast
envelope estimate, not simultaneous full wave simulation of every scan.

A baseline now captures the selected floor-plan input as well as sources and
settings. The worker keeps property arrays resident and receives only changed
arrays; source edits do not resend the complete catalog each time.

## Reproduce or refresh

From repository root (Node 24 and Python 3):

```sh
# Supply COSTAR_KIT_PASSWORD in your local environment if the ZIP is encrypted.
python3 web/scripts/prepare-portfolio.py --kit work/costar-hackathon-kit.zip
node web/scripts/cache-portfolio-geometry.mjs
node web/scripts/cache-portfolio-geometry.mjs --retry-errors
node web/scripts/index-measured-properties.mjs
```

The downloader uses configured Matterport credentials or those already supplied to
the authorized local Vite server. It never logs or writes credentials. Three bounded
request queues fetch batches of ten models with timeouts, retries, rate-limit
backoff, atomic checkpoints, and a single-process lock. Rerunning skips completed
entries; `--retry-errors` retries account/network failures. The offline index must
run after downloading, and validates every floor before attaching measured areas.
If preparation is rerun, rerun the offline index to reattach measured profiles.

Private files, ignored by Git:

- `work/neighborhood/portfolio.json`: lightweight property catalog and coverage.
- `work/neighborhood/property-data/`: 5,204 complete property dossiers.
- `work/neighborhood/measurements/<model>.json`: cached raw geometry and validation.
- `work/neighborhood/measurements/manifest.json`: resumable progress and floor index.

Local-only API (same host/origin restrictions as other sponsor routes):

- `/api/neighborhood/portfolio`: lightweight enriched catalog.
- `/api/neighborhood/portfolio?property=commercial:9160550`: property dossier and
  per-scan measurement status. Unknown IDs are rejected; paths are never user input.
- `/api/neighborhood/portfolio?status=1`: compact download/index status.
- `/api/neighborhood/properties?modelId=...`: cached measured unit, falling back to
  a live request only on cache miss. Only sponsor-linked model IDs are accepted.

## Checks

- Python join tests: exact IDs, conflicts, complete unit retention, missing media
  URLs, feature provenance, mixed floors and no fabricated glazing coefficients.
- JavaScript: octave normalization, energy addition, distance spreading, material
  sensitivity, all-property coverage, measured/assumed profile application, real
  Volterra plan joins, opening validity and upper-floor elevation preservation.
- Production build passes. Main screening benchmark remains roughly 11–14 ms for
  the regional browser scenario; this is a local observation, not a guarantee.
