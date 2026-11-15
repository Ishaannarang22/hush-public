"""Saved Matterport Model API response -> property.json (docs/BUILD_BRIEF.md section 5).

    python -m noisemodel.matterport samples/matterport_model_zzvymDx5ty7.json \
        --windows samples/windows.zzvymDx5ty7.json --out samples/property.zzvymDx5ty7.json

General: nothing here knows about one property. It reads the fields the simulation on `main` reads
(web/src/acoustics/matterport.ts ApiRoom, ApiEdge, ApiOpening; engine/importer.ts units), with the same
rules:

- Room outlines are stitched from unordered boundary edges by endpoint (1.5 cm), like `roomPolygon`.
  An outline that does not close is skipped with a warning. Edges left over after the outline closes
  (spurs inside a room) are not walls of the outline and are listed as warnings.
- Dimensional fields (`dimensions`, `dimensionEstimates`) are in the declared units ("imperial" is feet);
  edge vertices and opening width, height and lowerElevation are already metres. `lowerElevation` is
  absolute model elevation.
- An edge (by id) in two rooms' outlines is a partition between them; in one room's outline, a boundary
  wall; type "invisible" means open plan (a partition that is all opening; a boundary that is no wall).
- Wall compass bearing comes from `geocoordinates.geoLocationOf` at the model origin and 10 m along +x and
  +y, saved with the response (R10), not from the rotation quaternion. The quaternion formula from R10 is
  only a fallback, with a warning.

The window survey (same shape as the simulation's opening import, docs/ACOUSTIC-LAB.md) adds windows and
exterior doors to boundary walls and can set any boundary wall's exposure. Default exposure: a wall with a
window is "outdoor"; otherwise "unknown", which the model treats as not exposed and lists in a warning.
"""
import argparse
import json
import math
import sys

from .assumptions import Assumptions

FT = 0.3048
JOIN_TOLERANCE_M = 0.015  # roomPolygon in web/src/acoustics/matterport.ts
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LON_EQUATOR = 111320.0

# Matterport room tags -> the model's room types (only "bedroom" changes a result: the report's
# bedroom tables). First match wins, in this order.
TYPE_BY_TAG = (
    ("bedroom", "bedroom"), ("living", "living"), ("family", "living"), ("dining", "living"),
    ("kitchen", "kitchen"), ("bathroom", "bathroom"), ("toilet", "bathroom"), ("closet", "closet"),
    ("storage", "closet"), ("laundry", "closet"), ("utility", "closet"), ("corridor", "corridor"),
    ("hallway", "corridor"), ("entrance", "corridor"), ("foyer", "corridor"), ("office", "office"),
)
EXPOSURES = ("outdoor", "not_outdoor", "unknown")


def model_of(response):
    """Accept {"data": {"model": ...}}, {"model": ...} or the model itself."""
    if "data" in response:
        response = response["data"]
    return response.get("model", response)


def units(value, unit):
    """Dimensional field to metres (importer.ts `units`)."""
    if value is None:
        return None
    value = float(value)
    if not math.isfinite(value):
        raise ValueError("invalid Matterport dimension")
    if unit == "imperial":
        return value * FT
    if unit == "metric":
        return value
    raise ValueError("unknown dimension units %r" % unit)


def _pts(edge):
    return [(float(v["position"]["x"]), float(v["position"]["y"])) for v in edge.get("vertices") or []]


def _same(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1]) < JOIN_TOLERANCE_M


def stitch(edges):
    """Closed outline from unordered edges, as `roomPolygon` does. Returns (points, used edge indices);
    ([], []) if the outline does not close."""
    segs = [(i, _pts(e)) for i, e in enumerate(edges) if len(e.get("vertices") or []) >= 2]
    if not segs:
        return [], []
    pending = segs[:]
    i0, first = pending.pop(0)
    points, used = [first[0], first[-1]], [i0]
    while pending:
        last = points[-1]
        k = next((k for k, (_, s) in enumerate(pending) if _same(s[0], last) or _same(s[-1], last)), None)
        if k is None:
            break
        i, s = pending.pop(k)
        used.append(i)
        points.append(s[-1] if _same(s[0], last) else s[0])
        if _same(points[-1], points[0]):
            points.pop()
            return points, used
    return [], []


