# Frequency-aware acoustic lab

The `/lab` route uses a replaceable, object-oriented 3D propagation engine. It calculates eight octave bands (63–8000 Hz), then displays a selected band, an unweighted energy sum, or an A-weighted sum on the floor. The calculation is at listening height (default 1.2 m); floor projection is a visualization choice.

## Run

Use Node.js 24 and Python 3 from `web/`:

```sh
npm ci
python3 scripts/setup-matterport.py
python3 scripts/run-local.py
```

The hidden launcher prompt accepts JSON with `MATTERPORT_API_KEY`, `MATTERPORT_API_TOKEN`, and `MATTERPORT_SDK_KEY`. Credentials stay in process memory. Alternatively provide these through a secure environment and run `npm run dev -- --host localhost`. Open the printed URL at `/lab`. The read-only API middleware and supplied SDK entitlement are localhost-only; the static production build does not include a backend. Vendor Bundle files are downloaded separately and ignored by Git.

## Objects and contracts

`src/acoustics/engine/`:

| Object | Responsibility |
|---|---|
| `OctaveSpectrum` | Eight band values, energy sums, normalization, A-weighting |
| `AcousticMaterial` | Separate absorption, transmission and reflection energy budgets |
| `Opening`, `Wall`, `Floor` | Real 3D geometry, glazing/door patches, open apertures, intersections |
| `PointSoundSource` | Position and per-band SPL at 1 m |
| `AcousticScene` | Validated, prepared geometry and reusable spatial index |
| `SurfaceIndex` | Bounding-volume hierarchy for segment queries |
| `PropagationSolver` | Interface for alternate propagation engines |
| `GeometricAcousticSolver` | Transmitted, first-reflected and single-edge diffracted contributions |
| `AcousticGridJob` | Bounded receiver tiles, cooperative stepping, per-band output |
| `AcousticTransferCache` / `CachedAcousticGridJob` | Bounded per-source unit-energy transfer cache and exact spectrum remix |
| `MatterportSceneImporter` | Unit conversion and geometry/material provenance |
| `FacadeAssembly` | Area-weighted facade transmission from width/height-only surveys |

`SceneData`, `SourceData` and `GridRequest` in `domain.ts` and `grid.ts` are versioned JSON-safe input contracts. Coordinates are local metres with **y up**. Geographical coordinates need an explicit registration/ENU transform upstream. Source levels are sound-pressure spectra at 1 m, not sound power or a broadband dBA value. A single broadband measurement cannot uniquely determine eight bands.

The scene supports per-wall/per-floor/per-opening material IDs and supplied spectra. Treat it as immutable during a solve; create a new revision after changing geometry/materials. The browser demo uses global material selectors for convenience. Detailed pipelines can assign individual assemblies directly in scene JSON.

## Included physics and its limits

1. **Transmission:** intersect each actual wall/floor/ceiling. At a measured aperture, use glazing/door material or unity transmission for an open aperture. Multiply per-band energy transmission along the path. `tau = 10^(-TL/10)`.
2. **Reflection:** one specular image-source bounce on a valid wall, floor, ceiling or closed opening. Both legs include obstruction/transmission. The reflected energy coefficient is `1 − absorption − tau`; invalid negative energy budgets are rejected.
3. **Diffraction:** select the shortest viable single-edge air route around a wall end/top or open-aperture edge when direct sound is obstructed. Closed seams cannot count as air routes. With path excess `delta`, `N = 2 delta f / c`, screen attenuation is `10 log10(3 + 20N)`. Only the strongest route contributes, multiplied by the blocked direct-energy fraction, avoiding a full screen field being counted once per edge.
4. **Combination:** source and path energies add incoherently within each band. Point-source energy falls as inverse square distance, clamped inside 1 m. A-weighting is applied after propagation, not to the input geometry.

This is an **engineering approximation, not a validated indoor-noise predictor or a full-wave solver**. Maekawa–Tatge is a thin-screen approximation; applying it to finite aperture edges and complex room geometry is approximate. It does not model higher-order reflections/diffraction, reflection–diffraction combinations, coherent interference/room modes, diffuse scattering/late reverberation, porous impedance, structural flanking, real window seals, atmospheric absorption/refraction, weather or furniture. Abrupt transitions can remain near geometric visibility boundaries. Low-frequency indoor accuracy especially needs a wave solver or measurement validation. There is no claimed error bound.

Window width/height/position affect ray interception and available diffraction paths. The spatial engine does not yet integrate an extended vibrating facade as a distributed source; the separate `FacadeAssembly` provides the area-weighted diffuse-field reduction `−10 log10(sum(area_i * tau_i) / total_area)`. That reduction alone is not indoor SPL.

Wall thickness is retained as measured metadata. It is not independently converted into a transmission rating: a tested assembly spectrum is needed for that. Preset absorption curves are generic reference values and transmission spectra are explicit illustrative assumptions. Material identity cannot be inferred reliably from a photograph alone.

## Actual data included

