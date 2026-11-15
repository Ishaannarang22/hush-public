"""Unit profile: the facts that decide a unit's indoor noise, filled in by the model, editable by the client.

docs/UNIT_PROFILE_PLAN.md (issue #36) and docs/UNIT_PROFILE.md. It extends the existing model: every
profile value is a better value for an input `noisemodel` already has. With no profile in use nothing
here runs, and every existing output is unchanged (tests/test_profile_regression.py).

    build(prop, sources=None, context=None)         -> profile: every field with value, label, note, choices
    apply(prop, sources, profile, edits)            -> (prop2, sources2, log); never mutates its inputs
    score(result, ...)                              -> noisemodel.score.score (re-exported)
    worth_checking(prop, sources, profile, edits)   -> fields ranked by how far they could move the unit score
    compare(prop, sources, profile, edits)          -> auto-filled score, edited score, the change each edit made

Field definitions live in noisemodel/profile_fields.yaml. Labels (plan section 4): scan, costar, map,
inferred, assumed, edited. `context` is the local CoStar context record (phase B); tests use made-up records.
"""
import copy
import json
import math
import os
import re

import yaml

from . import facade
from . import score as score_mod
from .assumptions import Assumptions

FIELDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "profile_fields.yaml")
SCHEMA_VERSION = 1
CONFIRMED = ("scan", "costar", "map", "edited")
SIDE_EXPOSURES = ("outdoors", "corridor", "neighbouring_unit", "unknown")
COMPASS = ("north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west")
_SPEC = {}


class ProfileError(ValueError):
    """An impossible edit. The message is meant for the client."""


def spec():
    if "fields" not in _SPEC:
        with open(FIELDS_PATH) as fh:
            _SPEC.update(yaml.safe_load(fh))
    return _SPEC


def score(result, a=None, ranges=None, areas=None):
    return score_mod.score(result, a, ranges, areas)


# ---------------------------------------------------------------- choices

def choices(field_id, a=None):
    """Allowed values of a field. With choices_from, read from assumptions.yaml (rated entries only)."""
    d = spec()["fields"][field_id]
    if "choices" in d:
        return list(d["choices"])
    a = a or Assumptions.load()
    section = a._tree[d["choices_from"]]
    out = []
    for key, node in section.items():
        if str(key).endswith("_offset") or not isinstance(node, dict) or "value" not in node:
            continue
        v = node["value"]
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float, dict)):
            out.append(str(key))
    return out


def name(value):
    names = spec().get("names") or {}
    if value is None:
        return "Not known"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return ("%g" % value)
    return names.get(str(value), str(value).replace("_", " "))


# ---------------------------------------------------------------- elements of the unit

