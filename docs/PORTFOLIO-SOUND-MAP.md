# Photographic imagery and caching update

The atlas now defaults to Vexcel photographic 3D where coverage exists and reuses cached per-source acoustic fields. See [Vexcel and sound cache](VEXCEL-AND-SOUND-CACHE.md) for current behavior, limits and validation.

# Full CoStar property sound map

**Update:** [Full data pipeline](PORTFOLIO-DATA-PIPELINE.md) supersedes the initial data/area assumptions below: floor plans, listings and measured room areas are now joined; all linked Model API measurements have been attempted and cached where available.

Open `/lab/portfolio`, or choose **All properties** in the neighborhood header.
The existing Vexcel aerial/photographic map remains at `/lab/neighborhood`.

## Verified scope

The local export has 5,459 commercial-property / residential-listing records.
After merging residential listings by CoStar property ID and excluding four
records without valid coordinates, the private catalog contains **5,204 properties**:
3,346 in Texas (Houston view), 1,858 in California (Los Angeles view), including
1,865 residential homes. It links 14,930 distinct Matterport IDs. These counts are
not interchangeable: an apartment community may contain multiple buildings and
many unit tours. Commercial/residential cross-dataset identities are not inferred
from proximity or similar addresses.

All geolocated properties enter the regional render and screening calculation;
there is no three-property limit. Search shows up to 40 matching buttons, but does
not limit the map or analysis. Select the region, use **Show entire region**, zoom
and pan, or search an address. All points have real CoStar locations. Their boxes
are illustrative massing: total floor area / reported stories, or explicit
fallbacks (160 m² total, 2 stories), 3 m per story and a 1.4 aspect ratio. No
measured footprint, building orientation, or reconstructed room plan is claimed.

## Use

1. Choose a property or search for an address. Its panel shows the indoor screening
   estimate and the outdoor reference at its property center.
2. Select a source; adjust level / height, toggle it, or click **Move source on map**
   and click the ground/property. Dragging still pans. Sources cannot be placed on
   the cloudy area outside the region boundary.
3. Add traffic, construction, aircraft, rail, or mechanical scenario sources.
   These are editable point-source demonstrations, not live Google traffic or
   measured emissions. A-weighted source levels are specified at 1 metre.
4. Save a baseline, edit sources or assumed envelope parameters, and choose
   **Change from baseline**. Blue means lower, red higher; no-source totals are
   unavailable rather than an invented ambient level.
5. Choose a linked Matterport scan and **Analyze measured interior**. The server
   allows only IDs in the sponsor catalogs. It fetches measurements on demand,
   rejects missing registration/room boundaries and invalid geometry, and uses
   the existing detailed solver for the selected scan with the same placed sources.
   Measured interior results are shown separately; they do not silently replace
   the property-level approximation. A tour without boundaries remains a tour,
   with an explicit reconstruction-needed message.
6. **Export analysis** downloads the regional property data, source spectra inputs,
   assumptions, baseline sources/settings and screening results. Sponsor data
   stays private locally; do not commit exported sponsor records to Git.

## Two calculation levels

`EnvelopeScreeningModel` runs in `portfolio.worker.ts` and sums eight octave bands
in energy with spherical spreading. It computes wall/glazing transmission by
area-weighted transmission coefficients, then a simplified receiving-room term
`4 * facadeArea / equivalentAbsorptionArea`. Assumed wall assembly, glazing share,
window state and receiving absorption are explicit settings. Listed floor area
and story count influence the proxy dimensions. CoStar structural material is
shown as context, not silently treated as a verified acoustic wall assembly.

This is **screening**, not a validated whole-building or environmental noise map.
It excludes reflections, diffraction, air/ground absorption, surrounding-building
shielding, terrain, actual roof/window geometry, background noise and operating
schedules. In particular distant-source values have large uncertainty; they are
scenario contributions, not total urban noise. The single massing/receiving-room
proxy is particularly crude for multi-building apartment communities.

Detailed analysis uses `GeometricAcousticSolver` with measured room boundaries,
frequency-dependent transmission, first-order reflections and edge diffraction.
Existing importer assumptions and opening checks remain. It is fetched lazily,
not thousands of authenticated scan requests on page load. On the portfolio page,
only the selected measured interior is solved, and only while its detail panel is
open. The original neighborhood retains its three-layout comparison.

## Data preparation and running

From the repository root, with the sponsor ZIP downloaded privately:

```sh
# Set COSTAR_KIT_PASSWORD in your local environment for encrypted kits.
python3 web/scripts/prepare-portfolio.py --kit work/costar-hackathon-kit.zip
npm --prefix web run dev -- --port 5175
```

`work/neighborhood/portfolio.json` is ignored by Git. The preparation script reads
both entire JSONL datasets and both CSV tour joins from the archive, whitelists
only location/property/size/tour fields, merges repeated residential listings,
and reports rejected coordinates. No contacts, transaction prices, credentials,
or signed download URLs are exported. `/api/neighborhood/portfolio` serves the
catalog only to localhost, with the same host/origin restrictions as other local
sponsor endpoints. This is a local Vite API; a static production build alone does
not host these sponsor endpoints. Missing private data produces an explicit error.

## Implementation and validation

- `portfolioModel.ts`: typed catalog/source/envelope contracts, geographic projection,
  spectrum normalization, source energy summation, screening model and color scale.
- `PortfolioCanvas.tsx`: instanced property meshes plus persistent-size overview
  points, fixed aerial camera, bounded placement, geographic selection.
- `Portfolio.tsx`: catalog search, region navigation, source controls, baseline,
  latest-result worker handling, exports, measured-scan drill-down.
- `server/neighborhood.ts`: minimal private catalog serving and full-catalog model
  whitelist, on-demand metadata and geometry loading with caching.

Run `node --test web/scripts/portfolio.test.mjs` and `npm --prefix web run build`.
The tests verify energy addition, 6 dB distance doubling, frequency sensitivity,
source normalization, window state, absent sources, projection, and all 5,204
private catalog properties when installed. Local benchmark: approximately 9–11 ms
for all 5,204 properties with one source; browser regional scenario + baseline
(3 sources each) approximately 10–11 ms. These are local observations, not an SLA.

Live browser verification also covered a new Los Angeles home outside the original
neighborhood: 505 S Barrington Avenue, Unit 302 (`tXngcWm7trk`) imported 78 wall
segments and 17 regions, then produced room results from a source placed 50 m east
of the CoStar property location. Another scan at the same address failed the
opening-fit validation and showed its reconstruction-needed message. Availability
of boundaries alone is therefore not presented as a guarantee of valid geometry.
Residential unit numbers are preserved in property search and reported stories
are used where supplied (511 residential properties); coincident unit locations
remain at their recorded coordinates, without artificial geographic offsets.
