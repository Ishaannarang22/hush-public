# R10. Wall and window areas from the Matterport mesh (MatterPak)

Issue #20. Run on 2026-11-14 with the Matterport keys Ishaan approved. 13 GraphQL read calls (4 of them returned
validation errors while I found the field names) and 2 MatterPak downloads from the Matterport CDN. Nothing was bought
or unlocked: both bundles were already `unlocked`. No keys are in this file, in `samples/` or in `research/R10-scripts/`.
The MatterPaks, meshes, textures and point clouds stayed in a scratch folder outside the repo, which has been deleted.

Two models:

- **2125 Yale St, unit 205** (`D9CVkjeMoQx`, 2 bed, 1 floor, 113 m2). The first test, done in full.
- **3012 Houston Ave** (`M7BdXkpzrrE`, "7BR, 5BA - 6,598SF", 4 floors, 721 m2). Following Alejandro's comment, this
  was the only geolocated, house-like result with an unlocked MatterPak in the first 100 hits for "Houston house".
  Tasks 1 to 3 were repeated on it with the automatic pipeline only. It is a large house with curved walls, an
  outbuilding linked by a walkway, and outdoor areas scanned as rooms, so it is a hard first case.

## Answer

**How windows appear: mostly as holes, sometimes as texture only. They are never labelled.** The OBJ has no window
objects or window materials. Its groups are named `chunkNNN_groupFFF_subRRR[_objectKIND]`: `group` is the floor,
`sub` is the room (the same numbers as on the MatterPak colour plan), and the object kinds are only `ceiling` and
`unknown`, plus `mirror` groups. Materials are just texture atlas pages. The MatterPak readme says Window and Mirror
markers placed in the capture app "add a wall of triangular faces to close up holes". Neither model has any window
groups. Yale has 5 small `mirror` groups (on the bathroom vanity wall). The house has 32; its listing says "some
mirrors unavoidable", and I did not check each one.

What a window looks like in the geometry depends on what covers it:

- **Bare glass**: a hole in the wall mesh, with a few surfaces seen through it. The Yale living room's two
  floor-to-ceiling glazed walls are almost entirely holes, and the tree outside shows up in the point cloud.
- **Closed blinds**: the blinds are reconstructed as a surface within 3 cm of the wall plane. Only the photo texture
  (striped, bright) shows a window there, and the upper panes of glass that the blinds do not cover leave holes.
- **Curtains to the floor** (house): a textured surface that looks like a door to a geometry rule.

So windows cannot be read straight out of the file. They can be found semi-automatically: render each wall as an
elevation image from the coloured point cloud, then flag holes, recesses and strongly textured patches.

**Per-room table for the demo unit: produced** (Values, table 1). Exterior walls, compass azimuth, wall area, and
window and door width, height and area were measured from rendered wall elevations at 1 cm per pixel. Openings are
±5 cm. On hand-placed wall planes, the automatic detector found all 6 openings of the unit. Five of them came within
about 10% of the measured area; the balcony door was found only as its glass (Values, table 3). It also flagged 4
false openings on windowless walls (3 on a bathroom mirror, 1 above a headboard), so a person still has to confirm them. On the house, the same automatic pipeline is not reliable (see Conflicts). A
house table would need the manual pass described below.

**Compass north: from the Model API, not the mesh.** The MatterPak has no north arrow. The Model API `geocoordinates`
gives a rotation, and `geoLocationOf(modelLocation:)` turns any model point into latitude and longitude. I asked it
for the model origin and for points 10 m along +x and +y. That fixes the bearing of each model axis directly, with no
guessing about quaternion conventions. Yale: +x points to 178.7 deg (south) and +y to 88.7 deg (east). The source is
`processing`, so north is only as good as Matterport's processing estimate (see Conflicts).

**Exterior versus interior walls.** Three tests, from strongest to weakest:

