# Project plan

## The idea

Before you rent or buy a home, see how loud each room will be at each time of day.

We combine sponsor property data (CoStar, Matterport, Vexcel) with measured noise sources (road traffic, aircraft, construction) and a physics model to estimate the sound level in every room. The result is a 3D view of the building and its surroundings, with a per-room heat map and a time-of-day slider.

Tracks: CoStar sponsor track, plus Sustainability as the main track (noise pollution is environmental pollution, and trees and green space reduce it).

## Team

| Area | Owner |
|---|---|
| Pitch | Ishaan |
| 3D representation (frontend) | Ishaan |
| Heat map frontend | Chinmay, Shreyansh |
| Data pipeline | Shreyansh |
| Noise model | Alejandro |

## Ground rules

- Real, measured data only. No made-up source levels or traffic numbers. Every number in the demo should trace back to a dataset.
- Aircraft are a core feature, not a stretch goal, and need real flight tracks.
- 3D first. The outside view and the inside view are both 3D.
- API keys live only in a git-ignored `.env.local`. Never commit them.

## Architecture

```
 sources                pipeline (Shreyansh)       model (Alejandro)        frontend
 -------                --------------------       -----------------        --------
 CoStar extract   --+                                                       3D city + flights
 Matterport rooms --+-> property.json         --+                          (Ishaan)
 Vexcel aerial    --+   (building, rooms,       |                                ^
                        facades, windows)       +-> noise model --> levels.json -+
 ADS-B tracks     --+                           |   (dB per room                 v
 Road traffic     --+-> sources.json          --+    per time block)       room heat map
 Permits, trees   --+   (roads, flights,                                   (Chinmay, Shreyansh)
                        construction, barriers)
```

The three JSON files are the contract between areas, so each person can work in parallel against sample files before the real data is ready.

### Data contract (draft, to agree on first)

- `property.json`: property id, address, lat/lon, building footprint and height, floors, and for each room: id, name, floor, polygon, area, exterior walls with compass direction, window area, wall and window construction.
- `sources.json`: road segments (geometry, daily volume, truck share, speed by time block), flight tracks (positions with altitude and time, aircraft type), construction sites (location, active hours), barriers (buildings, tree cover).
- `levels.json`: for each room and time block, the predicted indoor level in dB(A), with a breakdown by source (road, air, construction) so the UI can explain why a room is loud.

Time blocks: overnight (00-06), morning rush (06-10), midday (10-16), evening rush (16-20), evening (20-24).

## Data sources

### Sponsor data

| Source | What we expect | Used for |
|---|---|---|
| CoStar data extract | Property records: location, building type, year built, floors, units, construction | Choosing properties, construction type |
| Matterport GraphQL + SDK | 3D interior scans, rooms, dimensions, windows; embeddable 3D viewer | Room geometry and the in-home 3D heat map |
| Vexcel API | High-resolution aerial and oblique imagery, elevation, building footprints and heights | Distances, barriers, tree cover, building height |

To check first: which cities the CoStar extract covers and which of those properties have Matterport scans. The demo city is where they overlap.

### Aircraft (core feature)

- **OpenSky Network**: ADS-B flight tracks with position, altitude and time. Free account; historical data for research use.
- **FAA aircraft registry**: maps each aircraft (tail or ICAO address) to its type and engines.
- **EASA aircraft noise certification database**: certified noise levels per aircraft type and engine. Gives a measured source level per flight.
- **Airport noise monitors**: real dB readings near the airport, used to check our model. LAX publishes noise monitoring data; Houston Airport System has a noise office. Confirm what is downloadable.

### Roads

- **State DOT traffic counts (AADT)**: average daily volume per road segment, often with truck share. Caltrans for LA, TxDOT for Houston.
- **City counts**: LADOT traffic counts (LA open data); Caltrans PeMS for hourly freeway volumes.
- **Google Routes API** (optional): traffic speed by time of day.

### Other sources and checks

- **US DOT National Transportation Noise Map**: modeled road and aviation noise in dB. Used to check our outdoor levels.
- **Building permits** (city open data): active and upcoming construction near the property.
- **City street tree inventory** and Vexcel imagery: tree cover between roads and the building.

## Noise model (Alejandro)

Physics, not machine learning:

1. **Outdoor level at each facade.** Sum each source's contribution:
   - Roads: an emission level from volume, speed and truck share (FHWA Traffic Noise Model or CNOSSOS-EU style), reduced by distance (line source), barriers and ground.
   - Aircraft: the type's certified source level, reduced by slant distance from each track point and by air absorption, then combined into an hourly average.
   - Construction: equipment levels during active hours, reduced by distance.
2. **Facade to room.** Subtract the sound insulation of the wall and window (from construction type and window area). Rooms with no exterior wall get the level of the neighbouring room minus an interior wall loss.
3. **Per time block.** Average energy over each block (Leq). Also report peak events, such as a flyover, because a single loud event matters for sleep.
4. **Check.** Compare outdoor predictions with airport monitors and the DOT noise map at the same locations.

## 3D frontend

- **Outside (Ishaan):** a 3D city view of the property with roads colored by traffic noise and flight paths drawn as 3D tracks at their real altitudes, animated over the time slider. Candidates: CesiumJS or deck.gl with photorealistic 3D tiles or Vexcel elevation.
- **Inside (Chinmay, Shreyansh):** the Matterport viewer (SDK, localhost) with each room tinted by its level, a time slider, and a panel that explains the breakdown by source.
- **Hand-off:** click the building in the city view and fly into the Matterport model.

## Quality loop

Every UI change gets checked in a real browser (Playwright or the built-in browser) before it counts as done: screenshots at each time block, the heat map colors matching `levels.json`, and no console errors.

## Demo flow (about 90 seconds)

1. Search an address; the building appears in 3D with live traffic and real flight tracks.
2. Drag the time slider; roads and flight paths change with the time of day.
3. Fly into the home; each room shows its level.
4. Show a "Quiet Score" for the listing and the breakdown ("Bedroom 2 is loud because of the 7 AM departures").
5. Close with the founding story: two of us lived in homes like this without knowing.

## Order of work

1. Download and inspect the CoStar kit; pick the city and 1 to 3 properties.
2. Agree on the three JSON files; commit sample files.
3. In parallel: pipeline fills real data, model computes levels from sample inputs, frontends render the sample files.
4. Swap in real data end to end.
5. Polish, check in the browser, rehearse the pitch.

## Open questions

- What exactly is in the CoStar extract, and which properties have Matterport scans?
- LA or Houston? Decided by the sponsor data overlap.
- Which OpenSky data access do we get in time (live API vs. historical)?
- Which GitHub login belongs to which teammate (for routing requests)?