def polygon_area(points):
    n = len(points)
    return 0.5 * abs(sum(points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1]
                         for i in range(n)))


def point_in_polygon(points, x, y):
    inside = False
    n = len(points)
    for i in range(n):
        (ax, ay), (bx, by) = points[i], points[(i + 1) % n]
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            inside = not inside
    return inside


def _edge_key(room_id, index, edge):
    if edge.get("id"):
        return edge["id"]
    p = _pts(edge)
    ends = sorted((round(q[0], 2), round(q[1], 2)) for q in (p[0], p[-1]))
    return "edge:%s,%s:%s,%s" % (ends[0][0], ends[0][1], ends[1][0], ends[1][1])


def _outward(points, a, b, into_hole=False):
    """Unit normal of edge a-b pointing out of the polygon (into the hole for a hole edge)."""
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    nx, ny = uy, -ux
    mx, my = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0
    probe = min(0.2, 0.25 * L)
    inside = point_in_polygon(points, mx + probe * nx, my + probe * ny)
    if inside != into_hole:
        nx, ny = -nx, -ny
    return nx, ny


# ---------------------------------------------------------------- georeference

def _project(lat, lon, lat0, lon0):
    return ((lon - lon0) * M_PER_DEG_LON_EQUATOR * math.cos(math.radians(lat0)), (lat - lat0) * M_PER_DEG_LAT)


class Georeference(object):
    """Model x/y (metres) to east/north metres and lat/lon, from geoLocationOf samples (R10)."""

    def __init__(self, model, warnings):
        geo = model.get("geocoordinates") or {}
        self.source = geo.get("source")
        o, px, py = geo.get("origin"), geo.get("plusX10m"), geo.get("plusY10m")
        loc = model.get("geolocation") or {}
        if o and px and py:
            self.lat0, self.lon0 = float(o["lat"]), float(o["long"])
            ex = _project(float(px["lat"]), float(px["long"]), self.lat0, self.lon0)
            ey = _project(float(py["lat"]), float(py["long"]), self.lat0, self.lon0)
            self.ex = (ex[0] / 10.0, ex[1] / 10.0)
            self.ey = (ey[0] / 10.0, ey[1] / 10.0)
            self.method = "geoLocationOf at the model origin and 10 m along +x and +y (R10)"
        elif geo.get("rotation"):
            q = geo["rotation"]
            theta = 2.0 * math.atan2(float(q["z"]), float(q["w"]))
            # R10 Equations: bearing of model direction (vx, vy) = 90 - (theta + atan2(vy, vx)), as ENU
            self.ex = (math.cos(theta), math.sin(theta))
            self.ey = (-math.sin(theta), math.cos(theta))
            self.lat0 = float(geo.get("latitude", loc.get("lat")))
            self.lon0 = float(geo.get("longitude", loc.get("long")))
            self.method = "rotation quaternion, R10 formula (fallback: no geoLocationOf samples saved)"
            warnings.append("No geoLocationOf samples in the response; wall bearings use the rotation "
                            "quaternion (R10 formula) and positions use the model geolocation as the origin.")
        else:
            raise ValueError("the response has no geocoordinates, so wall bearings cannot be found")

    def bearing(self, vx, vy):
        e = vx * self.ex[0] + vy * self.ey[0]
        n = vx * self.ex[1] + vy * self.ey[1]
        return math.degrees(math.atan2(e, n)) % 360.0

    def latlon(self, x, y):
        e = x * self.ex[0] + y * self.ey[0]
        n = x * self.ex[1] + y * self.ey[1]
        return (self.lat0 + n / M_PER_DEG_LAT,
                self.lon0 + e / (M_PER_DEG_LON_EQUATOR * math.cos(math.radians(self.lat0))))

    def axis_bearings(self):
        return {"+x": round(self.bearing(1.0, 0.0), 2), "+y": round(self.bearing(0.0, 1.0), 2)}