1. **Behind-wall density** (automatic, works well): count point-cloud points 0.4 to 3 m beyond the wall at the room's
   own heights. An interior partition has the next room behind it. At Yale, all 26 partition segments had 7,600 to
   64,000 points per m2 behind them, and 16 of the 18 segments with no unit room behind them had 0 to 1,700. The two
   exceptions had scanned space 1 to 3 m behind them: the entry-door wall (16,500; the scan sees into the building
   corridor), and a closet wall with a small unscanned void between it and the unit corridor (10,900). On the house,
   this test correctly marked a 15 m stair-hall wall as interior when the simpler probe had called it exterior.
2. **Room probe** (automatic): look 0.45 to 0.95 m beyond the wall in the room footprint grid. This finds which room
   is on the other side, and so gives the partition list.
3. **Windows** (manual confirmation): a boundary wall with windows is a facade.

In an apartment, tests 1 and 2 find the unit boundary, but they cannot tell a facade from a party wall or a corridor
wall. At Yale, the north and east boundary walls carry all the windows. The west and south boundary walls have none,
and the entry door is on the south side, so I marked those as "boundary, status unknown" (table 2). In a detached
house the boundary is the facade, which is why the house case should be easier, apart from scanned outdoor areas.

**Showcase SDK `RoomData.bounds`**: an axis-aligned box per room (`bounds.min`, `bounds.max`, `center`, `size`, plus
`floorInfo`). It places rooms but gives no walls, and the SDK docs warn that room bounds can overlap. The MatterPak
already gives the same boxes offline (the per-room `sub` groups) plus the actual wall planes, so the SDK adds nothing
for this. It was not run in a browser.

**Manual fallback** (if the automatic pass is not trusted): render each exterior wall as an elevation with
`research/R10-scripts/elev.py` (a 10 cm grid is drawn in), then read the window frames off the image. Or use the
measurement tool in the Matterport Showcase viewer: two clicks for the width and two for the height of each window.
For the Yale unit that means 6 openings on 9 facade walls. **Time: not measured.** My estimate for a person is 15 to
25 minutes per unit in the viewer, and about 10 minutes from the rendered elevations once the scripts have run. Treat
both as estimates.

## Values

Room names: room `sub` numbers are matched to the Model API rooms by size. The two bathrooms are matched by floor-area
rank only (8.13 m2 is `sub` 6 and 7.57 m2 is `sub` 7), so that pair is medium confidence. Azimuth is the compass
direction the outside face points (0 north, 90 east), from the bearings above. Wall area is the inside face width
times room height. "Facade" means the wall has windows, or is in line with a wall that does.

### Table 1. Yale unit 205: facade walls and openings (manual, from elevations)

Source file: `samples/R10_yale_exterior_walls.csv`. Elevation images: `samples/R10_yale_window_elevations.jpg`.

| Room | Wall | Azimuth deg | Width m | Height m | Wall m2 | Opening | W x H m | Sill to head m | Opening m2 |
|---|---|---|---|---|---|---|---|---|---|
| Living/kitchen/dining | north, kitchen nook | 358 | 2.20 | 2.87 | 6.31 | none (cabinets) | | | 0 |
| Living/kitchen/dining | east-facing return behind fridge | 88 | 0.65 | 2.87 | 1.87 | none | | | 0 |
| Living/kitchen/dining | north, dining glazing | 358 | 3.22 | 2.87 | 9.24 | window wall | 2.85 x 2.63 | 0.13 to 2.76 | 7.50 |
| Living/kitchen/dining | east, dining glazing | 88 | 3.46 | 2.87 | 9.93 | window wall | 3.40 x 2.75 | 0.11 to 2.86 | 9.35 |
| Living/kitchen/dining | south, onto balcony | 178 | 1.22 | 2.87 | 3.50 | glazed door + transom | 0.90 x 2.03; 0.85 x 0.49 | 0 to 2.03; 2.06 to 2.55 | 1.83 + 0.42 |
| Living/kitchen/dining | east, onto balcony | 88 | 3.94 | 2.87 | 11.31 | 3 windows (one frame) | 2.55 x 1.85 | 0.78 to 2.63 | 4.72 |
| Bedroom 19.8 m2 | north | 358 | 4.95 | 2.87 | 14.21 | window pair | 1.66 x 2.19 | 0.46 to 2.65 | 3.64 |
| Bedroom 15.1 m2 | east | 88 | 3.77 | 2.86 | 10.78 | window pair | 1.69 x 2.20 | 0.47 to 2.67 | 3.72 |

