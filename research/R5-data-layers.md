# R5. Data layers: CoStar, Matterport, Vexcel

> Historical initial probe, superseded by [the November 14 full sponsor audit](../docs/SPONSOR-DATA-INVENTORY.md). The kit is now available; some tours have structured walls/windows; all 53 neighborhood tours have unlocked MatterPaks. The early conclusions below describe only the original three-model sample.

Issue #6. Run on 2026-11-14 with the sponsor keys Ishaan approved. Read calls only: 8 to Matterport (including one 403 and one schema-validation error) and 6 to Vexcel (3 REST, 3 MCP), plus a fetch of the public Vexcel OpenAPI spec.
No keys are in this file or in `samples/`.

## Answer

Two of the three layers are reachable. The CoStar layer is not.

- **Matterport (reachable, partial).** The GraphQL Model API works and the account sees 14,945 models, 6,084 of them matching "Houston".
  For a Houston apartment it returns every room with a type tag, floor area, wall area, height, width, depth and volume.
  It does **not** return room polygons, walls or openings: `floors.vertices`, `floors.edges`, `rooms.boundary.edges` and every `Edge.openings` came back empty on all three Houston models tried.
  So the answer to "does Matterport access include Property Intelligence rooms and openings" is: rooms yes, openings and room geometry no.
- **Vexcel (reachable).** The v2 REST API and the Vexcel MCP server both work with the key.
  The Houston 2026 collection (`us-tx-houston-2026`) includes footprint (`footprint.wkt`, `footprint.area`), height (`roof-characteristics.height`, a calculated field) and tree cover (`parcel-tree-cover.percent`, `roof-characteristics.tree-cover.percent`, `defensible-space.zone1-tree` to `zone4-tree`).
- **CoStar (not reachable).** No CoStar hackathon kit zip is on this machine, and no CoStar MCP server is configured or documented anywhere I could reach. Per the issue rules I stopped on this layer. Year built and construction type, which we expected from CoStar, are therefore `missing`.

Chosen building: **2125 Yale St, Houston TX 77008** (Matterport model `D9CVkjeMoQx`, "2125 Yale / Kaplan I / 2 Bed / 1304 Sq Ft").
This is one apartment unit inside a mid-rise apartment block. Vexcel classifies that block as `condo_apartment`.
It is the closest thing to "one Houston residential building" for which both reachable layers have data.
It is not a single-family house. Most geolocated Houston Matterport models in this account are apartment units, leasing offices or amenity spaces.

## Layers reached

| Layer | Endpoint | Auth (how, not the value) | Result |
|---|---|---|---|
| CoStar kit | local zip | `COSTAR_KIT_ZIP_PASSWORD` exists, but there is no zip | Not available locally; see Not found |
| CoStar MCP | none found | none | No server configured (`~/.claude.json` lists only `playwright`; there is no `.mcp.json` in the repo) and none documented in the repo or the issue |
| Matterport Model API | `POST https://api.matterport.com/api/models/graph` | HTTP Basic, user `MATTERPORT_API_KEY`, password `MATTERPORT_API_TOKEN` (the reverse order returns 403 `invalid key/secret`) | 200 |
| Matterport Showcase SDK | browser only, `VITE_MATTERPORT_SDK_KEY` | not called (needs a browser page) | docs read only |
| Vexcel REST v2 | `GET https://api.vexcelgroup.com/v2/property/extract`, `/v2/structure/extract` | header `X-API-KEY: $VEXCEL_API_KEY` | 200 with a 30 m buffer; 404 "No available property data for request" without a buffer |
| Vexcel MCP | `POST https://api.vexcelgroup.com/v2/mcp` (streamable HTTP, server `api-platform-mcp` 1.0.0) | header `X-API-KEY` | `initialize` and `tools/list` OK, 33 tools |

### Exact calls (reproducible; keys come from env vars)

Matterport, one model (the response is in `samples/`):

```
curl -s -u "$MATTERPORT_API_KEY:$MATTERPORT_API_TOKEN" -H 'Content-Type: application/json' \
  https://api.matterport.com/api/models/graph -d @model_query.json
```

