# End-to-end environmental noise model

Hush now runs fresh inputs through Alejandro's outdoor emissions model, measured apartment geometry, frequency-dependent surface transmission, a coupled-room energy balance, and an optional spatial grid. No live traffic provider is connected. No speech source is included.

## Interactive explanation artifact

From `web/`, run `npm run artifact:model -- ../outputs/hush-interactive-model.html`.
This creates a self-contained offline HTML walkthrough and a local preview at
`/model-walkthrough.html`. It bundles the same room and geometric solvers, measured
geometry, and freshly computed outdoor levels for the sample traffic and illustrative
five-source scenarios. No credentials, CDN scripts or provider network requests are
needed to use it. A browser worker computes the 24 × 24 path grid.

The four stages explain emissions, wall/opening transmission, coupled-room energy,
and sound paths. Source toggles, relative source strength, time, wall/floor materials,
opening states and window width update the result. The frequency selector, clickable
rooms and path-energy shares make individual effects inspectable. Outdoor emissions
are baked into the artifact at build time; it does not rerun Python or fetch live data
when opened. Regenerate it to incorporate new source records or model changes.

## Run it

Use Node 24+ and Python 3 with `numpy` and `PyYAML` installed. From `web/`:

```sh
npm run dev -- --port 5175
npm run model -- --out ../outputs/end-to-end-volterra
npm run model -- --request ../samples/pipeline.environmental-demo.json --out ../outputs/environmental-demo
npm run model -- --model D9CVkjeMoQx --out ../outputs/end-to-end-yale
```

The CLI writes `run.json`, `report.md`, and, when spatial geometry exists, `scene.json` and `sources.json`. `run.json` includes the inputs, material spectra, measured geometry, provenance, warnings, five time periods, octave-band room results, optional grid, run hash and timings. Hashes identify input scenarios, not software versions; archive the Git revision with a result used for research.

At `/lab`, **End-to-end noise model** runs automatically. Changing wall/floor materials or opening dimensions/states recalculates the room results. The existing worker updates the floor grid progressively. Moving a source changes the grid; the room balance continues to use the emission-input scenario and is labeled accordingly. Changing time selects the corresponding precomputed period. Imported equivalent point sources are a grid-only scenario; imported emission inputs rerun the complete model.

**Download room calculation** exports the last completed room/emissions run. Use the CLI to also export a spatial grid. The local POST endpoint is `/api/acoustics/run`, accepts JSON, and uses the same orchestrator. It is available in the Vite development server, not a static production deployment. It has a 1 MB request limit, two concurrent calculations, process/output limits and a timeout. No supplied executable or filesystem path is accepted.

## Computation

1. `DatasetRepository` reads the registered property data. `NoiseModelPipeline` rebuilds Volterra's rooms and partitions from Matterport and the window/door survey. CoStar stories and construction class are retained as building context. A class such as “Masonry” does not assign tested acoustic coefficients to every surface.
2. Alejandro's model computes hourly incident exterior-wall levels from road traffic, construction, rail-level inputs, aircraft events or mapped aviation levels, and mechanical equipment. The existing field-test path is preserved; measured validation readings never override normal emissions in this pipeline.
3. Broadband emissions are distributed into eight assumed octave bands (63–8000 Hz), normalized to preserve their A-weighted total. Python supplies the same source-shape table to the room solver and spatial export. Source shapes are assumptions, not spectra recovered from a broadband measurement. Rail and aircraft currently use the road-shaped fallback.
4. `MatterportSceneImporter` constructs walls, floors, ceilings and apertures, with editable material spectra. Open doors/windows have transmission coefficient 1 over their actual area; closed openings use their assigned material. The room solver rejects overlapping openings and clips wall/door areas to each room's vertical extent. Wall thickness is retained, but transmission loss comes from an assumed assembly spectrum, not automatically from thickness alone.
5. `RoomEnergyModel` solves a coupled linear energy balance separately for each band and time block. For room i:

   `[(A_i + T_ext,i + sum_j P_ij) E_i] - sum_j(P_ij E_j) = F_i`

   `A_i = sum(surface area × absorption coefficient)`; `P_ij` and `T_ext,i` are sums of area × transmission coefficient. `F_i` sums incident exterior energy × transmission area × the existing model's incidence factor. The default +3 dB incidence convention is explicit in the run; it is not a fixed building noise reduction. Transmission in both directions allows neighboring rooms to feed energy back. No background noise is invented when sources are absent.
