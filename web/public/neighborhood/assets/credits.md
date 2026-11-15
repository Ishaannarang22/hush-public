# Neighborhood asset credits

The map represents the actual Greenhouse Road / I-10 corridor in Houston, Texas.
Sources were retrieved November 14, 2026. Retrieval date is not capture date.

## Geographic data

- Building footprints: **Oak Ridge National Laboratory / FEMA, USA Structures**.
  [Dataset](https://gis-fema.hub.arcgis.com/datasets/fedmaps::usa-structures/about),
  [source service](https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Structures_View/FeatureServer/0).
  The published scene retains footprint coordinates, selected building attributes,
  source identifiers, and imagery dates. Heights are not supplied in this extract.
- Runtime aerial imagery and structures: **Vexcel**, through the sponsor APIs.
- Road geometry: **TxDOT 2020 Roadway Inventory**, segment OBJECTID 365902.
  [Source service](https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_2020_Roadway_Inventory_/FeatureServer/0).
  Both animation directions use the saved centerline. Lane offsets are illustrative.
  Construction polygons are not supplied.
- Aerial imagery: **Esri, Vantor, Earthstar Geographics, and the GIS User Community**.
  [World Imagery service](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer).
  The imagery is stitched into georeferenced local map textures. It is not CC0.
- Volterra at Westlake: three stories and masonry classification from the local
  CoStar kit. Raw sponsor data is not copied into this asset directory.
  [Property website](https://www.volterrawestlake.com/).

## 3D assets

- **Island Tree 02**, Poly Haven, [asset](https://polyhaven.com/a/island_tree_02),
  [CC0](https://polyhaven.com/license). Simplified geometry, compressed textures,
  and enlarged surviving leaf clusters to preserve canopy coverage at map scale.
  This is a representative tree model, not a survey of local species or tree height.
- **Car Concept**, Eric Chadwick / Darmstadt Graphics Group GmbH (2024),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  [model and full credits](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept).
  Based on Unity Fan's CC0 concept car. Geometry simplified and textures compressed;
  materials adapted for instanced rendering. Khronos and 3D Commerce marks belong
  to their respective owners; no endorsement is implied.
- **Cesium Milk Truck**, Cesium (2017),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  [model](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck).
  Materials adapted for instanced rendering. Cesium's logo is its own mark.
- **Whitewashed Brick**, Poly Haven,
  [asset](https://polyhaven.com/a/whitewashed_brick), CC0.
  Used as a visual facade finish, not as evidence of a building's wall assembly.
- **Kloppenheim 06 Pure Sky**, Poly Haven,
  [asset](https://polyhaven.com/a/kloppenheim_06_puresky), CC0.
  Used for image based lighting; not a record of Houston weather.

## Reconstruction and simulation status

The footprints and road locations are mapped data. Wall heights, roof profiles,
window placement, finishes, and bridge elevations are visualization estimates.
Tree positions are candidates extracted from aerial color patterns, with unknown
species and heights. Vehicle motion is illustrative, not live or counted traffic.
No neighborhood sound levels, noise rankings, or vegetation attenuation results
have been calculated. The scene export leaves acoustic inputs unassigned.