`model_query.json` asks for `model(id: "D9CVkjeMoQx")` with `address`, `geolocation`, `geocoordinates`,
`propertyClassifications`, `dimensions(units: metric)`, and for each of `floors`: `vertices`, `edges { type thickness openings {...} }`,
`rooms { id label tags keywords classifications dimensions(units: metric) ceiling(units: metric) boundary { edges {...} } holes }`.
A second call asked for `floors { vertices(includeUsed: true) edges(includeUsed: true) {...} }`, `views { layers }` and `bundles`.
A third ran the same wall and opening query on models `dts1Hjut1rG` (11301 Fallbrook Dr) and `KeQW4xxwDLo` (a two-storey 3-bed unit). All of them came back empty.

Vexcel:

```
curl -s -G -H "X-API-KEY: $VEXCEL_API_KEY" https://api.vexcelgroup.com/v2/property/extract \
  --data-urlencode 'wkt=POINT(-95.3993738 29.8058666)' --data-urlencode 'buffer-meter=30' \
  --data-urlencode 'include=precomputed,calculated' --data-urlencode 'total-records=2' \
  --data-urlencode 'order-by=distance-asc'
```

The same parameters went to `/v2/structure/extract`. The point is the Matterport `geolocation` of the unit.

### Sample files

| File | What it is |
|---|---|
| `samples/matterport_model_D9CVkjeMoQx.json` | Raw Matterport GraphQL response: model, address, geolocation, 1 floor, 9 rooms with dimensions, empty edges and vertices |
| `samples/matterport_model_D9CVkjeMoQx_views_bundles.json` | Raw response showing the `includeUsed: true` wall query (still empty), the view layers and the bundle availability |
| `samples/vexcel_property_extract_2125_yale.json` | Raw Vexcel property extract: 2 parcels; feature 0 is the 2125 Yale apartment block |
| `samples/vexcel_structure_extract_2125_yale.json` | Raw Vexcel structure extract for the same point |
| `samples/vexcel_mcp_tools_list.json` | Raw `tools/list` result from the Vexcel MCP server, with full input schemas |

The CoStar building record sample is missing, because the layer was not reachable.

## Values

Exact field names as returned. All values are from the samples above. Confidence is `high` when the value was read directly from a live response.

### Matterport (model `D9CVkjeMoQx`)

| Name | Value | Unit | Source | Exact field | Confidence |
|---|---|---|---|---|---|
| Address | 2125 Yale St, Houston, TX, 77008, US | | live API | `model.address.address` | high |
| Lat / lon | 29.8058666 / -95.3993738 | deg (strings) | live API | `model.geolocation.lat`, `model.geolocation.long` | high |
| Lat / lon (float) | 29.805866568107938 / -95.3993737976162 | deg | live API | `model.geocoordinates.latitude`, `.longitude`, `.source` = `processing` | high |
| Model rotation | quaternion z -0.6989, w 0.7153 (about -88.7 deg about the vertical axis) | | live API | `model.geocoordinates.rotation`, `.translation` | high (value); the heading convention is not documented |
| Property class | `living_space` (type `vision`) | | live API | `model.propertyClassifications[].classification` | high |
| Total floor area | 112.88 | m2 | live API | `model.dimensions(units: metric).areaFloor` | high |
| Floors | 1 (`Floor 1`, sequence 0) | | live API | `model.floors[].label`, `.sequence` | high |
| Rooms | 9: living/kitchen/dining 45.07, bedroom 19.78, bedroom 15.11, corridor 8.03, bathroom 8.13, bathroom 7.57, closet+bathroom 4.04, closet 3.00, closet 2.14 | m2 | live API | `rooms[].tags`, `rooms[].dimensions.areaFloor` | high |
| Room height | 2.52 to 2.89 | m | live API | `rooms[].dimensions.height` | high |
| Room wall area | e.g. bedroom 19.78 m2 floor has 88.45 m2 wall | m2 | live API | `rooms[].dimensions.areaWall` (all walls, interior and exterior together) | high |
| Room box | e.g. bedroom 3.70 x 5.08 | m | live API | `rooms[].dimensions.width`, `.depth` | high |
| Room volume | e.g. bedroom 56.68 | m3 | live API | `rooms[].dimensions.volume` | high |
| Room label | absent (the API drops null fields) | | live API | `rooms[].label` | high |
| Room classifications | empty list | | live API | `rooms[].classifications` | high |
| Ceiling heights | empty object | | live API | `rooms[].ceiling(units: metric).minHeight`, `.maxHeight` | high |
| Walls | none | | live API | `floors[].edges`, `floors[].vertices` (also with `includeUsed: true`) | high |
| Openings | none | | live API | `Edge.openings[]` (schema has `type` in `window`, `doorway`, `opening`, `divider`, plus `width`, `height`, `lowerElevation`) | high |
| Room polygons | none | | live API | `rooms[].boundary.edges` | high |
| Bundles | `mp:matterpak` unlocked; `mp:imagery` locked; BIM, schematic floorplan, TruePlan, OBJ geometry, e57 all `unavailable` | | live API | `model.bundles[].id`, `.availability` | high |