6. The geometric solver computes the listening-height grid with direct transmission, first-order specular reflection and single-edge diffraction. Each path propagates all eight bands, then independent source/path energies are summed and A-weighting is applied. Low-frequency diffraction and high-frequency transmission therefore differ. The heatmap is a receiver-height slice drawn on the floor, not a wave-pressure simulation at floor level.

The diffuse room estimate and geometric grid are **alternative estimates**. Their energies are never added or fitted to each other. Early paths alone do not reproduce a diffuse reverberant mean. The distinction is visible in the room comparison table.

The room balance follows the standard energy-exchange approach described in [Ansys room acoustics](https://ansyshelp.ansys.com/public/Views/Secured/corp/v261/en/ans_thry/thyacous_room.html) and [COMSOL coupled-room acoustics](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_geometrical_aco.11.56.html). This implementation is a lumped, steady-state approximation; it does not solve their full spatial diffusion equations. The existing geometric solver and its analytic tests remain responsible for reflection/diffraction behavior.

## Inputs and coverage

The request supports `modelId`, `sourceInputs`, `openings`, `scenario`, `block`, and optional `grid`. Omit `sourceInputs` to use the saved sample scenario; use `{}` for no sources. The empty template at `/templates/emission-inputs.json` intentionally produces no modeled noise.

| Input | Current handling |
| --- | --- |
| Roads | Existing AADT/speed/truck/geometry emission model, or mapped road level + bearing/distance. Google data must be converted to these fields upstream. Congestion alone is not a sound level. |
| Construction | Equipment list, coordinates and active blocks; existing equipment emission factors and operating-hour assumptions. |
| Rail | Existing outdoor rail level and geometry/bearing/distance. A train-count/speed emission adapter is not implemented. |
| Aircraft | Existing flight-event or mapped aviation model feeds facade room predictions. Aircraft are explicitly omitted from the point-source grid. A registered overhead/roof propagation model remains future work. |
| Mechanical | `id`, `lat`, `lon`, `level_at_1m_dba`, `height_m` (default 1.5), `duty_fraction` (default 1), optional `active_blocks`, required `evidence`. Point-source spreading is clamped at 1 m; operation contributes `10 log10(duty)` to its time-averaged level. |
| Materials | Generic absorption and transmission-loss spectra in `engine/materials.ts`; per-wall and per-opening assignments. Replace with tested assembly data when available. |
| Windows/doors | Width, height, position, elevation, state and material. Missing leaf/seal details remain assumptions. |

Volterra (`zzvymDx5ty7`) has five rooms, 29 walls, a measured 1.60 × 1.59 m window and 2.40 × 2.02 m sliding glass door. The other scanned doorways/openings also contribute. Yale (`D9CVkjeMoQx`) runs the fresh legacy room model, with an explicit “no spatial geometry” result. The UI shows Yale's saved reference separately. This is a two-property demonstration, not an automatic whole-neighborhood batch.

Only the two survey-identified exposed Volterra walls inject outdoor energy into the room balance. Other unclassified apartment boundaries absorb sound but do not inject adjacent-unit noise. The grid uses equivalent sources outside the loudest wall; those coordinates approximate road/rail lines and do not constitute a surveyed geospatial registration.

## Extension points and limits

- Add property catalog entries through `DatasetRepository`; preserve stable wall/room IDs and register coordinates before spatial computation.
- Add provider adapters ahead of `sourceInputs`. All source data stays explicit and replaceable; the pipeline makes no provider network calls.
- Add or replace material spectra and evidence in the material catalog. Absorption and transmission are distinct coefficients.
- `EnvironmentalNoisePipeline` orchestrates stages; `RoomEnergyModel` and the existing `PropagationSolver` separate physics from storage and rendering. The existing tiled multi-core `solve-acoustics.mjs` accepts exported scenes and grid requests for larger jobs. The interactive API limits grids to 96 cells per edge.
- Geometry and material hypotheses are not a validated acoustic assembly survey. Seal leakage, flanking paths, neighboring-unit sound, roof aircraft paths, furniture, higher-order reflections, phase interference and room modes are not included in the new octave room balance/grid. Diffuse-field assumptions are especially weak at low frequencies in small rooms.
- The earlier field test remains a validation of its original model and configuration. It does not validate the combined solver or establish a confidence interval for these new predictions.

## Checks

```sh
python3 -m pytest -q
cd web
npm run test:acoustics
npm run build
```

Tests cover analytic one-room and two-room energy conservation, aperture area, frequency-dependent loss, spectral normalization, empty inputs, a complete measured-apartment run, mechanical duty/distance/energy addition, night-only sources, invalid geometry/requests, and the existing propagation and field-test regressions.