def _facing(az):
    if az is None:
        return "unknown direction"
    return COMPASS[int(((float(az)) + 22.5) % 360 // 45)]


def _room_names(prop):
    return {r["id"]: r.get("name") or r["id"] for r in prop["rooms"]}


def _outdoor_walls(prop):
    for r in prop["rooms"]:
        for w in r.get("exterior_walls") or []:
            yield r, w


def _is_entry(w):
    return "entry door" in (w.get("exposure_source") or "").lower() or w.get("entry_door") is True


def _entry_door_area(w, a):
    m = re.search(r"entry door[^0-9]*?(\d+(?:\.\d+)?) x (\d+(?:\.\d+)?) m", w.get("exposure_source") or "")
    if m:
        return round(float(m.group(1)) * float(m.group(2)), 3), "measured in the scan (%s x %s m)" % m.groups()
    return float(a.value("partitions.door_area")), "partitions.door_area (placeholder; no size in the scan)"


def _boundary_sides(prop):
    """Boundary walls that are sides of the unit: unknown exposure, or the entry-door wall.

    Walls the survey derived as interior ('not_outdoor' with the unit's own space beyond) are interior
    walls and are not listed (plan section 3). Walls without an area and facing cannot be listed.
    """
    for w in prop.get("other_boundary_walls") or []:
        if w.get("area_m2") is None or w.get("azimuth_deg") is None:
            continue
        exp = w.get("exposure")
        if exp in ("unknown", "corridor", "neighbouring_unit") or _is_entry(w):
            yield w


def _element(room_names, room_id, w, kind):
    az = w.get("azimuth_deg")
    return {"kind": kind, "wall": w["id"], "room": room_id, "room_name": room_names.get(room_id, room_id),
            "facing": _facing(az), "azimuth_deg": az, "area_m2": w.get("area_m2")}


# ---------------------------------------------------------------- context (phase B)

def normalise_context(context):
    """The local CoStar context record, with the keys the profile reads. Missing keys stay missing."""
    if not context:
        return {}
    c = {}
    for out, keys in (("year_built", ("yearBuilt", "year_built")), ("renovation_year", ("renovationYear", "yearRenovated")),
                      ("stories", ("stories",)), ("construction", ("constructionMaterial",)),
                      ("unit_floor", ("unitFloor", "unit_floor")), ("amenities", ("amenities",)),
                      ("features", ("listingFeatures", "features"))):
        for k in keys:
            if context.get(k) not in (None, "", []):
                c[out] = context[k]
                break
    if "features" in c:
        c["features"] = [str(x).strip().lower() for x in c["features"]]
    for k in ("year_built", "renovation_year", "stories", "unit_floor"):
        if k in c:
            try:
                c[k] = int(c[k])
            except (TypeError, ValueError):
                c.pop(k)
    return c


def _feature(ctx, field):
    for feat, rule in (spec().get("listing_features") or {}).items():
        if rule["field"] == field and any(feat in f for f in ctx.get("features") or []):
            return feat, rule["value"]
    return None


# ---------------------------------------------------------------- the builder

def _prop_era(prop):
    e = prop.get("era")
    if isinstance(e, dict):
        return e.get("value"), e.get("status"), e.get("source")
    return e, None, None


def _fill(prop, ctx, a):
    """[(field, target, value, label, note, element)] in field order, from the property and the context."""
    rows = []
    names = _room_names(prop)
    add = lambda f, t, v, lab, note, el=None: rows.append((f, t, v, lab, note, el))

    # year built
    if prop.get("year_built") is not None:
        year = (int(prop["year_built"]), "scan", "From the property file")
    elif ctx.get("year_built"):
        year = (ctx["year_built"], "costar", "CoStar year built" + (
            "; renovated %d (not used by the model)" % ctx["renovation_year"] if ctx.get("renovation_year") else ""))
    else:
        year = (None, "assumed", "Not known; the construction era below sets the defaults")
    add("year_built", None, *year)

    # era
    pe, pstatus, psource = _prop_era(prop)
    if year[0] is not None:
        era = (facade.era_from_year(year[0]), "inferred", "From the year built (%d)" % year[0])
    elif pe and pstatus not in ("assumed",):
        era = (pe, "scan", psource or "From the property file")
    elif pe:
        era = (pe, "assumed", psource or "Stated default")
    else:
        default = a.value("facade.default_era_when_year_unknown")
        era = (default, "assumed", "Year built is missing; facade.default_era_when_year_unknown")
    add("era", None, *era)

    # storeys and unit floor
    unit_floor_prop = int(prop.get("unit_floor") or 1)
    if ctx.get("stories"):
        storeys = (ctx["stories"], "costar", "CoStar stories")
    elif prop.get("storeys"):
        src = prop.get("storeys_source") or ""
        storeys = (int(prop["storeys"]), "map" if "vexcel" in src.lower() else "scan", src or "From the property file")
    else:
        storeys = (None, "inferred", "Not known; the model treats the unit floor as the top floor")
    if ctx.get("unit_floor"):
        uf = (ctx["unit_floor"], "costar", "CoStar unit record")
    elif prop.get("unit_floor") and prop.get("unit_floor_status") != "assumed":
        uf = (unit_floor_prop, "scan", prop.get("unit_floor_source") or "From the property file")
    else:
        uf = (unit_floor_prop, "assumed", prop.get("unit_floor_source") or "Ground floor assumed")
    if storeys[0] is None:
        storeys = (uf[0], "inferred", storeys[2])
    add("storeys", None, *storeys)
    add("unit_floor", None, *uf)

    # building outside wall material
    upper = uf[0] > 1
    era_wall, era_window, _ = facade.era_types(a, era[0], upper)
    feat = _feature(ctx, "outside_wall_material")
    cls = str(ctx.get("construction") or "").strip().lower()
    cls_map = spec().get("construction_class_walls") or {}
    if prop.get("profile_outside_wall_material"):
        owm = (prop["profile_outside_wall_material"], "scan", "Set through the unit profile")
    elif feat:
        owm = (feat[1], "costar", "Home listing feature '%s'" % feat[0])
    elif cls in cls_map:
        owm = (cls_map[cls], "inferred", "From the CoStar construction class '%s' (structure, not cladding; "
                                        "an inference, research S6)" % ctx["construction"])
    else:
        owm = (era_wall, "assumed", "Era default (%s%s)" % (era[0], ", upper floor" if upper else ""))
    add("outside_wall_material", None, *owm)

    # windows open
    walls = list(_outdoor_walls(prop))
    any_open = any(w.get("window_open") for _, w in walls)
    add("windows_open", None, "open" if any_open else "closed", "scan" if any_open else "assumed",
        "From the property file" if any_open else "Default: closed")

    # sides
    for r, w in walls:
        add("exposure", "wall:" + w["id"], "outdoors", "scan",
            w.get("exposure_source") or "Exterior wall in the property file", _element(names, r["id"], w, "side"))
    for w in _boundary_sides(prop):
        exp = w.get("exposure")
        el = _element(names, w["room"], w, "side")
        if exp in ("corridor", "neighbouring_unit") or (w.get("exposure_source") or "").startswith("edited"):
            add("exposure", "wall:" + w["id"], exp, "scan", w.get("exposure_source") or "From the property file", el)
        elif _is_entry(w):
            add("exposure", "wall:" + w["id"], "corridor", "inferred",
                "The entry-door side is taken as the shared corridor (plan section 3)", el)
        else:
            add("exposure", "wall:" + w["id"], "unknown", "assumed",
                "The scan cannot tell outdoors from a neighbour or corridor; treated as not outdoors", el)

    # per-element windows, walls and doors
    window_cache = {}
    for r, w in walls:
        el = _element(names, r["id"], w, "outdoor_wall")
        area = w.get("window_area_m2")
        if area is not None and w.get("window_area_status") != "assumed":
            win = (float(area), "scan", "Measured in the scan or its window survey")
        else:
            win = (round(a.value("facade.window_fraction_default") * float(w["area_m2"]), 3), "assumed",
                   "15% of the wall (facade.window_fraction_default)")
        window_cache[w["id"]] = win[0]
        add("window_area_m2", "wall:" + w["id"], *win, el)
    for r, w in walls:
        if window_cache[w["id"]] <= 0:
            continue
        el = _element(names, r["id"], w, "window_wall")
        feat = _feature(ctx, "window_type")
        if w.get("window_type"):
            wt = (w["window_type"], "scan", "From the property file")
        elif feat:
            value = feat[1]
            if value == "era_double_pane":
                value = era_window if era_window.startswith("double_pane") else "double_pane_2000_on"
            wt = (value, "costar", "Home listing feature '%s'" % feat[0])
        else:
            wt = (era_window, "assumed", "Era default (%s)" % era[0])
        add("window_type", "wall:" + w["id"], *wt, el)
    for r, w in walls:
        el = _element(names, r["id"], w, "outdoor_wall")
        if w.get("wall_type") and not w.get("_wall_type_from_building"):
            wm = (w["wall_type"], "scan", "From the property file")
        else:
            wm = (owm[0], "inferred", "From the building's outside wall material")
        add("wall_material", "wall:" + w["id"], *wm, el)
    for r, w in walls:
        if not float(w.get("door_area_m2") or 0.0) > 0:
            continue
        el = _element(names, r["id"], w, "outdoor_door")
        el["door_area_m2"] = float(w["door_area_m2"])
        feat = _feature(ctx, "door_material")
        if w.get("door_type") and w.get("door_type_status") != "assumed":
            dm = (w["door_type"], "scan", "Identified in the scan or its survey")
        elif feat:
            dm = (feat[1], "costar", "Home listing feature '%s'" % feat[0])
        elif w.get("door_type"):
            dm = (w["door_type"], "assumed", w.get("source") or "Stated default")
        else:
            dm = (a.value("doors_exterior.default"), "assumed", "doors_exterior.default")
        add("door_material", "wall:" + w["id"], *dm, el)
    for w in _boundary_sides(prop):
        if not _is_entry(w):
            continue
        el = _element(names, w["room"], w, "entry_door")
        el["door_area_m2"], el["door_area_source"] = _entry_door_area(w, a)
        if w.get("door_type"):
            dm = (w["door_type"], "scan", "From the property file")
        else:
            dm = ("solid_core", "inferred", "Entry door onto the corridor: solid wood by default (plan section 3). "
                                            "Corridor noise waits on building sources (phase D).")
        add("door_material", "wall:" + w["id"], *dm, el)
    return rows


def _key(field, target):
    return field if not target else "%s@%s" % (field, target)


def build(prop, sources=None, context=None, labels=None, result=None, a=None):
    """The auto-filled profile. labels: {key: {label, note, ...}} for values set by apply()."""
    a = a or Assumptions.load()
    ctx = normalise_context(context)
    d = spec()["fields"]
    base = {_key(f, t): v for f, t, v, _, _, _ in _fill(prop, {}, a)}
    rows = _fill(prop, ctx, a)
    road = _road_notes(result) if result else {}
    fields = []
    for f, t, v, lab, note, el in rows:
        key = _key(f, t)
        meta = (labels or {}).get(key)
        entry = {
            "key": key, "field": f, "target": t, "label_text": d[f]["label"], "group": d[f]["group"],
            "scope": d[f]["scope"], "kind": d[f]["kind"], "value": v, "value_text": name(v),
            "label": lab, "note": note, "model_value": base.get(key, v),
            "effect": d[f].get("effect"), "element": el,
        }
        if d[f]["kind"] == "choice":
            entry["choices"] = [{"value": c, "text": name(c)} for c in choices(f, a)]
        else:
            entry["min"], entry["max"] = d[f].get("min"), d[f].get("max")
            entry["integer"] = bool(d[f].get("integer"))
        if meta:
            entry.update({k: meta[k] for k in ("label", "note", "edited_by", "edited_at", "replaced") if k in meta})
        if f == "exposure" and t and t[5:] in road and v == "outdoors":
            entry["map_note"] = road[t[5:]]
        fields.append(entry)
    counts = {}
    for e in fields:
        counts[e["label"]] = counts.get(e["label"], 0) + 1
    from_data = sum(counts.get(k, 0) for k in ("scan", "costar", "map"))
    guessed = counts.get("assumed", 0) + counts.get("inferred", 0)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "propertyId": prop.get("id"), "modelId": prop.get("matterport_model_id"),
        "fields": fields,
        "counts": counts,
        "summary": "%d values from data, %d assumed or inferred%s" % (
            from_data, guessed, ", %d edited" % counts["edited"] if counts.get("edited") else ""),
        "context": {"used": bool(ctx), "keys": sorted(ctx)},
        "groups": spec()["groups"],
        "notes": [
            "Interior doors and walls keep one default each (a hollow-core door, a stud wall); they and every "
            "assumptions.yaml key stay under advanced settings (--set) and are not profile fields.",
            "Building sources (gym, elevator, pool, corridor, neighbours), through-wall air conditioners and room "
            "finish wait on research S1, S2 and S3 (phases D and E, issue #37).",
        ],
    }


def _road_notes(result):
    out = {}
    for w in result.get("outdoor") or []:
        if w.get("alpha_deg") is not None and w.get("source_distance_m") is not None:
            out[w["wall"]] = "Map: the nearest counted road is %.0f m away, %.0f degrees off this wall's facing" % (
                w["source_distance_m"], w["alpha_deg"])
    return out


def index(profile):
    return {f["key"]: f for f in profile["fields"]}


# ---------------------------------------------------------------- writing values into the property

def _wall(prop, wid):
    for r in prop["rooms"]:
        for w in r.get("exterior_walls") or []:
            if w["id"] == wid:
                return r, w, "outdoor"
    for w in prop.get("other_boundary_walls") or []:
        if w["id"] == wid:
            return None, w, "boundary"
    return None, None, None


def _set_exposure(prop, wid, value, a):
    room, w, where = _wall(prop, wid)
    if where == "outdoor" and value != "outdoors":
        room["exterior_walls"] = [x for x in room["exterior_walls"] if x["id"] != wid]
        moved = {"id": wid, "room": room["id"], "exposure": value, "azimuth_deg": w.get("azimuth_deg"),
                 "area_m2": w.get("area_m2"), "openings": [], "exposure_source": "edited in the unit profile",
                 "was_exterior": {k: w.get(k) for k in ("window_area_m2", "window_type", "door_area_m2", "door_type",
                                                        "wall_type")}}
        prop.setdefault("other_boundary_walls", []).append(moved)
    elif where == "boundary" and value == "outdoors":
        prop["other_boundary_walls"] = [x for x in prop["other_boundary_walls"] if x["id"] != wid]
        room = next(r for r in prop["rooms"] if r["id"] == w["room"])
        prev = w.get("was_exterior") or {}
        door_area, door_type = prev.get("door_area_m2") or 0.0, prev.get("door_type")
        door_status = None
        if _is_entry(w):
            door_area, _ = _entry_door_area(w, a)
            door_status = None if w.get("door_type") else "assumed"
            door_type = w.get("door_type") or "solid_core"
        room.setdefault("exterior_walls", []).append({
            "id": wid, "azimuth_deg": w["azimuth_deg"], "area_m2": w["area_m2"], "wall_type": prev.get("wall_type"),
            "exposure": "outdoor", "exposure_source": "edited in the unit profile",
            "window_area_m2": prev.get("window_area_m2") or 0.0, "window_area_status": "measured",
            "window_type": prev.get("window_type"), "door_area_m2": door_area, "door_type": door_type,
            "door_type_status": door_status, "entry_door": _is_entry(w) or None,
            "source": "entry door: solid wood by default (plan section 3)" if door_status else None,
        })
    elif where == "boundary":
        w["exposure"] = value
        w["exposure_source"] = (w.get("exposure_source") or "") if _is_entry(w) and value == "corridor" else \
            ("edited in the unit profile" + ("; entry door" if _is_entry(w) else ""))
        if _is_entry(w):
            w["entry_door"] = True


def _write(prop, field, target, value, a, label):
    wid = target[5:] if target else None
    if field == "year_built":
        prop["year_built"] = value
    elif field == "era":
        prop["era"] = {"value": value, "status": label, "source": "unit profile (%s)" % label}
    elif field == "storeys":
        prop["storeys"] = value
    elif field == "unit_floor":
        prop["unit_floor"] = value
        prop["unit_floor_status"] = label
        prop["unit_floor_source"] = "unit profile (%s)" % label
    elif field == "outside_wall_material":
        prop["profile_outside_wall_material"] = value
        for _, w in _outdoor_walls(prop):
            if w.get("wall_type") is None or w.get("_wall_type_from_building"):
                w["wall_type"] = value
                w["_wall_type_from_building"] = True
    elif field == "windows_open":
        for _, w in _outdoor_walls(prop):
            area = w.get("window_area_m2")
            if (area is None or area > 0) and not w.get("window_fixed"):
                w["window_open"] = value == "open"
    elif field == "exposure":
        _set_exposure(prop, wid, value, a)
    else:
        _, w, where = _wall(prop, wid)
        if field == "window_area_m2":
            w["window_area_m2"] = float(value)
            w["window_area_status"] = label
        elif field == "window_type":
            w["window_type"] = value
        elif field == "wall_material":
            w["wall_type"] = value
            w.pop("_wall_type_from_building", None)
        elif field == "door_material":
            w["door_type"] = value
            w.pop("door_type_status", None)


ORDER = list(spec()["fields"]) if os.path.exists(FIELDS_PATH) else []


def _order(field):
    return ORDER.index(field)


# ---------------------------------------------------------------- edits

def _edits_list(edits):
    if edits is None:
        return []
    if isinstance(edits, dict):
        edits = edits.get("edits") or []
    if not isinstance(edits, list):
        raise ProfileError("Edits must be a list or an edits document with an 'edits' list.")
    return edits


def validate(edit, idx, prop, a):
    """None if the edit can be applied, else a plain message. Also returns a list of flags (unlikely edits)."""
    flags = []
    if not isinstance(edit, dict) or "field" not in edit:
        return "Each edit needs a field.", flags
    f = edit["field"]
    d = spec()["fields"].get(f)
    if d is None:
        return "There is no profile field called %r." % f, flags
    target = edit.get("target")
    key = _key(f, target)
    if key not in idx:
        if d["element"] != "none" and not target:
            return "%s needs a target (the wall it applies to)." % d["label"], flags
        return "%s does not apply to %s in this unit." % (d["label"], target or "this unit"), flags
    v = edit.get("value")
    if d["kind"] == "choice":
        allowed = [c["value"] for c in idx[key]["choices"]]
        if v not in allowed:
            return "%r is not a choice for %s. Choose one of: %s." % (v, d["label"], ", ".join(allowed)), flags
    else:
        if f == "year_built" and v is None:
            pass
        elif isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            return "%s must be a number." % d["label"], flags
        else:
            if d.get("integer") and int(v) != v:
                return "%s must be a whole number." % d["label"], flags
            if d.get("min") is not None and v < d["min"]:
                return "%s cannot be below %g." % (d["label"], d["min"]), flags
            if d.get("max") is not None and v > d["max"]:
                return "%s cannot be above %g." % (d["label"], d["max"]), flags
    if f == "window_area_m2":
        _, w, _ = _wall(prop, target[5:])
        door = float(w.get("door_area_m2") or 0.0)
        if v + door > float(w["area_m2"]):
            return ("A window of %.2f m2 does not fit its wall: the wall is %.2f m2%s." % (
                v, float(w["area_m2"]), " and already holds %.2f m2 of door" % door if door else "")), flags
    if f == "unit_floor":
        storeys = idx["storeys"]["value"]
        if storeys is not None and idx["storeys"]["label"] != "inferred" and v > storeys:
            return "Unit floor %d is above the building's %d floors." % (v, storeys), flags
    if f == "storeys" and v < idx["unit_floor"]["value"]:
        return "A building of %d floors cannot hold a unit on floor %d." % (v, idx["unit_floor"]["value"]), flags
    if f == "window_type" and v == "laminated_acoustic" and idx["era"]["value"] in ("before_1960", "1960_1979"):
        flags.append("Unlikely: laminated acoustic glass in a building from before 1980. Accepted; check it.")
    if f == "exposure" and v != "outdoors" and idx[key]["value"] == "outdoors":
        el = idx[key]["element"] or {}
        flags.append("A wall the scan found with a window or outside door (%s, %s-facing) is now marked as not "
                     "facing outdoors. Accepted; check it." % (el.get("room_name"), el.get("facing")))
    return None, flags


def merge_edits(building_edits=None, unit_edits=None):
    """A manager's building edits (building-scope fields only) followed by the unit's own edits.

    Building edits reach every unit of the building; a resident's edit applies to that unit only and,
    coming later, wins for that unit.
    """
    out = []
    for e in _edits_list(building_edits):
        d = spec()["fields"].get(e.get("field"))
        if d and d["scope"] == "building":
            out.append(dict(e, applies_to="building"))
    out.extend(_edits_list(unit_edits))
    return out


def apply(prop, sources, profile=None, edits=None, context=None, strict=True, a=None):
    """(prop2, sources2, log). Values from data the property lacks (phase B) are written first, then edits.

    An edited value always wins; the value it replaced stays in the log. Impossible edits raise ProfileError
    (strict) or are listed under log['rejected'].
    """
    a = a or Assumptions.load()
    profile = profile or build(prop, sources, context, a=a)
    prop2 = copy.deepcopy(prop)
    sources2 = copy.deepcopy(sources)
    labels = {}
    log = {"data": [], "applied": [], "rejected": [], "flags": []}
    for e in profile["fields"]:
        # Values from data the property lacks. Defaults (assumed) and per-wall materials that follow the
        # building value are not written: the model derives them, so later edits to the era still move them.
        derived = e["label"] == "assumed" or (e["field"] == "wall_material" and e["label"] == "inferred")
        if e["value"] != e["model_value"] and e["label"] != "edited" and not derived:
            _write(prop2, e["field"], e["target"], e["value"], a, e["label"])
            labels[e["key"]] = {"label": e["label"], "note": e["note"]}
            log["data"].append({"key": e["key"], "field": e["field"], "target": e["target"], "label": e["label"],
                                "from": e["model_value"], "to": e["value"], "note": e["note"],
                                "text": "%s: %s (was %s, %s)" % (e["label_text"] + _where(e), name(e["value"]),
                                                                 name(e["model_value"]), e["label"])})
    edits = sorted(enumerate(_edits_list(edits)), key=lambda ie: (_order(ie[1].get("field")) if ie[1].get("field") in ORDER else 99, ie[0]))
    era_edited = any(e.get("field") == "era" for _, e in edits)
    current = profile
    for pos, e in edits:
        idx = index(current)
        msg, flags = validate(e, idx, prop2, a)
        if msg:
            if strict:
                raise ProfileError(msg)
            log["rejected"].append({"position": pos, "edit": e, "message": msg})
            continue
        key = _key(e["field"], e.get("target"))
        before = idx[key]
        _write(prop2, e["field"], e.get("target"), e["value"], a, "edited")
        meta = {"label": "edited", "note": "Edited by %s" % (e.get("edited_by") or "a client"),
                "edited_by": e.get("edited_by"), "edited_at": e.get("edited_at"),
                "replaced": {"value": before["value"], "label": before["label"]}}
        labels[key] = meta
        if e["field"] == "year_built" and e["value"] is not None and not era_edited:
            era = facade.era_from_year(e["value"])
            _write(prop2, "era", None, era, a, "inferred")
            labels["era"] = {"label": "inferred", "note": "From the edited year built (%d)" % e["value"]}
        log["applied"].append({"position": pos, "edit": e, "key": key, "replaced": meta["replaced"], "flags": flags})
        log["flags"].extend(flags)
        current = _relabel(build(prop2, sources2, None, labels, a=a), profile)
    log["profile"] = _relabel(build(prop2, sources2, None, labels, a=a), profile)
    return prop2, sources2, log


def _where(e):
    el = e.get("element")
    return "" if not el else " (%s, %s-facing)" % (el["room_name"], el["facing"])


def _relabel(after, before):
    """Values that did not change keep the label they had in the auto-filled profile (e.g. costar)."""
    prev = index(before)
    for e in after["fields"]:
        p = prev.get(e["key"])
        if p and e["label"] != "edited" and p["value"] == e["value"] and p["label"] != e["label"] \
                and e["label"] in ("scan", "assumed", "inferred"):
            e["label"], e["note"] = p["label"], p["note"]
        if p:
            e["model_value"] = p["model_value"]
    counts = {}
    for e in after["fields"]:
        counts[e["label"]] = counts.get(e["label"], 0) + 1
    after["counts"] = counts
    from_data = sum(counts.get(k, 0) for k in ("scan", "costar", "map"))
    after["summary"] = "%d values from data, %d assumed or inferred%s" % (
        from_data, counts.get("assumed", 0) + counts.get("inferred", 0),
        ", %d edited" % counts["edited"] if counts.get("edited") else "")
    after["context"] = before.get("context")
    return after


# ---------------------------------------------------------------- scoring a profile

def ranges(profile, a=None):
    """Plan section 4: +/- range_unconfirmed while a room's window type or exposure is not confirmed."""
    a = a or Assumptions.load()
    lo, hi = float(a.value("score.range_confirmed")), float(a.value("score.range_unconfirmed"))
    by_room = {}
    for e in profile["fields"]:
        if e["field"] in ("exposure", "window_type") and e.get("element"):
            ok = e["label"] in CONFIRMED and e["value"] != "unknown"
            by_room[e["element"]["room"]] = by_room.get(e["element"]["room"], True) and ok
    return {room: (lo if ok else hi) for room, ok in by_room.items()}


def run_profile(prop2, sources2, profile_after, a=None):
    """Model result (no fixes) and its score, with the profile's range rule."""
    from .predict import predict
    a = a or Assumptions.load()
    result = predict(prop2, sources2, with_fixes=False)
    rng = ranges(profile_after, a)
    full = {r["id"]: rng.get(r["id"], a.value("score.range_unconfirmed")) for r in result["rooms"]}
    areas = {r["id"]: float(r.get("area_m2") or 0.0) for r in prop2["rooms"]}
    return result, score_mod.score(result, a, full, areas)


def _unit(sc):
    return None if not sc or sc["unit"] is None else sc["unit"]["score"]


def _edit_text(e, idx):
    f = idx.get(_key(e.get("field"), e.get("target")))
    if not f:
        return "%s = %s" % (e.get("field"), e.get("value"))
    return "%s%s: %s" % (f["label_text"], _where(f), name(e.get("value")))


def compare(prop, sources, profile=None, edits=None, context=None, a=None):
    """Auto-filled run, edited run, and the score change each edit caused (in the order made).

    Edits are applied one at a time on top of the earlier ones, so the changes sum to the total change.
    """
    a = a or Assumptions.load()
    profile = profile or build(prop, sources, context, a=a)
    edits = _edits_list(edits)
    p0, s0, log0 = apply(prop, sources, profile, [], a=a)
    r0, sc0 = run_profile(p0, s0, log0["profile"], a)
    prev, changes, last = sc0, [], (p0, s0, log0, r0)
    idx = index(profile)
    for k in range(1, len(edits) + 1):
        pk, sk, logk = apply(prop, sources, profile, edits[:k], strict=False, a=a)
        rk, sck = run_profile(pk, sk, logk["profile"], a)
        rejected = [x for x in logk["rejected"] if x["position"] == k - 1]
        delta = None if _unit(sck) is None or _unit(prev) is None else round(_unit(sck) - _unit(prev), 1)
        changes.append({
            "edit": edits[k - 1], "text": _edit_text(edits[k - 1], idx),
            "unit_change": delta,
            "unit_change_raw": None if delta is None else _unit(sck) - _unit(prev),
            "room_changes": {rid: round(sck["rooms"][rid]["score"] - prev["rooms"][rid]["score"], 1)
                             for rid in sck["rooms"] if rid in prev["rooms"]},
            "rejected": rejected[0]["message"] if rejected else None,
            "flags": [f for x in logk["applied"] if x["position"] == k - 1 for f in x["flags"]],
        })
        prev, last = sck, (pk, sk, logk, rk)
    total = None if _unit(prev) is None or _unit(sc0) is None else _unit(prev) - _unit(sc0)
    return {
        "baseline": {"score": sc0, "result": r0, "profile": log0["profile"], "data_changes": log0["data"]},
        "edited": {"score": prev, "result": last[3], "profile": last[2]["profile"], "property": last[0],
                   "rejected": last[2]["rejected"], "flags": last[2]["flags"]},
        "changes": changes,
        "total_change": None if total is None else round(total, 1),
        "total_change_raw": total,
    }


# ---------------------------------------------------------------- worth checking

def alternatives(entry):
    f, v = entry["field"], entry["value"]
    d = spec()["fields"][f]
    if d["kind"] == "choice":
        return [c["value"] for c in entry["choices"] if c["value"] != v]
    if f == "window_area_m2":
        wall = float(entry["element"]["area_m2"])
        return sorted({round(x, 3) for x in (0.0, v * 0.5, min(v * 1.5, wall * 0.6))} - {v})
    return [x for x in d.get("alternatives") or [] if x != v]


def worth_checking(prop, sources, profile=None, edits=None, context=None, limit=None, a=None):
    """Fields that are not scan or edited, ranked by the spread in unit score over their alternatives."""
    a = a or Assumptions.load()
    profile = profile or build(prop, sources, context, a=a)
    edits = _edits_list(edits)
    p1, s1, log1 = apply(prop, sources, profile, edits, strict=False, a=a)
    _, sc1 = run_profile(p1, s1, log1["profile"], a)
    current = log1["profile"]
    base_unit = _unit(sc1)
    out = []
    year_open = any(e["field"] == "year_built" and e["label"] not in ("scan", "edited") for e in current["fields"])
    for e in current["fields"]:
        if e["label"] in ("scan", "edited") or base_unit is None:
            continue
        if e["field"] == "era" and year_open:
            continue  # the same lever as the year built, which a client can answer more easily
        scores = [base_unit]
        best = None
        for alt in alternatives(e):
            trial = edits + [{"field": e["field"], "target": e["target"], "value": alt, "edited_by": "worth_checking"}]
            p2, s2, log2 = apply(prop, sources, profile, trial, strict=False, a=a)
            if log2["rejected"] and any(x["position"] == len(trial) - 1 for x in log2["rejected"]):
                continue
            _, sc2 = run_profile(p2, s2, log2["profile"], a)
            u = _unit(sc2)
            if u is None:
                continue
            scores.append(u)
            if best is None or abs(u - base_unit) > abs(best[1] - base_unit):
                best = (alt, u)
        spread = max(scores) - min(scores)
        out.append({
            "key": e["key"], "field": e["field"], "target": e["target"], "label": e["label"],
            "value": e["value"], "label_text": e["label_text"] + _where(e), "spread": round(spread, 1),
            "spread_raw": spread, "range": [round(min(scores), 1), round(max(scores), 1)],
            "largest_change": None if best is None else {"value": best[0], "value_text": name(best[0]),
                                                         "unit_score": round(best[1], 1)},
            "text": "%s is %s. It could move your score by up to %.0f points." % (
                e["label_text"] + _where(e), e["label"], spread),
        })
    order = {k: i for i, k in enumerate(e["key"] for e in current["fields"])}
    out.sort(key=lambda x: (-x["spread_raw"], order[x["key"]]))
    return out[:limit] if limit else out


# ---------------------------------------------------------------- files

def load_edits(path):
    with open(path) as fh:
        doc = json.load(fh)
    if isinstance(doc, dict) and doc.get("schemaVersion") not in (None, SCHEMA_VERSION):
        raise ProfileError("Unsupported edits schemaVersion %r" % doc.get("schemaVersion"))
    return doc


def edits_document(model_id, edits):
    return {"schemaVersion": SCHEMA_VERSION, "modelId": model_id, "edits": _edits_list(edits)}