The schema types used above (`Model`, `ModelFloor`, `ModelRoom`, `Edge`, `Opening`, `OpeningType`, `Dimension`) come from a live introspection query against the same endpoint.

Showcase SDK (docs only, not called): `RoomData` has `id`, `label`, `bounds.min`, `bounds.max`, `center`, `size`, `floorInfo.id`, `floorInfo.sequence`. It has no walls, windows or polygons.
Source: https://matterport.github.io/showcase-sdk/docs/reference/current/modules/room.html (this page says it is no longer updated and points to developers.matterport.com).

### Vexcel (feature 0 of the property extract: the 2125 Yale apartment block)

| Name | Value | Unit | Source | Exact field | Confidence |
|---|---|---|---|---|---|
| Collection | `us-tx-houston-2026`, layer `urban`, ortho date estimate 2025-12-19, GSD 0.074 | m/px | live API | `metadata.collection`, `metadata.layer-name`, `metadata.ortho-date-estimate`, `metadata.gsd` | high |
| Building class | `condo_apartment`, score 0.94 | | live API | `structures[].building-type.class`, `.score` | high |
| Footprint | 53-vertex outer ring with one small hole | WGS84 WKT | live API | `structures[].footprint.wkt` | high |
| Footprint area | 6849.4 | m2 (metric is the documented default) | live API | `structures[].footprint.area` | high (value), medium (unit) |
| Roof height above ground | 16.02 (property extract), 14.54 (structure extract) | m | live API | `structures[].roof-characteristics.height` (needs `include=calculated`) | high (values); see Conflicts |
| Roof elevation | 37.05 | m above sea level | live API | `structures[].roof-characteristics.elevation` | high |
| Ground elevation | 21.03 | m | live API | `structures[].ground-elevation.value` | high |
| Stories below eave | null | | live API | `structures[].roof-characteristics.number-of-stories-below-eave` | high (field exists, empty here) |
| Eave height, max roof height | null | | live API | `roof-characteristics.eave-height`, `roof-characteristics.maximum-roof-height` | high |
| Parcel tree cover | 4 | percent | live API | `parcel-tree-cover.percent` | high |
| Tree cover over the roof | 0 | percent | live API | `structures[].roof-characteristics.tree-cover.percent` | high |
| Defensible-space trees | zone1 7, zone2 17, zone3 25, zone4 21 | percent (see Not found) | live API | `structures[].defensible-space.zone1-tree` to `zone4-tree` | high (values), low (meaning) |
| Defensible-space buildings | zone1 0, zone2 1, zone3 11, zone4 28 | percent | live API | `structures[].defensible-space.zone1-building` to `zone4-building` | high (values), low (meaning) |
| Roof shape, material | `flat`, `membrane` | | live API | `roof-characteristics.shape.value`, `roof-characteristics.material.class` | high |
| Parcel geometry | MultiPolygon | WGS84 | live API | feature `geometry`; `parcel-source` = `Bins` | high |
| Inside parcel | false (the Matterport point lies just outside the parcel) | | live API | `request-information.inside-parcel` | high |
| Neighbour (feature 1) | `commercial`, footprint 238.2 m2, roof height 4.80 m, parcel tree cover 5 | | live API | same fields | high |

