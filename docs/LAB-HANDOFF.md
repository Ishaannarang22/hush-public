# Acoustic lab: setup and agent handoff

This is the starting point for continuing work on the lab from `main`. The branch
integration includes Alejandro's Python noise model, measured geometry and opening
adapters, source dragging in the 3D overlay, the cached/progressive grid worker,
fresh octave-band room predictions, the local API and CLI, and the offline
interactive explanation. The current main integration also includes the neighborhood map and full property atlas. Read [Portfolio data pipeline](PORTFOLIO-DATA-PIPELINE.md), [Vexcel and sound caching](VEXCEL-AND-SOUND-CACHE.md), and [Neighborhood setup](NEIGHBORHOOD.md) for those routes and their private-data setup.

## Start from a clean checkout

Use Node 24+ and Python 3.11. From the repository root:

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-model.txt
export HUSH_PYTHON="$PWD/.venv/bin/python"
cd web
npm ci
npm run dev -- --host localhost --port 5175 --strictPort
```

Open `http://localhost:5175/lab`. The saved geometry, source estimates, room
calculation and 2D floor map work without sponsor credentials. `HUSH_PYTHON` selects
the Python executable spawned by Node; otherwise it uses `python3` on PATH. Keep
that variable set when running the server, model CLI, artifact builder and Node
pipeline tests. Check `python3.11 --version`: macOS may resolve plain `python3`
to an older interpreter that cannot install these dependencies. If port 5175 belongs to another agent's preview, use another port
rather than stopping it.

The selected apartment is Volterra at West Lake, model `zzvymDx5ty7`: five rooms,
29 walls, one surveyed bedroom window and a surveyed sliding glass door, plus the
scanned doorways/openings. Yale (`D9CVkjeMoQx`) has a fresh legacy room-model CLI path
and saved UI reference values; it does not yet have registered geometry for a grid.

## Enable the Matterport 3D floor overlay

From `web/`, run `python3 scripts/setup-matterport.py` to install the pinned official
SDK runtime into the ignored `public/matterport-bundle/` directory. Supply an
existing authorized `MATTERPORT_SDK_KEY` (or `VITE_MATTERPORT_SDK_KEY`) to Vite via
its environment or ignored `.env.local`, then restart the preview. The SDK key must
allow the localhost domain. The overlay uses the embedded model, so it needs
network access. Never copy credentials into source, docs, screenshots, or commits.

`MATTERPORT_API_KEY` and `MATTERPORT_API_TOKEN` are server-side credentials for live
Model API requests; the saved apartment inputs do not need them. API tokens must
never use a `VITE_` prefix. CoStar context in
`work/costar-kit/selected-acoustic-context.json` is optional local data: a clean
clone falls back to the saved property assumptions and still runs. Do not invent
per-wall materials from a building-level construction label.

The older `scripts/run-local.py` launcher prompts for credentials and defaults to
5173. The explicit Vite command above is the documented 5175 path.

## Run and export fresh predictions

From `web/`, with `HUSH_PYTHON` still set:

```sh
npm run model -- --out ../outputs/volterra
npm run model -- --request ../samples/pipeline.environmental-demo.json --out ../outputs/five-source-demo
npm run model -- --model D9CVkjeMoQx --out ../outputs/yale
npm run artifact:model -- ../outputs/hush-interactive-model.html
```

The model CLI exports `run.json` and `report.md`, and scene/source files when spatial
geometry exists. The standalone artifact bundles fresh outdoor scenarios and the
same browser room/path solvers in one HTML file; it also creates the local route
`/model-walkthrough.html`. Regenerate it after model/data changes. The artifact does
not call Python or fetch traffic feeds when opened.

`POST /api/acoustics/run` accepts JSON with `modelId`, `sourceInputs`, `openings`,
`scenario`, `block` and optional `grid`. For example:

```sh
curl -sS http://localhost:5175/api/acoustics/run \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"zzvymDx5ty7","scenario":{"wallMaterial":"concrete"},"grid":{"resolution":24}}'
```

Omitting `sourceInputs` selects the saved sample; `sourceInputs: {}` means no sources.
The two templates in `web/public/templates/` serve different purposes: emission
inputs rerun the pipeline, while equivalent point-source imports drive the grid.
Moving sources in the UI changes the path grid only; room means remain tied to
emission inputs. The UI labels that difference.

## Where changes belong

