"""Files for the simulation on `main` (docs/BUILD_BRIEF.md section 7a, docs/LAB_EXPORT.md).

lab_sources.<model>.json: one list of point sources per time block, each in the simulation's `SourceData`
shape (web/src/acoustics/engine/domain.ts): {id, position {x, y, z}, spectrumDbAt1m [8 octave bands,
63 Hz to 8 kHz, unweighted SPL at 1 m], enabled, evidence {kind, source, note}}. Coordinates are the
simulation's scene frame: metres, y up, x = Matterport plan x, z = Matterport plan y (importer.ts).

room_targets.<model>.json: this model's per-room predictions keyed by Matterport room id, A-weighted.

Each outdoor source the model computed is run on its own through outdoor.wall_levels, so its level at each
exposed wall is the model's own (after orientation, barrier, foliage and rows; no facade reflection). The
point source sits outside the wall where that source is loudest, along the wall's outward normal, at the
real distance to the source. Its spectrum has the road shape, scaled so that its A-weighted level at 1 m,
minus 20 log10(distance to the wall's receiver point), equals the wall level.
"""
import json
import math
import os

from . import db, outdoor
from .predict import run

OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000]
A_WEIGHTING = [-26.2, -16.1, -8.6, -3.2, 0.0, 1.2, 1.0, -1.1]   # domain.ts A_WEIGHTING
ROAD_SHAPE = [0, 0, -2, -4, -7, -10, -14, -20]                    # demo.ts acousticSource shapes.road
SOURCE_SHAPES = {"road": ROAD_SHAPE, "rail": ROAD_SHAPE,
                 "construction": [-5, -3, 0, 0, -2, -5, -8, -12],
                 "mechanical": [0, -1, -4, -7, -11, -16, -22, -28],
                 "aircraft": ROAD_SHAPE}
SOURCE_HEIGHT_M = 1.5        # demo.ts acousticSource: position y = heightM ?? 1.5
RECEIVER_HEIGHT_M = 1.2      # docs/ACOUSTIC-LAB.md: listening height, default 1.2 m
SHAPE_NOTE = ("Spectrum shape assumed: the simulation's own 'road' profile (web/src/acoustics/demo.ts), because "
              "no research file gives the band values of the OITC reference transportation spectrum (ASTM E1332) "
              "that R3 cites. Only the A-weighted total is the model's.")


def a_weighted(spectrum):
    """A-weighted total of an eight-band spectrum (OctaveSpectrum.totalDb(true))."""
    return db.level(sum(10.0 ** ((x + w) / 10.0) for x, w in zip(spectrum, A_WEIGHTING)))


def spectrum_for(a_level, shape=ROAD_SHAPE):
    """Shape scaled so its A-weighted total is a_level, rounded to 0.01 dB."""
    off = a_level - a_weighted(shape)
    return [round(x + off, 2) for x in shape]


def model_id(prop):
    return prop.get("matterport_model_id") or prop.get("id")


def _single_sources(sources):
    """One sources dict per outdoor source the model computes (aircraft are left out: not a ground point)."""
    empty = {"roads": [], "rail": [], "construction": [], "mechanical": [], "flights": [], "barriers": sources.get("barriers") or [],
             "tree_cover": sources.get("tree_cover"), "building_rows": sources.get("building_rows"),
             "outdoor_levels_dba": {}}
    out = []
    for road in sources.get("roads") or []:
        if road.get("aadt"):
            s = dict(empty, roads=[road])
            out.append(("road:%s" % road["id"], "road", road.get("name") or road["id"], s))
    levels = sources.get("outdoor_levels_dba") or {}
    if not any(r.get("aadt") for r in sources.get("roads") or []) and levels.get("road") is not None:
        out.append(("road:mapped", "road", "mapped road level", dict(empty, outdoor_levels_dba={
            k: levels.get(k) for k in ("road", "road_profile", "road_bearing_deg", "road_distance_m")})))
    if levels.get("rail") is not None:
        out.append(("rail:mapped", "rail", "mapped rail level", dict(empty, rail=sources.get("rail") or [],
                                                                     outdoor_levels_dba={
            k: levels.get(k) for k in ("rail", "rail_bearing_deg", "rail_distance_m")})))
    for site in sources.get("construction") or []:
        out.append(("construction:%s" % site.get("id", "site"), "construction", site.get("name") or site.get("id"),
                    dict(empty, construction=[site])))
    for machine in sources.get("mechanical") or []:
        out.append(("mechanical:%s" % machine.get("id", "equipment"), "mechanical", machine.get("name") or machine.get("id"),
                    dict(empty, mechanical=[machine])))
    return out