- Displayed apartment `zzvymDx5ty7`: 29 unique wall edges with thickness, 6 doorways and 4 other openings. Four room heights are available; one is assumed 2.7 m and flagged. Dimensional fields declared imperial are converted from feet, while vector edges and openings are already metres. Aperture lower elevation is absolute model elevation, not an offset added to floor height.
- No windows are labeled in this apartment's API response. No windows are fabricated for it.
- The repository's **R10 Yale survey** for `D9CVkjeMoQx` is included in `data/yale-facades.json`, with original branch commit, source file, measured dimensions/sills and reported ±5 cm uncertainty. Its measured areas drive the facade comparison in “Measured Yale window dataset.” The manually measured dataset has six window records (including a transom) and one glazed-door record.
- The Yale API has room dimensions but no boundary polylines. Its manual CSV has research wall labels and no window-center offsets. The research's automatic wall extraction misses major glazing and has known false detections. These data have **not** been claimed to be a complete registered spatial scene. A reviewed mapping of wall endpoints, IDs and window centers is still needed before projecting those windows onto the Yale grid. Measurements are never transferred between property IDs merely because room IDs match.

Additional registered openings can be imported as JSON in “Measurements & assumptions”:

```json
{
  "schemaVersion": 1,
  "modelId": "YOUR_MODEL_ID",
  "units": "meters",
  "openings": [{
    "id": "survey-window-1",
    "wallId": "ACTUAL_EDGE_ID",
    "kind": "window",
    "centerFraction": 0.5,
    "widthM": 1.2,
    "heightM": 1.4,
    "lowerElevationM": 0.8,
    "evidence": {"kind": "assumed", "source": "Example only; replace with survey"}
  }]
}
```

The numbers above are schema examples, not measurements. The importer rejects mismatched property IDs, invalid units/dimensions, unknown walls and out-of-wall openings. Explicit imported IDs can replace an existing opening with that same ID.

## Scaling and execution

The browser worker retains a prepared scene/BVH and a 32 MiB LRU cache of raw unit-energy fields per source position, receiver grid, and propagation options. Changing volume or frequency spectrum remixes cached fields without tracing geometry; moving one source preserves the other sources’ fields. Scene/material/opening changes replace the cache. Exact zero energies are preserved until the final dB conversion, avoiding false contributions from a display floor.

While input changes, a preview uses 12 cells on the longest edge with all enabled physics and eight bands intact. After 180 ms without newer input, the selected 48/96/160-cell grid is refined. Only spatial sampling differs; the coarse preview can miss small spatial features and is labeled as such. An in-flight preview finishes so continuous dragging cannot starve the display; only the newest pending input is retained. Obsolete detailed jobs are cancelled, and scene revisions prevent stale results from appearing. Source volume changes reuse the detailed grid immediately when it is cached. Band/contribution display changes still reuse the current spectra.

The cache limit applies to retained transfer arrays; an active job additionally holds its input/output buffers. Cached paths assume the current omnidirectional, linear-energy source model. Future directional or nonlinear models must extend the cache key or replace this strategy.

A local CPU benchmark on the 29-wall apartment with three sources and 1,971 detailed samples measured 2.38 s for the original grid; a cold 124-sample preview took 151 ms, moving one source’s preview took 45–47 ms, and a cached volume remix at full detail took 4.6 ms. These are compute timings on this machine, excluding worker scheduling, rendering and browser overhead, not a universal frame-rate guarantee. Reproduce with exported local scene/request files:

```sh
node scripts/benchmark-live.mjs scene.json request.json
```

For larger offline runs, export a scene and provide a `GridRequest` JSON, then run:

```sh
node scripts/solve-acoustics.mjs scene.json request.json result.ndjson 4 32
```

The last arguments are local worker count and tile edge size. It prepares the scene once per worker and streams bounded tiles with global offsets to NDJSON. Output creation refuses to overwrite an existing file. A final `complete: true` record distinguishes complete output from interrupted output. All workers use the same physical scene: tile boundaries do not become artificial walls. The default maximum propagation path is unlimited; an explicit finite `maxPathLengthM` is an accuracy/performance truncation and remains in output metadata.

This is a scaling foundation, not a city-scale performance claim. First-order reflection and edge candidate enumeration still grows with scene complexity. Production needs spatial partitioning with conservative interaction bounds, distributed job orchestration, source/time aggregation, resumable caching and calibration. `PropagationSolver` can be replaced with a higher-order/native/full-wave backend without coupling it to Matterport or the renderer. The batch runner works locally now; no remote compute has been provisioned.

## Verification and references

```sh
node --test scripts/acoustic.test.mjs
npm run build
```

Tests compare free-field spreading, energy conservation, band transmission, window geometry/state, analytic image-source reflection, diffraction frequency behavior, sealed-joint rejection, aperture-edge paths, BVH versus brute force, tiles versus scalar evaluations, unit conversion, measured facade area calculations, cache-versus-uncached equality across all bands/components, cache invalidation and limits, and actual worker rapid-update/revision behavior. These are implementation/analytic checks, not field validation.

- [Matterport vector geometry and opening coordinates](https://matterport.github.io/showcase-sdk/modelapi_pi_vector_data.html)
- [Pyroomacoustics material reference](https://github.com/LCAV/pyroomacoustics/blob/master/pyroomacoustics/data/materials.json), drawing on Vorländer's *Auralization*. The 63 Hz absorption value is held at the 125 Hz value; missing carpet 8 kHz is held at 4 kHz. These extensions and all assignments are assumptions.
- [Maekawa–Tatge and other barrier approximations](https://www.mdpi.com/2079-3197/9/12/129)
- [FHWA acoustic fundamentals and A-weighting](https://www.fhwa.dot.gov/ENVIRONMENT/noise/noise_barriers/design_construction/design/design03.cfm)

No room suitability, health, regulatory compliance or precise improvement claims should be derived from this uncalibrated preview.
