# Matterport measurements → walls → indoor sound

The neighborhood lab now starts with three actual scanned apartment layouts:

| Property / model | Rooms modeled | Wall segments | Labeled / surveyed windows | Doorways including surveyed glazed door |
|---|---:|---:|---:|---:|
| Volterra 664 ft² / `zzvymDx5ty7` | 5 | 29 | 1 | 7 |
| Terra 1,036 ft² / `4a9K7eimQDB` | 13 | 54 | 6 | 7 |
| Lenox 1BR / `BPtsRg1smtt` | 6 | 37 | 0 | 0 |

These are all imported physical wall segments on the selected scan floor, not a
claim that every hidden wall in the entire building was captured. The Lenox scan
has four generic openings; the absence of labeled windows/doors is incomplete
semantic data, not evidence of a windowless or doorless apartment. Missing heights
remain flagged: one room in Volterra, two in Terra, one in Lenox. Their 2.7 m
fallback is an assumption. Invisible room dividers are not physical walls.

## Measurements and analysis

The existing Matterport adapter obtains endpoint coordinates, wall thickness,
room heights/elevations, openings' widths/heights/sills and relative wall positions.
Dimension fields are converted from their declared units; vector coordinates use
metres. Shared edge IDs are deduplicated. Invalid openings still fail validation.
The original Volterra survey supplies its window and glazed sliding door.

`wallMeasurements(scene)` returns the exact surfaces sent to the solver, with
length, height, thickness, gross area, opening dimensions and provenance. The
**Wall measurements** panel lets the user select a segment, see it highlighted,
and change its assumed material. This recalculates the room probes and floor
heatmap; selecting a segment alone does not rerun physics. Material selections
are isolated by scan and wall ID. A scan does not identify acoustic coefficients
or hidden wall assemblies, so the material tables remain explicit assumptions.

Both window and door state are now editable. Ordinary doors start closed as a
scenario assumption; generic openings remain open. The Volterra glazing toggle
controls its surveyed window and glazed door together. Other scans' window
controls use their own labeled windows. These settings apply to the shared
comparison scenario, not a claim about observed door/window state.

The worker evaluates the same sources at the same receiver positions twice:
with all imported apartment surfaces, and with those surfaces removed. Each room
shows the indoor dBA and difference from this **unobstructed reference**. The
reference is not a facade reading, background-noise measurement, STC rating or
room-average level. Floors and ceilings are removed along with walls. Reflections
can sometimes make the modeled indoor value exceed the reference, so the UI
supports either direction. Frequency-dependent transmission, first-order
reflections and aperture-edge diffraction remain in the existing solver.

**Download walls + current analysis** exports measured geometry, material
assumptions, source definitions, scenario settings and room/reference values.
If a calculation is pending, unavailable values are null rather than stale.
Only the selected layout and at most two reference layouts calculate live.
Additional catalog tours remain available on demand.

## CoStar context

The neighborhood adapter now decodes every documented construction enum, retains
the construction-complete year, and supplies selected property records on the
on-demand path as well as initial load. WoodFrame is no longer dropped. It is
shown as building context; it does not automatically turn every interior wall
into that structural material. The private selected property file now includes
all seven crop properties plus the existing Yale context. To reproduce that
selection, join the catalog's property IDs against the sponsor commercial-property
JSONL; keep existing Yale records. Do not put the raw export in public assets.

## Verification and limits

Build: `npm run build --prefix web`.
Tests: `node --test web/scripts/property-analysis.test.mjs web/scripts/acoustic.test.mjs`.
Set `HUSH_GEOMETRY_AUDIT` to the private `work/neighborhood/geometry-audit` directory
to run the real Terra window check and additional-layout fixtures. Tests confirm
that opening a measured window increases direct transmitted energy in every
band without changing wall dimensions, and that a material override affects
only its selected wall/model. Existing geometry, vehicle and propagation tests
also pass.

A fixed four-car scenario at animation time zero was run for all 24 room probes,
with closed and open glazing plus the unobstructed comparison. The user outputs
`hush-measured-wall-analysis.json`, `.md`, and `hush-measured-walls.csv` retain the
results and all 120 wall measurements. They estimate only those scenario sources,
not total ambient noise. Very low values do not establish a quiet real apartment.

For the 38 tours lacking structured room boundaries, unlocked MatterPaks provide
a route to reconstruct walls. The existing `research/R10-scripts` and R10 report
provide elevation/point-cloud methods, but a mesh-to-wall reconstruction still
requires registration and review of occlusions, mirrors, openings and party-wall
versus exterior-wall classification. That reconstruction has not been fabricated
or claimed complete in this change. The Vexcel mesh remains a visual exterior
layer; adjacent-building acoustic shielding and terrain propagation are separate
remaining integrations.