Glazing fraction of the facade walls: living room 23.8 of 42.2 m2 (56%), bedroom 19.8 m2: 26%, bedroom 15.1 m2: 35%.

### Table 2. Yale: unit-boundary walls with no window (exterior status unknown)

Source file: `samples/R10_yale_boundary_walls_no_window.csv`. These total 60.3 m2 across 9 walls:
bedroom 19.8 m2 west 10.50, bathroom 8.13 m2 west 7.01, corridor west 6.53, corridor south with the entry door 4.39,
closet-bathroom 4.04 m2 west 5.62 and south 5.80, bathroom 7.57 m2 south 6.93, bedroom 15.1 m2 south 10.93, and
bedroom 15.1 m2 west 2.63 (the part beside the balcony, whose outer edge was not captured).

### Table 3. Automatic detector against the manual table (Yale)

| Opening | Manual W x H, m2 | Automatic W x H, m2 | Difference |
|---|---|---|---|
| Bedroom 19.8 north | 1.66 x 2.19, 3.64 | 1.70 x 2.30, 3.91 | +7% |
| Bedroom 15.1 east | 1.69 x 2.20, 3.72 | 1.80 x 2.00, 3.60 | -3% |
| Living east onto balcony | 2.55 x 1.85, 4.72 | 2.70 x 1.70, 4.59 | -3% |
| Living east glazing | 3.40 x 2.75, 9.35 | 3.40 x 2.50, 8.50 | -9% |
| Living north glazing | 2.85 x 2.63, 7.50 | 2.90 x 2.60, 7.54 | +1% |
| Balcony door + transom | 1.83 + 0.42 | 0.80 x 1.40 (glass only), 1.12 | door outline missed |

False openings on the 9 windowless boundary walls: the bathroom vanity mirror (3 boxes) and the space above a
headboard (1). The two glazed walls reach to 0.1 m above the floor, so the sill rule labels them "door". These
results come from running `detect.py` on hand-placed planes. The fully
automatic run (`mesh2walls.py`, output in `samples/R10_yale_auto_walls.json`) also misses the two big glazed walls,
because they are mostly holes, so too few wall faces are left to form a segment.

### Table 4. Yale: which rooms touch (automatic, `adjacency.py`)

Source file: `samples/R10_yale_partitions.csv`. 12 shared walls were found, for example living to bedroom 19.8 m2:
3.65 m long, 10.5 m2. Living to bedroom 15.1 m2: 2.95 m, 8.4 m2. Corridor to bathroom 8.13 m2: 2.35 m, 5.9 m2, with
a 0.85 m doorway gap. Bathroom 8.13 m2 to bedroom 19.8 m2: 2.8 m, 7.1 m2. Wall thickness came out at 0.10 to 0.30 m.
Missed: the open corridor-to-living join (there is no wall to pair), the opening from bedroom 19.8 m2 into closet
2.14 m2, and every closed door (a closed door looks like wall).

### Reliability for each `property.json` field (plan section 1.1)

| Field | From the mesh | Notes |
|---|---|---|
| Which walls are exterior | **Reliable** for "unit or house boundary" via the behind-wall test; **not at all** for facade versus party wall in an apartment | In a house, outdoor areas scanned as rooms (patio, yard) must be dropped first |
| `azimuth_deg` | **Reliable**, provided Matterport's north is right | Most wall area lies within 2 deg of the model axes; north comes from `geoLocationOf` (source `processing`) |
| Exterior wall `area_m2` | **Reliable** (±0.1 m width; height from the API or the mesh) | Width comes from the room footprint or plane extent |
| `window_area_m2` | **Roughly** automatic (±10% on the openings found, but with false positives); **reliable** after a manual look | Bare glass is a hole. Blinds and curtains are texture only. Mirrors, decorations and curtains fool the texture cue |
| `door_area_m2` (exterior) | **Roughly**: glazed doors are found as windows, and the door outline needs a manual look | |
| Partitions: which rooms touch and over what area | **Roughly**: most shared walls are found with area | Open-plan joins and short walls are missed |
| Interior doors | **Not reliable**: open doorways show as gaps (only 1 found automatically), closed doors look like wall | |
| Room area, height, volume | Already reliable from the Model API (R5) | The mesh agrees within a few cm on height |