# ---------------------------------------------------------------- survey

def load_survey(survey, model_id):
    """Check the opening file as the simulation's parseOpeningDataset does, plus this model's fields."""
    if survey is None:
        return {"openings": [], "exposure": [], "property": {}}
    if survey.get("schemaVersion") != 1 or survey.get("modelId") != model_id or survey.get("units") != "meters" \
            or not isinstance(survey.get("openings"), list):
        raise ValueError("opening file must be version 1, metres, and match modelId %s" % model_id)
    seen = set()
    for o in survey["openings"]:
        if not o.get("id") or not o.get("wallId") or o["id"] in seen or o.get("kind") not in ("window", "door", "opening"):
            raise ValueError("invalid or duplicate opening id/kind: %r" % o.get("id"))
        seen.add(o["id"])
        vals = [o.get(k) for k in ("centerFraction", "widthM", "heightM", "lowerElevationM")]
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in vals) or not 0 <= o["centerFraction"] <= 1 \
                or o["widthM"] <= 0 or o["heightM"] <= 0:
            raise ValueError("invalid opening dimensions: %s" % o["id"])
        ev = o.get("evidence") or {}
        if not ev.get("source") or ev.get("kind") not in ("measured", "assumed", "derived"):
            raise ValueError("opening %s needs evidence (kind and source)" % o["id"])
    for e in survey.get("exposure") or []:
        if e.get("exposure") not in EXPOSURES or not e.get("wallId"):
            raise ValueError("invalid exposure entry %r" % e)
    return {"openings": survey["openings"], "exposure": survey.get("exposure") or [],
            "property": survey.get("property") or {}}


# ---------------------------------------------------------------- build

def _room_type(tags, label):
    words = [t.lower() for t in (tags or [])] + ([label.lower()] if label else [])
    for tag, kind in TYPE_BY_TAG:
        if any(tag in w for w in words):
            return kind
    return "other"


def _room_name(room, tags):
    if room.get("label"):
        return room["label"]
    if tags:
        names = [t.replace("_", " ") for t in tags]
        text = " and ".join(names) if len(names) <= 2 else ", ".join(names[:-1]) + " and " + names[-1]
        return text[0].upper() + text[1:]
    return "Untagged room %s" % room["id"][:6]


