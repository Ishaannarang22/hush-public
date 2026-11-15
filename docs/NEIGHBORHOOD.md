# Greenhouse Road neighborhood sound study

For verified provider availability, populated fields, capture dates and known integration gaps, read [SPONSOR-DATA-INVENTORY.md](SPONSOR-DATA-INVENTORY.md) first. Earlier implementation notes below may describe the initial two-layout demo.

Open `http://localhost:5175/lab/neighborhood` (also `/`). The existing apartment
lab remains at `/lab`.

The study crops the actual Greenhouse Road / I-10 corridor into a standalone
aerial view. All map camera presets start 40 degrees above ground. The full-bleed
map stays beneath the floating panels; the camera target stays inside the site while zooming out reveals a white cloud border. There is no raised tile base. The map and
apartment cutaway share the same scenario sources and coordinate transform.

The default analysis now uses Volterra 664 ft², Terra 1,036 ft² and Lenox 1BR (three layouts). See [MEASURED-WALL-ANALYSIS.md](MEASURED-WALL-ANALYSIS.md) for the wall inspector, opening controls and unobstructed comparison. Other tours can still be loaded on demand.

## Live and exported data

- **Vexcel live APIs:** `/structure/extract` supplies mapped footprints, building
  classification and available roof attributes. A bounded calculated query
  supplies six apartment-area roof heights; remaining heights are explicitly
  estimated. `/ortho/extract` supplies district and apartment aerial images.
  The current collection reports imagery captured **2025-12-19**. Live access
  does not imply live camera capture. The paged extract has 728 unique polygons
  before the crop removes boundary-crossing buildings.
- **CoStar sponsor export:** joins property IDs, addresses, unit names, scan IDs,
  construction classification and exterior photos. This is an export, not a
  live CoStar API. The private CSV and selected records stay in `work/costar-kit`.
- **Matterport live Model API:** retrieves room boundaries, heights, openings,
  tags and georeferencing. Two Volterra units have usable geometry: two-bedroom
  `oc9TWrb3VGs` (1,161 ft²), and one-bedroom `zzvymDx5ty7` (664 ft²).
  Neither layout is cloned or relocated. Tours at 2218 and 2040 Greenhouse lack
  boundary geometry in the API response, so their indoor results are unavailable.
- **Road geometry:** the saved TxDOT 2020 Roadway Inventory segment 365902 from
  `samples/sources.zzvymDx5ty7.json`, with both animation directions derived from
  its 19 measured centerline vertices. Lane offsets are illustrative. No
  OpenStreetMap data is loaded, retained in the served scene, or fetched.
  Highway/residential traffic and construction are disabled until independent
  route/site geometry is supplied. Canopy candidates are regenerated from the
  saved aerial image with the TxDOT road mask.

The runtime replaces the base dataset's FEMA buildings and Esri imagery with
Vexcel data. A Vexcel error is shown explicitly; it does not silently substitute
older map data. The base file still supplies roads, origin and canopy candidates.

## Server configuration

`web/server/vexcel.ts`, `web/server/neighborhood.ts` and `web/server/vehicle-data.ts` are Vite development
middleware, intended for this localhost demo. A production deployment needs
corresponding backend routes; a static `dist` upload alone will not provide them.

Set `VEXCEL_API_KEY` in the ignored `web/.env.local`. Matterport uses the existing
server-side Model API configuration. Never prefix credentials with `VITE_` or
include them in browser requests. API requests are bounded to this study and
restricted to localhost/same-origin GET routes:

- `/api/neighborhood/vexcel/scene` — buildings, imagery registration and provenance
- `/api/neighborhood/vexcel/imagery?detail=district|apartments` — JPEG imagery
- `/api/neighborhood/properties` — sanitized property records and live interiors
- `/api/neighborhood/vehicle-data` — shared noise-model vehicle spectra and provider status

Vexcel responses are cached for 24 hours in ignored
`work/neighborhood/vexcel-live/`; property responses use a five-minute memory
cache. The interior refresh button bypasses that memory cache. A `refresh=1`
query can refresh the Vexcel scene. Credentials are never returned by these routes.

