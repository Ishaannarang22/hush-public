# Photographic map and reusable sound fields

Implemented November 14, 2026. Open `/lab/portfolio` on the local Vite server.

## Photographic rendering

The all-properties view now defaults to actual Vexcel 3D Cities textured mesh.
This is separate from the measured Matterport interiors and acoustic assumptions.
The map retains the fixed 40-degree aerial camera, panning, source placement,
property picking, cloud boundary and all 5,204 catalog locations. Colored markers
show sound estimates without repainting the photographic building textures.

A server-side coverage lookup runs for the regional demo location or selected
property. It chooses the newest returned 3D collection (up to 20 results), not a
newer orthophoto misrepresented as 3D. Live checks confirmed:

- Houston demo: `us-tx-houstonr2-2023`, December 7–11, 2023.
- Central Los Angeles: `us-ca-losangeles-downey-2020-2021`, November 21, 2020
  through January 20, 2021.

These checks do not establish complete coverage for every catalog property.
Collection dates and availability appear in the UI. Missing coverage/service
failures explicitly retain the schematic fallback. Historical imagery may omit
recent buildings, such as a property built after the capture date. The visual
mesh does not supply wall materials or automatically become acoustic shielding.

High quality is the default (3-pixel screen-space error), with Ultra (1.5) and
Balanced (7). Tiles stream according to camera visibility and detail. Portfolio
mode disables sibling/ancestor preloading to avoid downloading an entire city
before rendering visible detail. The entry budget accommodates metadata trees;
the decoded tile cache is bounded to 320 MiB. The server keeps a separate 128 MiB
mesh-response cache and coalesces identical requests. Private browser HTTP caching
lasts one hour. No bulk city mesh archive is downloaded.

The provider key remains server-side. Local GET endpoints validate host/origin,
coverage coordinates and collection allowlists. Child URLs must resolve inside
Vexcel's 3D API; credential query parameters are stripped before reaching browsers.
`/api/neighborhood/vexcel/3d/status` reports response-cache sizes without credentials.

## Sound caching

`PortfolioFieldCache` computes each enabled source at a reference level, normalizes
its eight-band contribution and caches the result for every property. Volume edits
rescale and sum linear energy; muting skips that field. Moving a source computes
only its new contribution. Current and baseline scenarios share the cache.

Keys use SHA-256 over model-version, actual acoustic property inputs, origin,
envelope settings, source position/height and source family (which selects its
frequency spectrum). Source names/IDs, level and enabled state are intentionally
not part of the physical field key. Future measured/custom spectra or directivity
must be added to the source field key when introduced. Increment
`PORTFOLIO_CACHE_VERSION` when physics, source spectra or material tables change.
Do not mutate property arrays in place: the worker hashes immutable input snapshots.

- In-memory LRU: conservative 32 MiB budget.
- IndexedDB (`hush-source-fields`): 24-hour expiry, maximum 64 fields / estimated
  64 MiB. Cached values remain local to this browser origin.
- Expired entries are ignored and pruned on the next write. Storage failures fall
  back to memory. This cache is temporary and does not retain data indefinitely.
- Queued slider messages are coalesced; the latest requested scenario wins.
- Footer reports source-field reuse and new computations.
- The existing detailed interior solver retains its separate geometry/path cache.
  This change does not turn portfolio envelope estimates into full city-scale
  diffraction/reflection simulations.

When actual traffic/aircraft/construction data arrives, replace the demo sources
with normalized source records. Fields are populated lazily on first use and reused
on future edits/reloads. No future observations are fabricated or precomputed now.

## Validation

Build: `npm run build --prefix web`.

Tests: `node --test web/scripts/portfolio-cache.test.mjs web/scripts/vexcel-3d.test.mjs web/scripts/portfolio.test.mjs`.

Tests compare cached and original eight-band results, source moves/volume/muting,
input invalidation, persistence across cache instances, bounded eviction, storage
failure and proxy restrictions. Browser checks confirm actual photographic mesh
rendering and volume edits with zero newly computed source fields.

Official integration documentation:
https://app.vexcelgroup.com/map/v2/doc/tutorial-third-party-cesium.html
