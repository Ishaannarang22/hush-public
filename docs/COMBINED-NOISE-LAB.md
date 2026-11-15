# Combined environmental noise lab

The `/lab` page uses Alejandro's saved source export by default. Its eight-band equivalent sources drive the spatial engine; no indoor room-level reduction is subtracted a second time. Changes to source level, position, wall material, or opening state are recalculated by the existing cached worker. No Google request is made.

## Data and responsibilities

- `noisemodel/` and `assumptions.yaml`: the Python prediction model, preserved from `noise-model`. Generate exports with `python -m noisemodel.predict samples/property.zzvymDx5ty7.json samples/sources.zzvymDx5ty7.json --out samples/levels.zzvymDx5ty7.json --export-lab`. The web app loads saved results; it does not execute Python on every slider movement.
- `EnvironmentalSourceAdapter`: validates source JSON for the selected property and five time periods. Accepts road, construction, aircraft, rail, mechanical and other equivalent point sources. Each supplies a local 3D position, eight unweighted octave SPL values at 1 metre, enabled flag, ID and evidence. Empty periods stay empty. Emission conversion from traffic, train or flight records belongs upstream. Continuous line sources, flight trajectories and event-time integration are not implemented by labeling a stationary point.
- `samples/lab_sources.zzvymDx5ty7.json`: current input is one road, S Greenhouse Rd, with estimated levels from the saved traffic-count model. Frequency shape and equivalent position are assumptions. Archived count, speed and truck-share limitations remain in `samples/sources.zzvymDx5ty7.json`. This is not a live traffic feed.
- `samples/matterport_model_zzvymDx5ty7.json`: saved geometry shared with the Python model. The frontend needs no API call to build this floor plan. The Matterport 3D viewer still needs its SDK configuration and runtime.
- `samples/windows.zzvymDx5ty7.json`: measured bedroom window and glazed sliding door. Both default closed; API interior doorways retain their open default. The sliding door maps to assumed glazing, not generic solid door. Each surveyed opening can override material and state independently. Existing JSON without these optional fields remains supported.
- `ImportOptions.surfaceMaterials`: per-wall assignments, keyed by Matterport wall IDs. Other walls inherit the overall wall choice. The plan highlights the selected wall. Dimensions determine which aperture a ray intersects; material supplies per-band absorption and transmission. No universal dB reduction has been added.
- `/api/property-context`: localhost-only, GET-only dev endpoint reads the two selected CoStar records from ignored local data. Returns only model ID, building name, storeys and broad construction category. Does not infer every interior wall from masonry classification or expose the sponsor kit. Production needs a separate context provider.

## Two-property boundary

Volterra at West Lake has the spatial grid (5 rooms, 29 walls, surveyed window and glazed door). Yale is a second reference case with saved room predictions and the existing measured-facade panel. Its windows still need spatial registration before a full acoustic grid; geometry is not invented.

## Comparison and validation

Room predictions are reference baselines, not calibration measurements or values forced onto the grid. Comparison uses the A-weighted energy mean of total sound over each room's receiver slice, independent of the displayed frequency/component. Room-average predictions include coupling/reverberation that the geometric solver does not fully reproduce. Changed opening/material/source scenarios do not rerun the saved Python reference. Differences, including large ones in sheltered rooms, require validation rather than automatic fitting.

The adapter preserves exported bands, positions and evidence. Volume rescales all bands equally; earlier code ignored volume when an explicit spectrum existed. Changing time restores that period's source baseline. Imported sources are no longer clamped to the old 6 m demo margin.

Tests cover reference-wall level preservation, source kinds, invalid inputs, real opening registration, closed glass versus open transmission, per-wall isolation and averaging in energy. Python and field-test suites remain unchanged. Passing the original field test does not by itself validate the combined spatial solver for other assemblies or geometries.

## External data later

`web/public/templates/environmental-sources.json` is an empty contract. Populate each block with `SourceData` entries, optionally `name` and `kind`, in the unmirrored solver frame. Retain evidence. Traffic speed/congestion alone is not a sound level: emission adapters need applicable inputs such as counts, vehicle mix and speed, flight/train events or equipment operating levels.

Verified wall/window/door specifications and laboratory spectra can replace assumed materials. CoStar's broad construction classification is not a frequency-dependent acoustic measurement. Leakage, furniture, higher-order paths and late reverberation remain spatial-engine limits.