def build_property(response, survey=None, assumptions=None, response_path=None, survey_path=None):
    """Return (property dict, loader warnings)."""
    a = assumptions or Assumptions.load()
    model = model_of(response)
    model_id = model["id"]
    sv = load_survey(survey, model_id)
    warnings = []
    geo = Georeference(model, warnings)
    resp_name = response_path or "the saved Matterport Model API response"
    height_default = a.value("rooms.height_default")

    rooms, outlines, heights, bases = [], {}, {}, {}
    edge_rooms = {}   # key -> [(room id, edge, outline points, is_hole)]
    names_seen = {}
    for r in model.get("rooms") or []:
        rid = r["id"]
        tags = r.get("tags") or []
        edges = (r.get("boundary") or {}).get("edges") or []
        outline, used = stitch(edges)
        if len(outline) < 3:
            warnings.append("Room %s: the boundary does not close into an outline; the room is skipped "
                            "(as the simulation does)." % rid)
            continue
        for i, e in enumerate(edges):
            if i not in used and len(e.get("vertices") or []) >= 2:
                warnings.append("Room %s: edge %s is not part of the closed outline (a spur inside the room); "
                                "it is not used as a wall." % (rid, _edge_key(rid, i, e)))
        holes = []
        for h in r.get("holes") or []:
            hp, hu = stitch(h.get("edges") or [])
            if len(hp) >= 3:
                holes.append((hp, [h["edges"][i] for i in hu]))
        dims, est = r.get("dimensions") or {}, r.get("dimensionEstimates") or {}
        height = units(dims.get("height"), dims.get("units")) if dims.get("height") is not None else None
        height_from = "dimensions.height"
        if height is None and est.get("height") is not None:
            height, height_from = units(est["height"], est.get("units")), "dimensionEstimates.height"
        height_status = "measured"
        if height is None:
            height, height_from, height_status = height_default, "rooms.height_default (assumed)", "assumed"
            warnings.append("Room %s: no height in the response; %.2f m from rooms.height_default is used "
                            "(placeholder)." % (rid, height))
        base = units(est.get("lowerElevation"), est.get("units")) if est.get("lowerElevation") is not None else 0.0
        area = polygon_area(outline) - sum(polygon_area(hp) for hp, _ in holes)
        name = _room_name(r, tags)
        names_seen[name] = names_seen.get(name, 0) + 1
        if names_seen[name] > 1:
            name = "%s %d" % (name, names_seen[name])
        rooms.append({
            "id": rid,
            "name": name,
            "type": _room_type(tags, r.get("label")),
            "matterport_id": rid,
            "tags": tags,
            "area_m2": round(area, 3),
            "height_m": round(height, 3),
            "height_status": height_status,
            "volume_m3": round(area * height, 3),
            "floor_id": (r.get("floor") or {}).get("id"),
            "base_elevation_m": round(base, 3),
            "outline_m": [[round(x, 4), round(y, 4)] for x, y in outline],
            "source": "%s: room %s; floor area from the stitched boundary outline (%d edges)%s; height from %s"
                      % (resp_name, rid, len(used), ", holes removed" if holes else "", height_from),
            "exterior_walls": [],
        })
        outlines[rid] = outline
        heights[rid] = height
        bases[rid] = base
        for i in used:
            e = edges[i]
            edge_rooms.setdefault(_edge_key(rid, i, e), []).append((rid, e, outline, False))
        for hp, hedges in holes:
            for j, e in enumerate(hedges):
                edge_rooms.setdefault(_edge_key(rid, 1000 + j, e), []).append((rid, e, hp, True))

    room_by_id = {r["id"]: r for r in rooms}
    partitions, boundary = [], []
    for key in sorted(edge_rooms, key=lambda k: (min(x[0] for x in edge_rooms[k]), k)):
        owners = edge_rooms[key]
        rids = sorted({o[0] for o in owners})
        edge = owners[0][1]
        p = _pts(edge)
        a_pt, b_pt = p[0], p[-1]
        length = math.hypot(b_pt[0] - a_pt[0], b_pt[1] - a_pt[1])
        if length < 1e-3:
            continue
        invisible = edge.get("type") == "invisible"
        if len(rids) > 2:
            warnings.append("Edge %s is in %d room outlines; it is treated as a partition between the first two."
                            % (key, len(rids)))
        if len(rids) >= 2:
            ra, rb = rids[0], rids[1]
            h = min(heights[ra], heights[rb])
            area = length * h
            src = "%s: edge %s shared by rooms %s and %s, %.2f m long x %.2f m (lower of the two room heights)" % (
                resp_name, key, ra, rb, length, h)
            if invisible:
                partitions.append({"id": "p-%s" % key, "room_a": ra, "room_b": rb, "kind": "opening",
                                   "area_m2": round(area, 3), "door": "open", "edge_id": key,
                                   "source": src + "; edge type invisible (open plan), all of it is an opening"})
                continue
            ops = [o for o in edge.get("openings") or [] if o.get("type") in ("doorway", "opening")]
            for o in edge.get("openings") or []:
                if o.get("type") not in ("doorway", "opening"):
                    warnings.append("Opening %s of type %r on partition edge %s is not modelled." % (
                        o.get("id"), o.get("type"), key))
            if not ops:
                partitions.append({"id": "p-%s" % key, "room_a": ra, "room_b": rb, "kind": "wall",
                                   "area_m2": round(area, 3), "partition_type": None, "door": "none",
                                   "edge_id": key, "source": src})
                continue
            share = area / len(ops)   # one partition record per opening, the wall shared equally
            for n, o in enumerate(ops):
                w, oh = float(o["width"]), float(o.get("height") or a.value("partitions.door_area") / float(o["width"]))
                rec = {"id": "p-%s" % key if len(ops) == 1 else "p-%s-%d" % (key, n + 1),
                       "room_a": ra, "room_b": rb, "kind": "wall", "area_m2": round(share, 3),
                       "partition_type": None, "door_area_m2": round(w * oh, 3), "edge_id": key,
                       "opening_id": o.get("id")}
                osrc = "; %s %s %.2f m wide x %s high (Model API vector opening, metres)" % (
                    o["type"], o.get("id"), w, "%.2f m" % oh if o.get("height") is not None else "unknown")
                if o["type"] == "doorway":
                    rec.update({"door": "closed", "door_type": None, "door_status": "assumed",
                                "source": src + osrc + ". A door leaf, its type and its state are not in the scan: "
                                          "a closed hollow-core door is assumed (partitions.default_door)"})
                else:
                    rec.update({"door": "open",
                                "source": src + osrc + ". Type 'opening': an open aperture with no door leaf"})
                partitions.append(rec)
            continue
        rid, _, outline, is_hole = owners[0]
        if invisible:
            warnings.append("Boundary edge %s of room %s is invisible (no wall); it is not modelled." % (key, rid))
            continue
        nx, ny = _outward(outline, a_pt, b_pt, into_hole=is_hole)
        boundary.append({
            "id": key, "room": rid, "a": a_pt, "b": b_pt, "length": length, "outward": (nx, ny),
            "thickness_m": edge.get("thickness"), "is_hole": is_hole,
            "api_openings": edge.get("openings") or [],
            "azimuth": geo.bearing(nx, ny),
        })

    # ------------------------------------------------ survey: openings and exposure per boundary wall
    by_wall = {w["id"]: w for w in boundary}
    shared_ids = {p["edge_id"] for p in partitions}
    openings = {w["id"]: [] for w in boundary}
    for w in boundary:
        for o in w["api_openings"]:
            kind = {"window": "window", "doorway": "door"}.get(o.get("type"), "opening")
            openings[w["id"]].append({
                "id": o.get("id"), "kind": kind, "widthM": float(o["width"]),
                "heightM": float(o["height"]) if o.get("height") is not None else None,
                "lowerElevationM": o.get("lowerElevation"), "centerFraction": o.get("relativeCenter"),
                "evidence": {"kind": "measured", "source": "Matterport Model API vector opening"},
                "from_api": True})
    for o in sv["openings"]:
        if o["wallId"] not in by_wall:
            where = "a partition between two rooms" if o["wallId"] in shared_ids else "not a boundary wall here"
            raise ValueError("survey opening %s names wall %s, which is %s" % (o["id"], o["wallId"], where))
        lst = openings[o["wallId"]]
        lst[:] = [x for x in lst if x["id"] != o["id"]]
        lst.append(dict(o))
    exposure_set = {}
    for e in sv["exposure"]:
        if e["wallId"] not in by_wall:
            raise ValueError("exposure entry names wall %s, which is not a boundary wall" % e["wallId"])
        exposure_set[e["wallId"]] = e

    other = []
    for w in boundary:
        ops = openings[w["id"]]
        windows = [o for o in ops if o["kind"] in ("window", "opening")]
        glazed_doors = [o for o in ops if o["kind"] == "door" and o.get("doorType")]
        if w["id"] in exposure_set:
            e = exposure_set[w["id"]]
            exposure = e["exposure"]
            ev = e.get("evidence") or {}
            why = "survey file: %s (%s)" % (ev.get("source", "no source given"), ev.get("kind", "unstated"))
        elif w["is_hole"]:
            exposure, why = "not_outdoor", "edge of a hole inside the room outline"
        elif windows or glazed_doors:
            exposure, why = "outdoor", "default rule: the wall has a surveyed window or glazed door"
        else:
            exposure, why = "unknown", "default rule: no window found on it, so the scan cannot tell outdoors from a neighbour or corridor"
        room = room_by_id[w["room"]]
        h = heights[w["room"]]
        geom = {"a": [round(w["a"][0], 4), round(w["a"][1], 4)], "b": [round(w["b"][0], 4), round(w["b"][1], 4)],
                "outward": [round(w["outward"][0], 4), round(w["outward"][1], 4)],
                "base_elevation_m": round(bases[w["room"]], 3), "height_m": round(h, 3),
                "thickness_m": w["thickness_m"]}
        if exposure != "outdoor":
            other.append({"id": w["id"], "room": w["room"], "exposure": exposure, "exposure_source": why,
                          "azimuth_deg": round(w["azimuth"], 1), "area_m2": round(w["length"] * h, 3),
                          "openings": [o["id"] for o in ops], "geometry": geom})
            continue
        wall = {"id": w["id"], "azimuth_deg": round(w["azimuth"], 1), "area_m2": round(w["length"] * h, 3),
                "wall_type": None, "exposure": "outdoor", "exposure_source": why, "geometry": geom}
        src = ["%s: boundary edge %s, %.2f m long x %.2f m (room height); facing %.1f deg from the edge's outward "
               "normal and %s" % (resp_name, w["id"], w["length"], h, w["azimuth"], geo.method)]
        if windows:
            area = sum(o["widthM"] * o["heightM"] for o in windows)
            status = "assumed" if any(o["evidence"]["kind"] == "assumed" for o in windows) else "measured"
            types = {o.get("glazing") for o in windows}
            if len(types) > 1:
                warnings.append("Wall %s has windows with different glazing; the first one's type is used." % w["id"])
            operable = [o.get("operable") for o in windows]
            wall.update({"window_area_m2": round(area, 3), "window_area_status": status,
                         "window_type": windows[0].get("glazing"),
                         "window_fixed": all(x is False for x in operable),
                         "window_ids": [o["id"] for o in windows]})
            if any(o["kind"] == "opening" for o in windows):
                wall["window_open"] = True
            src.append("windows %s, %.2f m2 in all (%s; %s)" % (
                ", ".join(o["id"] for o in windows), area, status, (survey_path or "survey file")))
        elif ops:
            status = "assumed" if any(o["evidence"]["kind"] == "assumed" for o in ops) else "measured"
            wall.update({"window_area_m2": 0, "window_area_status": status, "window_type": None})
            src.append("surveyed: no window, only the door(s) below")
        else:
            wall.update({"window_area_m2": None, "window_type": None})
            src.append("no survey entry: the 15% rule applies (facade.window_fraction_default)")
        doors = [o for o in ops if o["kind"] == "door"]
        if doors:
            darea = sum(o["widthM"] * (o["heightM"] or 2.03) for o in doors)
            dtype = doors[0].get("doorType")
            wall.update({"door_area_m2": round(darea, 3), "door_type": dtype, "door_ids": [o["id"] for o in doors]})
            if not dtype:
                wall["door_type_status"] = "assumed"
            src.append("exterior doors %s, %.2f m2 (type %s)" % (
                ", ".join(o["id"] for o in doors), darea, dtype or "not surveyed: doors_exterior.default"))
        else:
            wall.update({"door_area_m2": 0, "door_type": None})
        wall["source"] = "; ".join(src)
        room["exterior_walls"].append(wall)

    unknown = [o["id"] for o in other if o["exposure"] == "unknown"]
    if unknown:
        warnings.append("Boundary walls with unknown exposure, treated as not exposed to outdoor noise: %s."
                        % ", ".join(unknown))
    for w in (x for r in rooms for x in r["exterior_walls"]):
        if w["window_area_m2"] is None:
            warnings.append("Wall %s is exposed but has no survey entry; the 15%% window rule is used." % w["id"])

    # ------------------------------------------------ property-level fields
    pv = sv["property"]
    loc = model.get("geolocation") or {}
    addr = (model.get("address") or {}).get("address")
    exposed = [x for r in rooms for x in r["exterior_walls"]]
    if exposed:
        mids = [((x["geometry"]["a"][0] + x["geometry"]["b"][0]) / 2.0,
                 (x["geometry"]["a"][1] + x["geometry"]["b"][1]) / 2.0, x["area_m2"]) for x in exposed]
        tot = sum(m[2] for m in mids)
        fx, fy = sum(m[0] * m[2] for m in mids) / tot, sum(m[1] * m[2] for m in mids) / tot
        fp_note = "area-weighted midpoint of the exposed walls"
    else:
        pts = [p for o in outlines.values() for p in o]
        fx, fy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        fp_note = "mean of the room outline vertices (no exposed wall)"
    flat, flon = geo.latlon(fx, fy)
    prop = {
        "id": "matterport-%s" % model_id,
        "matterport_model_id": model_id,
        "name": model.get("name"),
        "address": addr,
        "lat": float(loc["lat"]) if loc.get("lat") not in (None, "null") else geo.lat0,
        "lon": float(loc["long"]) if loc.get("long") not in (None, "null") else geo.lon0,
        "source": "%s: address and geolocation (geocoordinates source %r)" % (resp_name, geo.source),
        "north_offset_deg": 0,
        "north_offset_note": "Added to every wall azimuth. North comes from Matterport's georeference (source %r), "
                             "which R10 found can be wrong; correct it here in one place." % geo.source,
        "model_frame": {
            "axis_bearings_deg": geo.axis_bearings(),
            "method": geo.method,
            "note": "Model plan x/y in metres; the simulation's scene uses x = model x, z = model y, y up "
                    "(web/src/acoustics/engine/importer.ts).",
        },
        "facade_point": {"lat": round(flat, 7), "lon": round(flon, 7), "model_xy": [round(fx, 3), round(fy, 3)],
                         "source": "%s, placed with the model georeference (%s). Used as the receiver for every "
                                   "exterior wall." % (fp_note, geo.method)},
        "year_built": pv.get("year_built"),
        "construction": pv.get("construction"),
        "era": pv.get("era") or {"value": "2000_on", "status": "assumed",
                                 "source": "docs/BUILD_BRIEF.md section 5 step 4: year built not in the response; "
                                           "2000 onward defaults, overridable with --set property.era=..."},
        "storeys": pv.get("storeys"),
        "unit_floor": pv.get("unit_floor", 1),
        "unit_floor_status": pv.get("unit_floor_status", "assumed"),
        "unit_floor_source": pv.get("unit_floor_source",
                                    "Not in the response (the scan's floor sequence is not the building storey); "
                                    "ground floor assumed"),
        "geometry_quality": "measured",
        "geometry_source": "Rooms, partitions and boundary walls from %s (noisemodel/matterport.py). Windows and "
                           "exposure from %s." % (resp_name, survey_path or "no survey file"),
        "rooms": rooms,
        "partitions": partitions,
        "other_boundary_walls": other,
        "loader_warnings": warnings,
    }
    return prop, warnings


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m noisemodel.matterport", description=__doc__.split("\n")[0])
    ap.add_argument("response", help="saved Matterport Model API response (JSON)")
    ap.add_argument("--windows", help="window survey in the simulation's opening-import shape")
    ap.add_argument("--out", help="write property.json here (default: stdout)")
    args = ap.parse_args(argv)
    with open(args.response) as fh:
        response = json.load(fh)
    survey = None
    if args.windows:
        with open(args.windows) as fh:
            survey = json.load(fh)
    prop, warnings = build_property(response, survey, response_path=args.response, survey_path=args.windows)
    text = json.dumps(prop, indent=2, allow_nan=False) + "\n"
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(text)
        for w in warnings:
            sys.stderr.write("warning: %s\n" % w)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