| Responsibility | Entry point |
| --- | --- |
| Dataset catalog, property rebuild, Python emission stage | `noisemodel/pipeline.py` |
| Road/construction/aircraft/mechanical emissions and outdoor shielding | `noisemodel/outdoor.py` |
| Legacy room/facade predictions and field-test path | `noisemodel/predict.py`, `rooms.py`, `facade.py`, `fieldtest.py` |
| Export outdoor estimates as point sources; shared band shapes | `noisemodel/export_lab.py` |
| Fresh end-to-end orchestration and optional grid export | `web/server/pipeline.ts` |
| Area- and frequency-dependent coupled-room energy balance | `web/server/room-energy.ts` |
| Local endpoint, cancellation, request limits | `web/server/api.ts`, `web/vite.config.ts` |
| Geometry/opening import and assumed material spectra | `web/src/acoustics/engine/importer.ts`, `materials.ts` |
| Direct transmission, first reflection, single-edge diffraction | `web/src/acoustics/engine/solver.ts`, `geometry.ts` |
| Progressive calculation and per-source transfer cache | `web/src/acoustics/field.worker.ts`, `engine/cache.ts`, `engine/grid.ts` |
| Lab controls, model status and room comparison | `web/src/pages/AcousticLab.tsx`, `acoustics/PipelinePanel.tsx`, `ModelComparison.tsx` |
| 3D floor rendering and source dragging | `web/src/acoustics/overlay.ts`, `source-drag.ts` |
| Offline walkthrough and its bundler | `web/artifacts/` |

The flow is source inputs → outdoor wall levels → measured scene → room balance
and/or geometric grid → display. Source spectra have eight unweighted octave-band
SPL values at 1 m, from 63 Hz to 8 kHz. Coordinates are local metres with y up.
Materials carry separate absorption and transmission-loss spectra with evidence.
Open aperture transmission depends on area, not a fixed whole-room dB deduction.

## Verify a change

From the repository root:

```sh
.venv/bin/python -m pytest -q tests fieldtests
export HUSH_PYTHON="$PWD/.venv/bin/python"
cd web
npm run test:acoustics
npm run build
npm run model -- --out ../outputs/check
npm run artifact:model -- ../outputs/check-walkthrough.html
```

The merge baseline is 123 Python tests and 37 passing Node tests; one optional
private-fixture benchmark is skipped. New tests may increase these counts. Include
at least the relevant analytical/regression checks for changes to propagation or
energy calculations. Do not equate passing software tests with real-world accuracy.

For changed UI behavior, verify the relevant cases in `/lab` or the walkthrough:

- Opening the measured window changes the room mean and grid; closing it restores
  the original scenario. Geometry/material edits trigger a fresh room result.
- Muting all sources leaves no modeled room energy; there is no invented background.
- Frequency selection changes the displayed bands; total A-weighting happens after
  energy addition. Reflection/diffraction controls affect the path grid only.
- Rapid source edits preserve the latest worker result; an old calculation must not
  replace newer state. 3D handles should drag on the floor once the SDK is ready.
- Aircraft omission from the grid, assumed materials, and edited-source comparisons
  remain visible. Yale must not be shown as having a full spatial model.

## Known boundaries and next work

Google/live traffic is deliberately unconnected. A provider should populate the
existing emissions contract; a congestion value is not itself a sound level. Rail
currently accepts outdoor levels rather than a train-count emission calculation.
Aircraft feed room facade estimates but not the point-source grid. Roof paths,
seal leakage, flanking transmission, furniture, higher reflections and pressure
interference remain outside the new combined solver. Only two survey-identified
exposed walls inject exterior noise into Volterra's room balance.

Room energy balance and the path grid estimate different quantities; do not add
them, fit one to the other silently, or describe the original field test as validating
the new combined model. Material spectra remain illustrative assembly assumptions.
The original room-model demonstration uses two reference properties. The portfolio atlas includes 5,204 geolocated properties, with measured interior coverage and envelope-only estimates labeled separately; see the portfolio documentation for current counts and limits.

The local API is a Vite development-server plugin. `npm run build` produces static
client assets, not a production Python backend. A production deployment needs an
authenticated service for the pipeline; do not expose the development endpoint as
that service. The generated HTML explanation is independently usable without it.

For equations and limitations, read [END-TO-END-MODEL.md](END-TO-END-MODEL.md).
For legacy calibration and field tests, read [VALIDATION.md](VALIDATION.md) and
[INTEGRATION.md](INTEGRATION.md). [ACOUSTIC-LAB.md](ACOUSTIC-LAB.md) documents the
geometric solver and [LAB_EXPORT.md](LAB_EXPORT.md) its source export contract.