## Propagation and interaction

### Real interior tours

The independent tour catalog now includes **7 CoStar properties / 53 tours** in
the existing crop: Terra at Park Row (7), Park Falls (5), Volterra (6), Greenhouse
(4), Caldwell (18), Radius West (6), and Lenox Katy Creek (7). Blue 360° map pins,
the property list, and georeferenced blue roof outlines open the actual Matterport
viewer. The tour selector includes apartments and amenities from the export.
Every tour also has an external Matterport link. Missing acoustic geometry does
not hide or disable a tour. The tour panel can load additional layouts with structured geometry. Thirteen
audited models pass importer validation; the active worker remains limited to
three layouts. Tours without structured boundaries still have unlocked MatterPaks
for a future reconstruction workflow.

Prepare the private, bounded catalog from the extracted sponsor kit:

```sh
python3 web/scripts/prepare-costar-tours.py --kit /path/to/costar-hackathon-kit
```

This joins CSV property/model IDs to real CoStar address coordinates and nested
attachment captions, writing only the selected public-facing metadata to ignored
`work/neighborhood/costar-tours.json`. `/api/neighborhood/tours` enriches names and
scan locations with live Matterport metadata in batches of 10, cached for five
minutes. All 53 model metadata requests succeeded during validation. Failed
metadata requests retain the original links rather than removing the property.
Only unique footprint containment of live scan coordinates creates a blue roof
outline. Property pins use CoStar's community coordinates; those alone do not
claim an exact tour building or add geometry to the acoustic model.

The modal reuses the lab's installed Showcase bundle and browser SDK key. It
falls back to the public Matterport embed if no SDK key is configured. API key
and token remain exclusively on the server.

### Indoor sound

Mint roof outlines identify buildings with usable live interiors. Clicking a
highlight or its 1BR/2BR button focuses the building and opens that sound view.
The highlights persist in satellite mode and with the 3D building layer hidden.
Both available scans associate with one Volterra Vexcel footprint. The 1BR room
probes fall inside it; the 2BR association is approximate (up to 7.3 m outside).
Nearby associations require every room probe within 10 m and a 5 m separation
from the next candidate's mean distance. Ambiguous, courtyard-only, distant and
geometry-free scans do not create highlights. This navigation association does
not move either scan or change the acoustic coordinate transform.

Cars and trucks follow mapped centerlines. Their rendered positions drive the
same outdoor point sources passed into the indoor solver. The construction
checkbox is disabled because no independently sourced construction site is available. Pause freezes the vehicle
positions and path pulses. Calculation may finish its current queued job first.

Select a real apartment, then a room. The cutaway shows its measured perimeter,
walls cut to 1.05 m for visibility, a 22×22 field sampled at 1.2 m listening
height, and animated direct/transmitted, reflected and diffracted routes from
the geometric acoustic solver. Labels are receiver-point values, not room
averages. Indoor routes are clipped to the apartment vicinity for display;
the map retains their complete source-to-receiver paths. Pulse speed is slowed
for illustration and is not an acoustic phase or wave-speed simulation.

The worker coalesces moving-source requests and keeps calculations off the
rendering thread. The one-bedroom unit includes the existing measured bedroom
window and sliding glass door survey, with an open/closed comparison. The
2-bedroom API geometry does not include a verified glazing survey.

Vehicle spectra now come from `noisemodel/vehicle_emissions.py`, which calls the
existing `outdoor.remel` function and `export_lab.spectrum_for`. Each car/truck uses
its own class and speed. Converting the model's 15 m pass-by reference to 1 m
preserves its level at the reference distance. The octave shape remains assumed.
This is an **instantaneous moving-point illustration**, not the hourly road Leq
or the coupled-room average. No aggregate road source is added to these vehicles.