def build(prop, sources, overrides=None, result=None):
    """Return (lab_sources dict, room_targets dict)."""
    src = dict(sources)
    src.pop("measured", None)
    res, raw = run(prop, src, overrides)
    result = result or res
    a = raw["_assumptions"]
    b = raw["_building"]
    hours = outdoor.block_hours(a)
    fp = prop.get("facade_point") or {"lat": prop["lat"], "lon": prop["lon"]}
    origin = (float(fp["lat"]), float(fp["lon"]))
    rh = a.value("outdoor.bts.receptor_height") + (b.unit_floor - 1) * a.value("rooms.storey_height")
    floor_drop = (b.unit_floor - 1) * a.value("rooms.storey_height")
    walls = [{"id": w["id"], "azimuth": w["azimuth"]} for w in b.walls]
    geom = {w["id"]: w.get("geometry") for r in prop["rooms"] for w in r.get("exterior_walls") or []}
    mid = model_id(prop)

    blocks = {name: [] for name in hours}
    derivation, omitted = {}, []
    if sources.get("flights") or (sources.get("outdoor_levels_dba") or {}).get("aviation") is not None:
        omitted.append("aircraft: overhead events are not a ground point source; not exported")
    for sid, mode, label, single in _single_sources(src):
        levels, info, _, _, _ = outdoor.wall_levels(walls, single, rh, origin, a, [])
        per_wall = {}
        for w in walls:
            hourly = levels[w["id"]].get(mode)
            if hourly is None:
                continue
            per_wall[w["id"]] = {name: db.energy_mean([hourly[h] for h in hs]) for name, hs in hours.items()}
        usable = [wid for wid in per_wall if geom.get(wid) and any(v is not None for v in per_wall[wid].values())]
        if not usable:
            omitted.append("%s: no exposed wall with model geometry (plan coordinates) to place it against" % sid)
            continue
        ref = max(usable, key=lambda wid: db.energy_mean(list(per_wall[wid].values())))
        g = geom[ref]
        terms = info[ref]["terms"] or {}
        dist = terms.get("distance")
        if dist is None:
            omitted.append("%s: distance to the source unknown" % sid)
            continue
        mx, mz = (g["a"][0] + g["b"][0]) / 2.0, (g["a"][1] + g["b"][1]) / 2.0
        nx, nz = g["outward"]
        receiver = {"x": round(mx, 3), "y": round(g["base_elevation_m"] + RECEIVER_HEIGHT_M, 3), "z": round(mz, 3)}
        source_height = single["mechanical"][0].get("height_m", SOURCE_HEIGHT_M) if single["mechanical"] else SOURCE_HEIGHT_M
        position = {"x": round(mx + nx * dist, 3), "y": round(g["base_elevation_m"] + source_height - floor_drop, 3),
                    "z": round(mz + nz * dist, 3)}
        r = math.sqrt(sum((position[k] - receiver[k]) ** 2 for k in "xyz"))
        wall_levels = {}
        for name in hours:
            lw = per_wall[ref][name]
            wall_levels[name] = None if lw is None else round(lw, 2)
            if lw is None:
                continue
            blocks[name].append({
                "id": sid,
                "position": position,
                "spectrumDbAt1m": spectrum_for(lw + 20.0 * math.log10(max(1.0, r)), SOURCE_SHAPES[mode]),
                "enabled": True,
                "evidence": {
                    "kind": "derived",
                    "source": "Hush noise model %s, %s block: %s level at wall %s" % (result["model_version"], name, label, ref),
                    "note": "A point source stands in for a %s. %s" % ("road (a line source)" if mode == "road" else mode,
                                                                      SHAPE_NOTE if mode in ("road", "rail") else "Mode-specific spectrum is assumed; only its A-weighted total comes from the emissions model."),
                },
            })
        derivation[sid] = {
            "mode": mode, "name": label, "reference_wall": ref,
            "reference_room": next(w["room"] for w in b.walls if w["id"] == ref),
            "wall_level_dba": wall_levels,
            "other_walls_dba": {wid: {k: (None if v is None else round(v, 2)) for k, v in lv.items()}
                                for wid, lv in per_wall.items() if wid != ref},
            "distance_to_source_m": round(dist, 2),
            "receiver": receiver,
            "receiver_to_source_m": round(r, 3),
            "check": "A-weighted total of spectrumDbAt1m - 20*log10(receiver_to_source_m) = wall_level_dba",
            "shielding_at_reference_wall_db": round(terms.get("total", 0.0), 2),
        }
    lab = {
        "schemaVersion": 1,
        "modelId": mid,
        "coordinateSystem": "local-meters-y-up",
        "frame": "The simulation's scene frame (web/src/acoustics/engine/importer.ts): x = Matterport plan x, "
                 "z = Matterport plan y, y = elevation, metres. The Showcase overlay may mirror z when it draws on "
                 "the 3D view (alignPolygon); the solver, the grid and the demo sources use this unmirrored frame.",
        "spectrum": "spectrumDbAt1m: unweighted sound pressure level at 1 m in the octave bands %s Hz." % OCTAVES,
        "blockHours": {name: [hs[0], hs[-1] + 1] for name, hs in hours.items()},
        "blocks": blocks,
        "derivation": derivation,
        "omitted": omitted,
    }
    targets = {
        "schemaVersion": 1,
        "modelId": mid,
        "weighting": "A",
        "units": "dBA",
        "note": "Per-room predictions of the Hush noise model for calibrating the heat map. All levels are "
                "A-weighted equivalent levels inside the room (windows and doors as modelled), the energy mean of "
                "each block's hours; range_dba is the model's stated range; dnl_dba is the daily score. null means "
                "below the 15 dBA reporting floor.",
        "modelVersion": result["model_version"],
        "blockHours": {name: [hs[0], hs[-1] + 1] for name, hs in hours.items()},
        "rooms": {},
    }
    by_id = {r["id"]: r for r in prop["rooms"]}
    for room in result["rooms"]:
        key = by_id[room["id"]].get("matterport_id") or room["id"]
        targets["rooms"][key] = {
            "name": room["name"],
            "blocks": {name: {"dba": blk["dba"], "range_dba": blk["range_dba"]} for name, blk in room["blocks"].items()},
            "l24_dba": room["l24_dba"],
            "dnl_dba": room["dnl_dba"],
            "range_db": room["range_db"],
        }
    return lab, targets


def write(prop, sources, out_dir, overrides=None, result=None):
    lab, targets = build(prop, sources, overrides, result)
    mid = model_id(prop)
    paths = (os.path.join(out_dir, "lab_sources.%s.json" % mid), os.path.join(out_dir, "room_targets.%s.json" % mid))
    for path, data in zip(paths, (lab, targets)):
        with open(path, "w") as fh:
            fh.write(json.dumps(data, indent=2, allow_nan=False) + "\n")
    return paths