### MatterPak contents (task 1)

Yale (`mp_matterpak_2125-Yale-Kaplan-I-_D9CVkjeMoQx.zip`, 81.3 MB zipped, 309.8 MB unzipped, 32 files):

| File | Size | What |
|---|---|---|
| `cloud.xyz` | 266.5 MB | 6,739,009 coloured points (x y z r g b, metres, z up); appears to be sampled from the textured mesh on a 2 cm grid |
| `784d81a9...obj` | 25.9 MB | 175,427 vertices, 346,950 triangles, 136 groups (5 `mirror`), z up, metres |
| `784d81a9...mtl` | 3.6 KB | 15 materials, each only a texture page |
| `784d81a9..._000.jpg` to `_024.jpg` | 25 files, 15.2 MB | texture atlas pages |
| `colorplan.pdf` / `colorplan_000.jpg` | 0.72 MB / 0.74 MB | top-down colour plan, 1428 x 1482 px, with a 3 m scale bar and room numbers that match the `sub` groups (downsized copy: `samples/R10_yale_colorplan_small.jpg`) |
| `ceilingcolorplan.pdf` / `_000.jpg` | 0.34 MB / 0.34 MB | ceiling plan |

House (`mp_matterpak_3012-Houston-Ave_M7BdXkpzrrE.zip`, 556 MB zipped, 1.99 GB unzipped, 214 files): `cloud.xyz`
1.81 GB (about 45.5 million points), OBJ 43.8 MB (265,966 vertices, 291 groups, 32 `mirror`), 208 texture JPGs
(126.6 MB), `colorplan.pdf` 4.6 MB, `ceilingcolorplan.pdf` 2.3 MB and `readme.pdf`. There are no colour plan JPGs,
although the readme lists them. Details: `samples/R10_house_3012_houston_ave_summary.json`.

Neither bundle has a schematic floor plan, wall polylines, openings or a north arrow.

## Equations

Compass bearing of a horizontal model-space direction `(vx, vy)`, with `theta = 2 * atan2(q.z, q.w)` from
`geocoordinates.rotation`:

```
bearing_deg = (90 - (theta_deg + atan2(vy, vx) in degrees)) mod 360
```

Checked with `geoLocationOf`. Yale: theta = -88.38 deg, so +x is at 178.4 deg (the API gives 178.7) and +y at 88.4
(the API gives 88.7). House: theta = 3.14 deg, so +x is at 86.9 deg and +y at 356.9 (the API gives 86.9 and 356.8).
The outward direction of a wall is the opposite of its mesh face normal, which points into the room.

Wall area: `A_wall = width * h_room`. Opening area: `A_open = w * h` of the outer frame. Window fraction:
`A_open / A_wall`.

Detector rule (`research/R10-scripts/detect.py`, `mesh2walls.py`), on 10 cm cells of a wall plane. A cell counts as
an opening when it is not blocked by furniture (fewer than 5 points 5 to 80 cm inside the plane) and any one of
these holds:

- there are no points from 5 cm inside to 60 cm outside (a hole), or
- the point nearest the room is more than 3 cm outside the plane (a recess), or
- the points within 3 cm of the plane have a brightness standard deviation above 20 grey levels (blinds measured
  36 to 38, painted wall 6 to 7).

Connected regions are drawn as boxes, and boxes smaller than 0.4 x 0.5 m are dropped. A box that reaches below 0.25 m
is a door if it is at least 1.8 m tall, and is otherwise dropped.

Behind-wall test: `n_behind / (width * (h_room - 0.6))`, counting points 0.4 to 3 m behind the plane and 0.3 m clear of
floor and ceiling. At Yale an interior wall scored 7,600 or more and a boundary wall 1,700 or less, using the full
point cloud. The house run used every third point, so its scores are a third as large.

