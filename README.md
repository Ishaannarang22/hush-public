# Hush

## About this public copy

This is a public snapshot of the team's private repository, without its git history. A few licensed third-party files were left out:

- Raw Vexcel API extracts (`samples/vexcel_*.json`). The model's sample inputs cite them, but the files themselves are not included. The app fetches Vexcel data at runtime with your own key.
- Saved aerial imagery (`web/public/neighborhood/context|district|volterra.jpg` and their `.json` metadata). The neighbourhood page needs live imagery or its own copies of these files.


See how loud each room of a home will be at each time of day, before you rent or buy it. A HackPU project.

The verified sponsor-data inventory is [docs/SPONSOR-DATA-INVENTORY.md](docs/SPONSOR-DATA-INVENTORY.md). Read it before changing data integrations: it records actual CoStar fields, all 53 unlocked MatterPaks, measured windows, Vexcel access, and remaining integration gaps.

The plan lives in [docs/PLAN.md](docs/PLAN.md) and is also shown on the app's Plan page.

The real Greenhouse Road / I-10 neighborhood is at `/lab/neighborhood` (also `/`).
It includes mapped buildings, aerial imagery, roads, representative vegetation and
vehicle animation, with a link into the existing apartment acoustic lab at `/lab`.
See [docs/NEIGHBORHOOD.md](docs/NEIGHBORHOOD.md) for data sources, reconstruction
assumptions and the scene export. Each rendered vehicle now drives both apartment
interiors through the shared noise model's class/speed emissions, with individual
mute/isolate controls. Google traffic speed and Street View metadata adapters are
available when a server-side Google key is configured; vehicle counts/positions
remain explicit scenarios.

The [measured-wall workflow](docs/MEASURED-WALL-ANALYSIS.md) imports 120 wall segments across three real apartment scans, exposes their dimensions and per-wall material assumptions, and compares indoor sound with an unobstructed reference.

The [end-to-end noise model](docs/END-TO-END-MODEL.md) connects fresh outdoor emissions to measured walls, windows and doors, octave-band room predictions, and the live floor grid. Run it in `/lab` or with `npm run model` from `web/`.

## Acoustic lab and agent handoff

Start with [the lab handoff](docs/LAB-HANDOFF.md) for a clean checkout, the 5175 preview, Matterport overlay setup, CLI exports, the interactive artifact, tests, and extension points. Agent instructions are in [AGENTS.md](AGENTS.md).

## Stack

The web app is in `web/`: Vite, React and TypeScript.

Installed for the 3D and map work:

- `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`: 3D scenes, wireframe grids, effects
- `@deck.gl/*`, `@loaders.gl/3d-tiles`, `maplibre-gl`, `react-map-gl`: city map, flight paths, 3D tiles, heat map layers
- `@matterport/sdk`: embedded Matterport interiors
- `d3-scale`, `d3-scale-chromatic`: decibel to color scales
- `zustand`: shared state such as the time-of-day slider
- `react-router`, `react-markdown`: pages and the Plan page
- `@playwright/test`: browser checks

## Keys

Copy `web/.env.example` to `web/.env.local` and fill it in. Never commit real keys. Only `VITE_` variables reach the browser.

## Run

```bash
cd web
npm install
npm run dev
```

Full-catalog aerial sound map: [workflow, assumptions, and private data preparation](docs/PORTFOLIO-SOUND-MAP.md). Open `/lab/portfolio`.

Full local data and scan cache: [floor plans, listings, all-floor measurements and provenance](docs/PORTFOLIO-DATA-PIPELINE.md).

Photographic 3D and sound-field caching: [implementation guide](docs/VEXCEL-AND-SOUND-CACHE.md).