Documented meanings, quoted from the Vexcel MCP `tools/list` descriptions in `samples/vexcel_mcp_tools_list.json`:

- `roof-height`: "returns the elevation above ground of the centroid of the footprint-wkt of the building".
- `parcel-tree-cover`: "returns the percentage of the total structure area that has been covered by trees". This wording is ambiguous; see Not found.
- `defensible-space`: "those fields represent the percentage of the ideal buffer zone established". No zone distances are given.

### Vexcel MCP server tools (`tools/list`, 33 tools)

None of the tools has required parameters. The full JSON schemas are in `samples/vexcel_mcp_tools_list.json`.
The ones R5 needs are `property_metadata_extract`, `structure_metadata_extract` and `structure_geometry_metadata_extract` (the same data as the REST extracts), plus `dsm_elevation` and `dtm_elevation` for barrier heights.

| Tool | Parameters |
|---|---|
| `dsm_elevation` | `layer`, `order-by`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `unit-system` |
| `dtm_elevation` | `dem-priority`, `wkt`, `srid`, `unit-system` |
| `elements_detect` | `wkt`, `srid`, `buffer-meter`, `bbox-dimensions`, `endpoint`, `model-input` |
| `embedding_collections` | `include`, `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `embedding_extract` | `search-text`, `search-url`, `search-image`, `search-location`, `search-vector`, `search-refinement`, `graysky-event`, `collection`, `source.product-type`, `wkt`, `buffer-meter`, `collect-year`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `include`, `layer` |
| `dsm_extract` | `zoom`, `layer`, `order-by`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `buffer-pixel`, `crop`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `bbox-dimensions`, `destination-dimensions`, `buffer-meter` |
| `dtm_extract` | `zoom`, `buffer-pixel`, `crop`, `wkt`, `srid`, `bbox-dimensions`, `destination-dimensions`, `buffer-meter` |
| `oriented_extract` | `bands`, `drawing`, `crosshair`, `crosshair-color`, `crosshair-line-width`, `attribution`, `image-format`, `image-name`, `product-type`, `order-by`, `min-capture-date`, `max-capture-date`, `downsample`, `rotation`, `dem-priority`, `crop`, `buffer-pixel`, `spatial-operation`, `wkt`, `srid`, `graysky-event`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `bbox-dimensions`, `destination-dimensions`, `buffer-meter`, `layer` |
| `ortho_extract` | `bands`, `drawing`, `crosshair`, `crosshair-color`, `crosshair-line-width`, `attribution`, `image-format`, `include`, `product-type`, `interpolation`, `order-by`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `zoom`, `buffer-pixel`, `crop`, `wkt`, `srid`, `graysky-event`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `bbox-dimensions`, `destination-dimensions`, `buffer-meter`, `layer` |
| `damage_coverage_collections` | `include`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `dsm_coverage_collections` | `include`, `layer`, `order-by`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page` |
| `dtm_coverage_collections` | `include`, `order-by`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page` |
| `oriented_imagery_collections` | `product-type`, `bands`, `include`, `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `ortho_imagery_collections` | `bands`, `product-type`, `include`, `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `property_coverage_collections` | `include`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `structure_coverage_collections` | `include`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `damage_events_collections` | `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page` |
| `oriented_events_collections` | `product-type`, `bands`, `include`, `layer`, `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page` |
| `ortho_events_collections` | `bands`, `product-type`, `include`, `layer`, `graysky-event`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `order-by`, `spatial-operation`, `metadata-format`, `coverage-level`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page` |
| `ortho_estimate_dates` | `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `include`, `layer` |
| `damage_metadata_extract` | `graysky-event`, `min-cat-score`, `max-cat-score`, `min-fema-classification`, `max-fema-classification`, `min-histoscore`, `max-histoscore`, `order-by`, `include`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `unit-system`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `property_metadata_extract` | `deck`, `sport-court`, `playground`, `trampoline`, `enclosure`, `pool`, `automobile`, `boat`, `order-by`, `include`, `primary-structure`, `min-roof-condition`, `max-roof-condition`, `roof-solar`, `roof-material`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `unit-system`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `structure_metadata_extract` | `orientation-source`, `order-by`, `include`, `primary-structure`, `min-roof-condition`, `max-roof-condition`, `roof-solar`, `roof-material`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `unit-system`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `structure_geometry_metadata_extract` | `include`, `orientation-source`, `order-by`, `primary-structure`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `unit-system`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `damage_metadata_count` | `graysky-event`, `min-cat-score`, `max-cat-score`, `min-fema-score`, `max-fema-score`, `min-histoscore`, `max-histoscore`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date` |
| `property_metadata_count` | `deck`, `sport-court`, `playground`, `trampoline`, `enclosure`, `pool`, `automobile`, `boat`, `primary-structure`, `min-roof-condition`, `max-roof-condition`, `roof-solar`, `roof-material`, `min-first-capture-date`, `max-first-capture-date`, `min-last-capture-date`, `max-last-capture-date`, `buffer-meter`, `latest`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `layer` |
| `oriented_imagery_query` | `graysky-event`, `image-name`, `product-type`, `min-capture-date`, `max-capture-date`, `order-by`, `bands`, `include`, `spatial-operation`, `metadata-format`, `wkt`, `srid`, `collection`, `collect-year`, `min-first-publish-date`, `max-first-publish-date`, `min-last-publish-date`, `max-last-publish-date`, `total-records`, `page-size`, `page`, `layer` |
| `oriented_transform_points` | `operation`, `image-name`, `wkt`, `srid`, `metadata-format`, `dem-priority` |
| `user_profile_query` | none |
| `status_query` | none |
| `usage_query` | `period-start`, `period-end`, `user`, `aggregation` |
| `damage_property_report` | `graysky-event`, `wkt`, `srid`, `collection`, `urban-collections`, `wide-area-collections`, `graysky-collections`, `urban-irg-collections`, `wide-area-irg-collections`, `graysky-irg-collections`, `unit-system`, `alt-image`, `template-url` |
| `property_report` | `wkt`, `srid`, `collection`, `urban-collections`, `wide-area-collections`, `graysky-collections`, `urban-irg-collections`, `wide-area-irg-collections`, `graysky-irg-collections`, `unit-system`, `alt-image`, `template-url` |