## Conflicts

- **North reference is an estimate.** `geocoordinates.source` is `processing`, not a surveyed value. The anchor puts
  the Yale model origin about 1.4 m east of the Vexcel footprint's east facade, with the unit extending another 12 m
  east, so the absolute position is off by more than 10 m. The orientation does agree with the evidence: walls lie
  within 2 deg of the model axes, the Vexcel footprint edges run exactly north-south and east-west, and the windowed
  facades face north and east, which fits R5's finding that the anchor sits at the block's north-east corner. A 90 or
  180 deg error cannot be ruled out from the data alone. A street-view or satellite check of which facades have the
  unit's windows would settle it.
- **The rotation is described backwards.** The schema says `rotation` goes "from an East-North-Up (x, y, z) to the
  model coordinate system". Applied that way, the Yale +x axis would point north. `geoLocationOf` shows it points
  south, so the quaternion as served maps model to ENU. Use `geoLocationOf` or the formula above, not the description.
- **The 15% window fallback is far too low for this unit.** Measured facade glazing is 26% to 56% per room (table 1).
- **Bundle age.** The Yale MatterPak files are dated 2020-11-30 and carry a different internal model hash
  (`784d81a9...`) from the CDN path (`d2dda576...`). The model record was created on 2026-11-11, so this is likely a
  copy of an older scan. The geometry matches the API room sizes, so it is the same unit.
- **House automatic run is not usable as data.** Spot checks of 4 walls: curtained windows were called doors, a wall
  of decorative plates was called a 3.1 x 1.5 m window, a scanned yard was called a room with a 19.8 m "door" (its
  fence), and a stair hall was called exterior by the room probe (the behind-wall test corrected that one). Of the
  house's 73 API rooms, 44 have no tag and no dimensions, which makes outdoor and odd spaces hard to drop
  automatically.

## Not found

- **Window labels in the mesh**: none, in both models. No window groups, materials or markers. `Edge.openings` in
  the Model API is empty (R5).
- **A clean single-storey detached house**: none in the first 100 results for "Houston house". 11301 Fallbrook Dr is
  commercial (a 515 m2 lobby plus a driveway, and no geocoordinates), 2511 W Mount Houston Rd is a 1,399 m2 garage,
  and 3012 Houston Ave is the 4-storey house used above. A search on other terms (for example "3 bed" with a Houston
  street address) could find a simpler house.
- **Vexcel footprint of 3012 Houston Ave**: not fetched, because this task had approval for the Matterport keys only.
  Fetching it would confirm the house is detached and check its orientation.
- **Balcony depth and overhang at Yale**: not captured in the scan (the balcony was not scanned).
- **Interior door sizes**: only 1 gap found automatically. Not measured by hand.
- **Time for the manual method**: not measured; the figures above are estimates.

## Files

- `samples/R10_yale_exterior_walls.csv`: table 1
- `samples/R10_yale_boundary_walls_no_window.csv`: table 2
- `samples/R10_yale_partitions.csv`: table 4, cleaned
- `samples/R10_yale_auto_walls.json`, `samples/R10_yale_auto_partitions.json`: raw automatic output
- `samples/R10_yale_window_elevations.jpg`: the 6 window walls as elevations (10 cm grid, darker every 50 cm)
- `samples/R10_yale_colorplan_small.jpg`: MatterPak colour plan, downsized
- `samples/R10_house_3012_houston_ave_summary.json`: house bundle contents and the result of the automatic run
- `research/R10-scripts/`: `load.py` (OBJ loader), `elev.py` and `elevseg.py` (elevation images), `detect.py`
  (openings on a given plane), `adjacency.py` (partitions), `mesh2walls.py` (full automatic pass). They expect the
  unzipped MatterPak and a `.npy` copy of `cloud.xyz` under `/tmp/hush-r10/`. Model calls used:
  `model(id){ bundle(id:"mp:matterpak"){ assets { url filename } } }` and
  `model(id){ geocoordinates { geoLocationOf(modelLocation:{x,y,z}){ lat long } } }`.