Every rendered model has a stable source ID and shares its actual animated
position with the indoor solver. Receiver energies are summed once per enabled
source; the contribution list uses those same evaluations. The controls support
0–12 vehicles in each of three road groups, individual muting and isolation.
Zero vehicles produces no vehicle energy and clears old results. Pausing also
publishes the final displayed position. Scene export records the rendered fleet,
active emitters, per-source receiver results and calculated source IDs.

Vehicle counts, locations and classes remain **scenario inputs**. Greenhouse
Road's fallback speed is the saved TxDOT inventory's 96.56 km/h posted value,
whose count record is from 2016, not a current observed speed. Only this road is currently connected. The saved 13,626
AADT remains provenance; it is not a claim that this many cars are on screen.
The construction model remains extensible but has no active site.
Wall assemblies, missing thicknesses and ground-floor registration remain
assumptions. CoStar masonry classification does not identify every interior wall.

### Google provider connection

No Google credentials were available in the current checkout when this was built.
The UI reports **not configured** and makes no Google requests in that state.
With an authorized `GOOGLE_MAPS_API_KEY` (or `GOOGLE_ROUTES_API_KEY`) in the server
environment, the bounded adapter requests traffic-aware travel times for the two
Greenhouse Road directions. Derived route-average speeds feed both animation and
vehicle emissions. This supplies no individual vehicle locations or counts.
Google results are held in memory for five minutes, with no raw response on disk.
Errors are reported as unavailable and the speed provenance shows the fallback.