## Field map for `building.json`

Section 1.1 of the plan, field by field. "Fallback" means the plan's documented footprint-grid path (rooms on a grid inside the footprint, with 15% of each outside wall as window), or an assumption key that S1 must own.

| `building.json` field | Filled by | Fallback when missing |
|---|---|---|
| `id` | Matterport `model.id` (`D9CVkjeMoQx`) | Without Matterport: missing; the loader builds an id from the Vexcel `request-information.request-id` or the address |
| `lat` | Matterport `model.geocoordinates.latitude` (float), or `model.geolocation.lat` (string) | Vexcel: centroid of `structures[].footprint.wkt` |
| `lon` | Matterport `model.geocoordinates.longitude`, or `model.geolocation.long` | Vexcel: centroid of `structures[].footprint.wkt` |
| `year_built` | **missing** (expected from CoStar, which was not reachable; neither Matterport nor Vexcel has it) | User input; otherwise the R3 default era, recorded in `assumptions_used` |
| `construction` | **missing** (CoStar not reachable; Vexcel `building-type.class` is the use class, e.g. `condo_apartment`, not the wall type) | R3 default wall type for the era |
| `storeys` | **missing** for the building. Vexcel `roof-characteristics.number-of-stories-below-eave` exists but is null here. Matterport `model.floors` counts levels inside the scanned unit (1), not the building | Estimate from Vexcel `roof-characteristics.height` divided by a storey height (new assumption key, `placeholder`; 16.02 m / 3 m gives about 5) |
| `data_quality` | Set by the loader, not by an API. With these keys Matterport supplies room areas and heights but no geometry, so `matterport` (the plus or minus 3 dB case) is not reached | `footprint_grid` |
| `rooms[].id` | Matterport `rooms[].id` | Footprint grid generates ids |
| `rooms[].name` | **missing** (`rooms[].label` is absent on all 9 rooms) | Built from `rooms[].tags` plus a counter ("bedroom 1", "bedroom 2") |
| `rooms[].type` | Matterport `rooms[].tags` (seen: `bedroom`, `bathroom`, `closet`, `corridor`, `kitchen`, `living`, `dining`; one room can have several tags) | Footprint grid assigns types |
| `rooms[].floor` | Matterport `floors[].sequence` of the room's parent floor (`rooms[].floor` returns that floor) | 0 |
| `rooms[].area_m2` | Matterport `rooms[].dimensions(units: metric).areaFloor` | Grid cell area |
| `rooms[].height_m` | Matterport `rooms[].dimensions(units: metric).height` | 2.4 m default (plan section 1.1; needs an assumption key) |
| `rooms[].polygon` | **missing** (`rooms[].boundary.edges` is empty). A box of `dimensions.width` x `dimensions.depth` is known but has no position | Footprint grid inside Vexcel `footprint.wkt`. The SDK `Room.bounds.min` and `.max` could position the boxes (untested) |
| `surfaces[].id` | **missing** (`floors[].edges` is empty) | Generated by the footprint grid |
| `surfaces[].kind` | **missing** (would come from `Edge.type`, `wall` or `invisible`, plus a room-adjacency test) | Footprint grid: an edge on the Vexcel footprint perimeter is `exterior`, a grid edge is `interior` |
| `surfaces[].room` | **missing** | Footprint grid |
| `surfaces[].other_room` | **missing** | Footprint grid |
| `surfaces[].azimuth_deg` | **missing** from Matterport | Outward normal of each Vexcel `footprint.wkt` edge (see Equations) |
| `surfaces[].area_m2` | **missing** per wall. Matterport `rooms[].dimensions.areaWall` gives each room's total wall area, which can serve as a check | Footprint edge length x room `height_m` |
| `surfaces[].wall_type` | **missing** | R3 default by era and `construction` |
| `surfaces[].openings[].kind` | **missing** (`Edge.openings[].type`, one of `window`, `doorway`, `opening`, `divider`, is empty) | 15% of each exterior wall as `window`; one interior door per interior surface (needs an assumption key) |
| `surfaces[].openings[].area_m2` | **missing** (it would be `Opening.width` x `Opening.height`) | 15% of `surfaces[].area_m2` for windows |
| `surfaces[].openings[].type` | **missing** | R3 default window and door type by era |
| `surfaces[].openings[].open` | Not an API field in any layer | `false` (plan section 2: windows closed unless toggled) |

