# Hush agent entry point

Before changing the acoustic lab, read [docs/LAB-HANDOFF.md](docs/LAB-HANDOFF.md).
It contains setup, architecture, verification, and the boundary between implemented
behavior and missing data. The completed lab, fresh model pipeline, and interactive
walkthrough are part of `main`; do not rebuild them from an older feature branch.

## Working together

- Inspect Git status and remote changes before editing. Preserve other agents' dirty
  files and running previews. Use an isolated worktree when integrating branches.
- Start new work from current `origin/main` on a `codex/` branch unless the user says
  otherwise. Do not force-push shared branches.
- Keep credentials, raw sponsor downloads, downloaded SDK bundles, and generated
  exports out of commits. Saved sample data is not permission to publish additional
  sponsor data or broaden access to it.

## Model contracts

- No speech sources. Traffic, construction, rail, aircraft, and mechanical equipment
  are the environmental source types; the Google/live traffic connection remains open.
- Preserve geometry units, model/wall/room IDs, source provenance, and eight octave
  bands. Sum independent energies, not decibels.
- Room balance and geometric path-grid predictions are alternatives. Do not sum them
  or silently normalize one to the other.
- Distinguish measured geometry from assumed materials, source spectra, opening
  states, and source placement. Do not present the legacy field test as validation
  of the combined solver.
- Keep coverage limits visible: Volterra has spatial geometry; Yale has reference
  room predictions. Aircraft are absent from the point-source grid.
- For physics, pipeline, or integration changes, run the relevant analytical and
  regression tests described in the handoff, plus the web build. For UI changes,
  verify the affected controls in a browser.

## Neighborhood and portfolio atlas

For `/lab/neighborhood` and `/lab/portfolio`, also read `docs/PORTFOLIO-DATA-PIPELINE.md` and `docs/VEXCEL-AND-SOUND-CACHE.md`. These document the full-catalog joins, local data prerequisites, photographic imagery, measured-floor coverage, and cache invalidation. Portfolio colors are envelope screening estimates; the visual Vexcel mesh is not an acoustic shielding model. Moving sound particles were removed intentionally.