The Street View metadata request reports imagery date and availability using the
same key, or `GOOGLE_STREET_VIEW_API_KEY`. It does not extract vehicle observations
or infer live traffic from an old panorama. Connecting a dated vehicle inventory
requires an actual observation dataset; none is fabricated here. Provider keys
stay server-side. See [Google Routes traffic](https://developers.google.com/maps/documentation/routes/config_trade_offs)
and [Street View metadata](https://developers.google.com/maps/documentation/streetview/metadata).

**Current scope:** distance loss, frequency-dependent transmission through
interior walls/openings, first-order reflections and aperture-edge diffraction.
Surrounding-building shielding and tree attenuation are not included. No
quietness ranking or claimed vegetation benefit is fabricated. These results
are scenario estimates requiring calibrated sources and verified assemblies.

Export scene includes geometry, provenance, current source assumptions and
available receiver values. The default 3D view now uses the photographic Vexcel mesh described below.
The generated-building fallback remains approximate. Neither photographic
textures nor generated facades supply measured wall assemblies to the solver.

## Rendering

Ground imagery patches are tessellated without overlapping depth surfaces and
clipped to the study bounds. Windows and selection outlines have controlled
offsets, and the map camera uses an appropriate near plane. Vexcel polygons are
deduplicated across pages. Roof UVs use the same geographic transform as the
terrain. Vehicle and canopy models are instanced licensed assets; attribution
is available in the viewer and `web/public/neighborhood/assets/credits.md`.

## Verification

From `web/`, using Node 24:

```sh
node --test scripts/map-camera.test.mjs scripts/neighborhood.test.mjs scripts/propagation.test.mjs scripts/vehicles.test.mjs
npm run test:acoustics
npm run build
```

To include the local live interior fixture, set
`HUSH_SITE_FIXTURE=../work/neighborhood/live-apartments.json` on the first command.
Tests cover metre-scale registration, fixed-tilt presets, cropped terrain,
non-overlapping imagery, courtyard holes, traced-path energy conservation,
source muting, concave room probes, legitimate perimeter reconstruction around
wall stubs, interior route clipping and real two-bedroom import.

Vehicle integration tests additionally verify all rendered IDs/positions match emitters, 0/36-vehicle cases, per-vehicle energy in both real apartment layouts, exact energy addition, muting/isolation, and Google response adapters. Python tests verify 15 m normalization against the shared REMEL implementation. Run `python3 -m pytest -q tests fieldtests` from the repository root; explicit paths avoid collecting the separate checkout under `work/lab-main-merge`.


## Additional-property analysis (November 14)

The CoStar catalog contains seven properties / 53 tours. The geometry audit found
15 tours with boundaries; strict importer validation accepts 13: three Terra at
Park Row layouts, seven Lenox Katy Creek layouts, and three Volterra spaces
(including its fitness center). One Terra layout and the Volterra clubhouse have
opening dimensions outside their wall bounds and remain rejected. The 38 other
tours lack usable measured boundaries. Do not infer interior geometry from the
presence of a 3D tour or exterior mesh.

`GET /api/neighborhood/properties?modelId=...` accepts only a model in the local
CoStar catalog, fetches its measured geometry and caches it for five minutes.
The tour panel's **Analyze sound** action validates and adds that exact layout.
The selected layout plus at most two reference layouts run in the live worker;
all loaded layouts remain selectable. Missing/zero/nonfinite room heights fall
back to the documented 2.7 m assumption and are listed under data limits.
Invalid opening measurements are not resized to force a result.

The four moving Greenhouse Road cars are an instantaneous demonstration scenario.
They are not total site noise: other road corridors, construction, rail and
aviation are unconnected. Materials and floor registration retain their stated
assumptions. Comparative runs must retain source positions/time and assumptions.

Vexcel 3D Cities is the connected exterior visualization provider. Google 3D
is not required for the current site. Keep measured acoustic geometry and
material assumptions distinct from the visual mesh.

Regression checks: `node --test scripts/property-analysis.test.mjs` plus the
existing acoustic suite. Set `HUSH_GEOMETRY_AUDIT` to the private
`work/neighborhood/geometry-audit` directory to exercise the audited new scans.

Map interaction: the 3D viewing angle stays fixed while dragging. Left/right mouse drag and one-finger touch pan the whole map; wheel, middle mouse and two-finger pinch zoom. Rotation gestures are disabled. The Satellite button explicitly switches to the overhead view.

The cloud boundary is a decorative, non-interactive shader. It does not expand the
site or create usable terrain. Buildings, roads, trees, and construction geometry
remain cropped to `STUDY_BOUNDS`. Panning clamps the camera target to those bounds
without shrinking the view. Zoom-out reaches 6,000 m; mouse-wheel zoom follows the
cursor, and the overview preset shows the site in context. Tilt stays fixed.

## Vexcel photographic 3D mesh

The neighborhood's 3D view now streams **Vexcel 3D Cities**, collection
`us-tx-houstonr2-2023`, captured December 7–11, 2023. The sponsor key was verified
against `/v2/3d/collections` at the site, the collection tileset, and a binary glTF
tile. This is separate from the newer ortho imagery and structure measurements.

- `web/server/vexcel-3d.ts` proxies tilesets and model tiles using the existing
  server-only `VEXCEL_API_KEY`. Browser URLs contain no provider credentials.
  The proxy restricts the collection, paths and query parameters, filters child
  regions to the study envelope, and uses a bounded 128 MiB memory cache.
- `web/src/neighborhood/VexcelMesh.tsx` streams visible tiles with
  `3d-tiles-renderer`, converts ECEF to the map's east/up/south frame, clips the
  mesh at the existing study boundary and retains the cloud border. A road
  raycast aligns the visual ground datum; this is not surveyed elevation.
- The photographic mesh replaces generated facades and tree models after tiles
  become visible. Satellite mode retains the ortho map. If initial mesh loading
  fails, the UI explicitly identifies the approximate-building fallback.
- Preserve Microsoft and Vexcel attribution and the mesh capture date. Sponsor
  access is still required; a production deployment needs an equivalent server
  proxy, not a public browser key or a static copy of sponsor tiles.
- **Acoustics:** this change supplies visual exterior geometry only. The solver
  continues to use Vexcel footprints/heights, Matterport measured interiors,
  and stated material/opening assumptions. Photographic texture is not evidence
  of absorption or transmission coefficients. Do not claim the detailed mesh
  triangles are already used for sound propagation.

Verify with `node --test web/scripts/vexcel-3d.test.mjs`, `npm run build --prefix web`,
and the live `/lab/neighborhood` 3D view. The provider's integration example is
https://app.vexcelgroup.com/map/v2/doc/tutorial-third-party-cesium.html .