### Extra Vexcel fields the outdoor model can use (not in `building.json`, but needed by section 2.1)

| Need | Vexcel field |
|---|---|
| Tree cover near the building (foliage term, R2 question 3) | `defensible-space.zone1-tree` to `zone4-tree`, `parcel-tree-cover.percent`, `roof-characteristics.tree-cover.percent` |
| Barrier candidates (Maekawa) | Other features' `footprint.wkt` plus `roof-characteristics.height` from a wider `buffer-meter` query; `dsm_elevation` and `dtm_elevation` along a line |
| Ground and roof elevation | `ground-elevation.value`, `roof-characteristics.elevation` |

## Equations

Facade azimuth from a footprint edge. For one ring of `footprint.wkt` in WGS84, going from vertex `(lon1, lat1)` to `(lon2, lat2)`:

```
dx = (lon2 - lon1) * cos(lat_mean)      east component (scaled degrees)
dy = (lat2 - lat1)                      north component (degrees)
edge_bearing = atan2(dx, dy)            degrees clockwise from north
azimuth_deg  = (edge_bearing - 90) mod 360  if the ring is clockwise
             = (edge_bearing + 90) mod 360  if the ring is counter-clockwise
```

Check the ring direction with the sign of the shoelace area. Holes (inner rings) are courtyards and also face outward from the building mass.

Worked example: the first edge of the Yale footprint goes from (-95.399432, 29.805907) to (-95.399432, 29.805795). That is due south, so `edge_bearing` = 180 deg.
The outer ring is clockwise (its shoelace area is negative, -6.4e-7 square degrees), so `azimuth_deg` = (180 - 90) mod 360 = 90 deg. The wall faces east.
The loader must compute the ring direction from the shoelace sign and must not assume it.

Edge length in metres, for wall area: `L = sqrt((dx * 111320)^2 + (dy * 110574)^2)`. These are the standard metres-per-degree values at the equator and on a meridian (a small-area approximation).
For the first edge, L = 0.000112 * 110574 = 12.4 m.

Storey estimate (fallback only, placeholder): `storeys = max(1, round(roof_height_m / storey_height_m))`. With 16.02 m and an assumed 3.0 m, that is 5.

## Conflicts

- **Roof height differs by endpoint**: 16.02 m from `/property/extract` and 14.54 m from `/structure/extract` for the same footprint. Both are "calculated" at run time from the footprint centroid. Take the structure-extract value for a single building, and treat the 1.5 m spread as uncertainty. This is unexplained in the docs.
- **Unit versus building**: the Matterport scan is one 113 m2 unit. The Vexcel footprint is the whole 6,849 m2 apartment block. Nothing in either response says which floor the unit is on or which facade it touches, so the unit cannot be placed inside the footprint from these data alone.
- **Matterport point versus parcel**: Vexcel reports `inside-parcel: false` for the Matterport geolocation. The point sits about 7 m from the nearest footprint vertex, at the block's north-east corner, so a buffer is needed; without one the API returned 404.
- **Plan assumption versus data**: plan section 10 assumed Matterport might give room geometry. With these keys it gives room lists and sizes only, so the demo runs on the footprint-grid path with the wider plus or minus 5 dB range.

## Not found

- **CoStar extract**: not on this machine. Searched `~/Downloads`, `~/Desktop` and `~/Documents` for files named `*costar*`, and for zips with "kit", "hackathon", "costar" or "houston" in the name: none. The password variable exists, but there is no zip. Fallback: year built and construction from R3 defaults or user input.
- **CoStar MCP servers**: none configured (`~/.claude.json` has only `playwright`; there is no `.mcp.json` in the repo), and the issue, plan and repo give no endpoint. Not guessed. Task 1 of the issue (print the CoStar MCP tool list) could not be done. The Vexcel MCP tool list above is the only MCP list available.
- **Matterport room polygons, walls and openings**: the schema supports them (`Edge`, `Vertex`, `Opening`), but this account returns none for three Houston models. The bundles for schematic floorplan, TruePlan, BIM and OBJ geometry all report `unavailable`. Fallback: footprint grid plus the 15% window rule.
- **Vexcel defensible-space zone distances**: the docs say the values are "the percentage of the ideal buffer zone established" but give no radii. Do not map zone1 to zone4 onto the plan's 5, 30, 100 and 200 ft until Vexcel's data dictionary confirms it. The Confluence API docs at vexcel.atlassian.net returned "page not found" to anonymous access. Fallback for R2: use `parcel-tree-cover.percent` as a coarse cover fraction, marked `placeholder`.
- **Vexcel `parcel-tree-cover` denominator**: the docs say "percentage of the total structure area", which reads like a typo for the parcel area. Unconfirmed.
- **Vexcel Getting Started PDF and Python Quickstart**: not found publicly. Everything above comes from the public OpenAPI spec at https://api.vexcelgroup.com/v2/api-docs, the MCP setup page https://vexceldata.com/platform/vexcel-mcp/mcp-get-started/ and the live responses.
- **A single-family Houston house with both layers**: not looked for beyond the first 100 search results, to keep the call count small. A follow-up could search Matterport with `query: "Houston house"` and pick a geolocated detached home, which would make the footprint and the scan the same building.
