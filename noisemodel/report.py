"""Dominant paths, fixes, what-ifs and the printed report (docs/BUILD_BRIEF.md section 7)."""
import copy
import json
import math

from . import outdoor
from .predict import PATH_NAMES, run

BLOCKS = ("overnight", "morning_rush", "midday", "evening_rush", "evening")
BLOCK_TITLES = {"overnight": "Overnight 00-06", "morning_rush": "Morning rush 06-10", "midday": "Midday 10-16",
                "evening_rush": "Evening rush 16-20", "evening": "Evening 20-24"}


def _without_test(sources):
    src = dict(sources)
    src.pop("measured", None)
    return src


def _room_walls(prop, room_id):
    for r in prop["rooms"]:
        if r["id"] == room_id:
            return r.get("exterior_walls") or []
    raise KeyError(room_id)


def _touching(prop, room_id):
    return [p for p in prop.get("partitions") or [] if room_id in (p["room_a"], p["room_b"])]


BLOCK_M = 100.0  # "one block further from the road" (docs/BUILD_BRIEF.md 7.5); a modelling choice
NEGLIGIBLE_DB = 0.05  # display resolution of the report (one decimal); smaller changes are not called fixes


def fixes(prop, sources, room_id, overrides=None, base=None, include_negligible=False):
    """Rerun with one change at a time; the change in the room's DNL (SOUND_MODEL.md 3.6).

    Changes smaller than NEGLIGIBLE_DB are left out unless include_negligible is set (they are then
    marked 'negligible'), so every fix returned lowers the room by a visible amount.
    """
    src = _without_test(sources)
    overrides = dict(overrides or {})
    if base is None:
        _, base = run(prop, src, overrides)
    before = base[room_id]["dnl"]
    if before is None:
        return []
    a = base["_assumptions"]
    b = base["_building"]
    upgrade_f = a.value("leak_fraction.after_window_upgrade")
    walls = _room_walls(prop, room_id)
    glazed = [w for w in walls if w.get("window_area_m2") is None or w["window_area_m2"] > 0]
    built = {w["id"]: w for w in b.walls if w["room"] == room_id}
    candidates = []
    nm = _Names(prop)
    names = ", ".join(nm.wall(w["id"]) for w in glazed)
    if glazed:
        for kind, label in (("laminated_acoustic", "laminated acoustic glass (OITC %g) and new seals"),
                            ("with_storm", "a storm window (OITC %g) and new seals")):
            ov = {}
            for w in glazed:
                ov["window.%s.type" % w["id"]] = kind
                ov["window.%s.leak_fraction" % w["id"]] = upgrade_f
            candidates.append(("replace_window" if kind == "laminated_acoustic" else "storm_window", names, ov,
                               "Fit the windows on %s with %s" % (names, label % a.value("windows." + kind))))
        leaky = [w for w in walls if built[w["id"]]["window_leak"] > upgrade_f
                 or (built[w["id"]]["door_area"] > 0 and built[w["id"]]["door_leak"] > upgrade_f)]
        if leaky:
            ov = {}
            for w in leaky:
                ov["window.%s.leak_fraction" % w["id"]] = upgrade_f
                ov["wall.%s.door_leak_fraction" % w["id"]] = upgrade_f
            candidates.append(("seal_only", ", ".join(w["id"] for w in leaky), ov,
                               "Reseal the window and door frames on %s (leak fraction %g)"
                               % (", ".join(nm.wall(w["id"]) for w in leaky), upgrade_f)))
    closed = [p for p in _touching(prop, room_id)
              if p.get("kind", "wall") != "opening" and p.get("door") == "closed" and not p.get("door_sweep")]
    if closed:
        ov = {"door.%s.sweep" % p["id"]: True for p in closed}
        ids = ", ".join(p["id"] for p in closed)
        candidates.append(("door_sweep", ids, ov, "Add a sweep to the interior door on %s (no undercut gap)"
                           % ", ".join(nm.partition(p["id"]) for p in closed)))
    opened = [p for p in _touching(prop, room_id) if p.get("kind", "wall") != "opening" and p.get("door") == "open"]
    if opened:
        ov = {"door.%s.state" % p["id"]: "closed" for p in opened}
        ids = ", ".join(p["id"] for p in opened)
        candidates.append(("close_door", ids, ov, "Close the interior door on %s"
                           % ", ".join(nm.partition(p["id"]) for p in opened)))
    out = []
    for action, target, ov, text in candidates:
        merged = dict(overrides)
        merged.update(ov)
        _, raw = run(prop, src, merged)
        after = raw[room_id]["dnl"]
        negligible = after - before > -NEGLIGIBLE_DB
        if negligible and not include_negligible:
            continue
        out.append({"action": action, "target": target, "delta_db": round(after - before, 2),
                    "delta_raw": after - before, "dnl_after": after, "text": text, "overrides": ov,
                    "negligible": negligible})
    return out


# ---------------------------------------------------------------- what-ifs

def shift_roads(sources, prop, metres):
    """Move every counted road `metres` further from the facade point, along the line to its nearest point."""
    src = copy.deepcopy(sources)
    fp = prop.get("facade_point") or {"lat": prop["lat"], "lon": prop["lon"]}
    lat0, lon0 = float(fp["lat"]), float(fp["lon"])
    for road in src.get("roads") or []:
        poly = [outdoor.project(p[0], p[1], lat0, lon0) for p in road["geometry"]]
        d, q = outdoor.nearest_point(poly, (0.0, 0.0))
        ux, uy = q[0] / d, q[1] / d
        dlon = metres * ux / (outdoor.M_PER_DEG_LON_EQUATOR * math.cos(math.radians(lat0)))
        dlat = metres * uy / outdoor.M_PER_DEG_LAT
        road["geometry"] = [[p[0] + dlon, p[1] + dlat] for p in road["geometry"]]
    return src


def what_ifs(prop, sources, loudest_bedroom, overrides=None):
    src = _without_test(sources)
    overrides = dict(overrides or {})
    runs = []
    win = {"window.%s.open" % w["id"]: True for r in prop["rooms"] for w in r.get("exterior_walls") or []
           if (w.get("window_area_m2") is None or w["window_area_m2"] > 0) and not w.get("window_fixed")}
    runs.append(("Windows open", "Every operable window open (fixed glass stays shut); R3 E5 flat 12 dB.", win, src))
    doors = [p for p in _touching(prop, loudest_bedroom) if p.get("kind", "wall") != "opening" and p.get("door") == "closed"]
    names = _Names(prop)
    text = ("The door of %s (%s) left open." % (names.room(loudest_bedroom), ", ".join(names.partition(p["id"]) for p in doors))
            if doors else "No change: %s has no closed door (its doorways are open in the input)." % names.room(loudest_bedroom))
    runs.append(("Bedroom door open", text, {"door.%s.state" % p["id"]: "open" for p in doors}, src))
    roads = ", ".join(r.get("name") or r["id"] for r in src.get("roads") or []) or "the road"
    runs.append(("One block further from the road",
                 "%s moved %.0f m further away (about one city block; a modelling choice, not a measured block)."
                 % (roads, BLOCK_M), {}, shift_roads(src, prop, BLOCK_M)))
    runs.append(("1980 to 1999 construction", "Era defaults for 1980 to 1999 instead of 2000 onward.",
                 {"property.era": "1980_1999"}, src))
    out = []
    for name, text, ov, s in runs:
        merged = dict(overrides)
        merged.update(ov)
        res, raw = run(prop, s, merged)
        out.append({"name": name, "text": text, "raw": raw, "result": res})
    return out


# ---------------------------------------------------------------- formatting

def _delta(x):
    x = round(x, 1)
    return "%+.1f" % (0.0 if x == 0 else x)


def _f(x, nd=1):
    return "below 15" if x is None else ("%.*f" % (nd, x))


def _short(value):
    text = json.dumps(value)
    return text if len(text) <= 60 else text[:57] + "..."


class _Names(object):
    """Readable labels for rooms, walls and partitions (scanned ids are long hashes)."""

    COMPASS = ("north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west")

    def __init__(self, prop):
        self.rooms = {r["id"]: r.get("name") or r["id"] for r in prop["rooms"]}
        self.walls = {}
        for r in prop["rooms"]:
            for w in r.get("exterior_walls") or []:
                self.walls[w["id"]] = (r["id"], w.get("azimuth_deg"))
        self.parts = {p["id"]: (p["room_a"], p["room_b"]) for p in prop.get("partitions") or []}

    def room(self, rid):
        return self.rooms.get(rid, rid)

    def group(self, gid):
        return " + ".join(self.room(x) for x in gid.split("+"))

    def wall(self, wid):
        if len(wid) <= 16 or wid not in self.walls:
            return wid
        rid, az = self.walls[wid]
        facing = self.COMPASS[int(((az or 0.0) + 22.5) % 360 // 45)]
        return "%s %s-facing wall (%s)" % (self.room(rid), facing, wid[:6])

    def partition(self, pid):
        if len(pid) <= 24 or pid not in self.parts:
            return pid
        a, b = self.parts[pid]
        return "%s to %s (%s)" % (self.room(a), self.room(b), pid[2:8])


def _rooms_by_dnl(result):
    return sorted(result["rooms"], key=lambda r: (r["dnl_dba"] is not None, r["dnl_dba"] or 0.0))


def _path_label(key, names):
    if key.startswith("from:"):
        return "from %s" % names.group(key[5:])
    wall, part = key.split(":", 1)
    return "%s (%s)" % (PATH_NAMES[part], names.wall(wall))


def summary(result):
    lines = ["Room                       DNL   night  HUD45  " + "  ".join(b[:9].ljust(9) for b in BLOCKS)]
    for r in reversed(_rooms_by_dnl(result)):
        label = r["id"] if len(r["id"]) <= 24 else (r.get("name") or r["id"])[:24]
        lines.append("%-24s %5s %6s  %-5s  %s" % (
            label, _f(r["dnl_dba"]), _f(r["night_dba"]), "FAIL" if r["exceeds_hud_45"] else "pass",
            "  ".join(_f(r["blocks"][b]["dba"]).ljust(9) for b in BLOCKS)))
    return "\n".join(lines) + "\n"


def render(prop, sources, result, overrides, property_path, sources_path, command=None, note=None):
    names = _Names(prop)
    rooms = {r["id"]: r for r in result["rooms"]}
    by_dnl = _rooms_by_dnl(result)
    bedrooms = [r for r in result["rooms"] if r["type"] == "bedroom"]
    loudest_bed = max(bedrooms, key=lambda r: r["dnl_dba"] or 0.0)["id"] if bedrooms else None
    _, base = run(prop, _without_test(sources), overrides)
    L = []
    w = L.append
    w("# Demo results: %s" % (prop.get("address") or prop.get("id")))
    w("")
    w("Generated by `%s` (model %s). Do not edit by hand." % (
        command or "python -m noisemodel.predict %s %s --report" % (property_path, sources_path), result["model_version"]))
    w("")
    if note:
        w(note)
        w("")
    open_parts = [p for p in prop.get("partitions") or [] if p.get("door") == "open" or p.get("kind") == "opening"]
    w("All levels are A-weighted, in dBA, inside each room with windows and doors closed unless stated%s. "
      % ("; %d interior openings with no door leaf in the input stay open (%s)" % (
          len(open_parts), ", ".join(names.partition(p["id"]) for p in open_parts)) if open_parts else "") +
      "The daily score is DNL (24-hour average with a 10 dB penalty on 22:00 to 07:00). Rooms whose "
      "windows were measured (window survey) carry a range of plus or minus 3 dB; the others plus or minus 5 dB. "
      "Levels under 15 dBA are shown as 'below 15': the model leaves out flanking paths, so it does not "
      "claim a precise number there. Construction era used: `%s`." % result["era"])
    w("")
    ff = result["outdoor_free_field"]
    if ff:
        w("Outdoor, free field at the facade point (no shielding): " + "; ".join(
            "%s L24 %s dBA, DNL %s" % (m, _f(v["l24_dba"]), _f(v["dnl_dba"])) for m, v in ff.items()) + ".")
        w("")

    w("## 1. Room ranking")
    w("")
    w("Quietest to loudest by DNL. HUD's interior goal is DNL 45 (24 CFR 51.101).")
    w("")
    w("| Room | DNL | Range | HUD 45 |")
    w("|---|---|---|---|")
    for r in by_dnl:
        d = r["dnl_dba"]
        rng = "-" if d is None else "%.1f to %.1f" % (d - r["range_db"], d + r["range_db"])
        w("| %s | %s | %s | %s |" % (r["name"], _f(d), rng, "fail" if r["exceeds_hud_45"] else "pass"))
    w("")

    w("## 2. Time of day")
    w("")
    w("Room level in each time block (dBA, energy mean of the block's hours).")
    w("")
    road = ff.get("road", {}).get("blocks", {})
    if road and road.get("midday") is not None and road.get("evening_rush") is not None \
            and road["midday"] > road["evening_rush"]:
        w("Road traffic peaks in vehicles at the evening rush (R9), but midday reads %.1f dB louder outdoors "
          "(%.1f against %.1f dBA): R9's truck shares put more heavy trucks on the road at midday, and one "
          "heavy truck carries the energy of many cars (R7)." % (road["midday"] - road["evening_rush"],
                                                                 road["midday"], road["evening_rush"]))
        w("")
    w("| Room | " + " | ".join(BLOCK_TITLES[b] for b in BLOCKS) + " |")
    w("|---|" + "---|" * len(BLOCKS))
    for r in reversed(by_dnl):
        w("| %s | %s |" % (r["name"], " | ".join(_f(r["blocks"][b]["dba"]) for b in BLOCKS)))
    w("")

    w("## 3. Why")
    w("")
    w("Share of each room's daily sound energy by path, for the three loudest rooms. 'From' rows are "
      "sound arriving from a neighbouring room through the partition or doorway.")
    w("")
    for r in list(reversed(by_dnl))[:3]:
        raw = base[r["id"]]
        w("**%s** (DNL %s). By source: %s." % (r["name"], _f(r["dnl_dba"]), ", ".join(
            "%s %.0f%%" % (m, 100 * s) for m, s in sorted(raw["sources"].items(), key=lambda kv: -kv[1]))))
        w("")
        w("| Path | Share |")
        w("|---|---|")
        shown = 0.0
        for key, share in sorted(raw["paths"].items(), key=lambda kv: -kv[1]):
            if share < 0.01:
                continue
            shown += share
            w("| %s | %.0f%% |" % (_path_label(key, names), 100 * share))
        if shown < 0.995:
            w("| other paths, each under 1%% | %.0f%% |" % (100 * (1 - shown)))
        w("")

    if loudest_bed:
        w("## 4. Fixes")
        w("")
        tried = fixes(prop, sources, loudest_bed, overrides, base=base, include_negligible=True)
        fx = [x for x in tried if not x["negligible"]]
        w("Loudest bedroom: **%s** (DNL %s). Each fix is a rerun of the whole model with one change." % (
            rooms[loudest_bed]["name"], _f(rooms[loudest_bed]["dnl_dba"])))
        w("")
        w("| Fix | Change in DNL (dB) | DNL after |")
        w("|---|---|---|")
        for x in sorted(tried, key=lambda x: x["delta_raw"]):
            change = "%+.1f" % x["delta_raw"] if not x["negligible"] else "%+.3f (negligible)" % x["delta_raw"]
            w("| %s | %s | %.1f |" % (x["text"], change, x["dnl_after"]))
        if fx:
            best = min(fx, key=lambda x: x["delta_raw"])
            w("")
            w("Best fix: %s, %+.1f dB. Window replacements also reset the leak fraction to %g "
              "(SOUND_MODEL.md 3.6, placeholder); laminated OITC 35 is a centre-of-glass rating, so a whole unit "
              "on site can be up to 6 dB worse (SOUND_MODEL.md 6.B7)." % (
                  best["text"][0].lower() + best["text"][1:], best["delta_raw"], base["_assumptions"].value("leak_fraction.after_window_upgrade")))
        skipped = []
        if not any(x["action"] == "seal_only" for x in fx):
            skipped.append("seal only (%s)" % (
                "it does not lower this room" if any(x["action"] == "seal_only" for x in tried)
                else "the frames already have the sealed leak fraction"))
        if not any(x["action"] == "close_door" for x in fx):
            skipped.append("close an interior door (%s)" % (
                "it does not lower this room" if any(x["action"] == "close_door" for x in tried) else "none is open"))
        if skipped:
            w("Not applicable here: %s." % "; ".join(skipped))
        w("")

        w("## 5. What-ifs")
        w("")
        w("Four reruns that should move the numbers in a known direction. DNL in dB.")
        w("")
        ids = [r["id"] for r in reversed(by_dnl) if prop and any(
            x["id"] == r["id"] and x.get("exterior_walls") for x in prop["rooms"])]
        w("| Run | What changed | " + " | ".join(rooms[i]["name"] for i in ids) + " |")
        w("|---|---|" + "---|" * len(ids))
        w("| Base | As modelled | " + " | ".join(_f(base[i]["dnl"]) for i in ids) + " |")
        for x in what_ifs(prop, sources, loudest_bed, overrides):
            w("| %s | %s | %s |" % (x["name"], x["text"], " | ".join(
                "%s (%s)" % (_f(x["raw"][i]["dnl"]), _delta(x["raw"][i]["dnl"] - base[i]["dnl"])) for i in ids)))
        w("")
        w("The windows-open rule takes 12 dB off the level at the wall holding the open window, after "
          "orientation; R3 E5 measures it against the free-field level. This is a modelling choice (V1 2c).")
        w("")

        w("## 6. Sleep")
        w("")
        w("Overnight (00:00 to 06:00) level in each bedroom against the WHO 30 dBA bedroom guideline.")
        w("")
        w("| Bedroom | Overnight | WHO 30 |")
        w("|---|---|---|")
        for r in bedrooms:
            w("| %s | %s | %s |" % (r["name"], _f(r["night_dba"]), "above" if r["exceeds_who_30_night"] else "below"))
        w("")

    w("## 7. Assumptions")
    w("")
    w("Every input marked `assumed` and every `assumptions.yaml` value marked `placeholder` that this run used.")
    w("")
    w("| Input | Value | Source |")
    w("|---|---|---|")
    seen = set()
    for item in result["assumptions_used"]["inputs"]:
        k = (item["input"], json.dumps(item["value"]))
        if k in seen:
            continue
        seen.add(k)
        w("| %s | %s | %s |" % (item["input"], _short(item["value"]), (item.get("source") or "").replace("|", "/")))
    w("")
    w("| assumptions.yaml key | Value |")
    w("|---|---|")
    for key, v in result["assumptions_used"]["values"].items():
        if v["status"] in ("placeholder", "override"):
            w("| `%s`%s | %s |" % (key, " (override)" if v["status"] == "override" else "", _short(v["value"])))
    w("")

    w("## 8. Check")
    w("")
    c = result["checks"]
    if c:
        w("| Road level, 24-hour LAeq at the facade point | dBA |")
        w("|---|---|")
        w("| From traffic counts (R7: TNM emission levels, FHWA-RD-77-108 propagation) | %.1f |" % c["road_detailed_l24_dba"])
        w("| BTS 2020 road map at the unit's pixel | %.1f |" % c["road_bts_dba"])
        w("| Difference, counts minus map | %+.1f |" % c["road_detailed_minus_bts_db"])
        w("")
        w("The map is shown for comparison only. R7 found the BTS map falls off much faster than any line "
          "source away from the road line and reads %.0f dB %s at this unit, so the model uses the "
          "counts (docs/BUILD_BRIEF.md section 4)." % (abs(c["road_detailed_minus_bts_db"]),
                                                      "low" if c["road_detailed_minus_bts_db"] > 0 else "high"))
    else:
        note = (sources.get("outdoor_levels_dba") or {}).get("source")
        w("No BTS map value to compare with the road level from counts%s" % (": " + note if note else "."))
    w("")

    w("## Outdoor level at each wall")
    w("")
    w("Midday block, after orientation, barrier, foliage and building rows (capped at 25 dB in total).")
    w("")
    w("| Wall | Room | Facing | Angle to source | Shielding (dB) | Midday outdoor (dBA) |")
    w("|---|---|---|---|---|---|")
    for x in result["outdoor"]:
        md = x["blocks"]["midday"]["by_source"]
        w("| %s | %s | %.0f | %s | %.1f | %s |" % (
            names.wall(x["wall"]), names.room(x["room"]), x["azimuth_deg"], "-" if x["alpha_deg"] is None else "%.0f" % x["alpha_deg"],
            x["total_shielding_db"], ", ".join("%s %s" % (m, _f(v)) for m, v in md.items())))
    w("")

    if result.get("field_test"):
        ft = result["field_test"]
        w("## Field test")
        w("")
        w("Measured %.1f dBA outside wall %s (%s, %s mode, constant %+.2f dB). %s" % (
            ft["outdoor_dba"], ft["wall"], ft["outdoor_position"], ft["mode"], ft["incidence_constant_db"],
            ft["position_rule"]))
        w("")
        w("| Room | Predicted | Measured (background removed) | Difference | Predicted reduction | "
          "Measured reduction | Inside +/- range | Note |")
        w("|---|---|---|---|---|---|---|---|")
        for r in ft["rooms"]:
            w("| %s | %s | %s | %s | %s | %s | %s | %s |" % (
                r["room"], _f(r["predicted_dba"]), _f(r["measured_dba"]),
                "-" if r["difference_db"] is None else "%+.1f" % r["difference_db"],
                _f(r["predicted_reduction_db"]), _f(r["measured_reduction_db"]),
                "%s (+/- %d)" % ("yes" if r["inside_range"] else "no", r["range_db"]), r["note"]))
        w("")

    if result["warnings"]:
        w("## Warnings from this run")
        w("")
        for x in result["warnings"]:
            w("- %s" % x)
        w("")
    return "\n".join(L)


# ---------------------------------------------------------------- unit profile (issue #36)

def render_profile(prof, quiet, comparison=None, worth=None, check=None):
    """'Unit profile' and 'Before and after' sections, added to the report only with --profile."""
    L = []
    w = L.append
    w("## Unit profile")
    w("")
    w("Every field the model filled in, with where its value came from (`scan`, `costar`, `map`, `inferred`, "
      "`assumed`, `edited`). %s. Interior doors and walls are not listed; they keep one default each." % prof["summary"])
    w("")
    if check and check.get("notice"):
        w("**Score not settled.** %s" % check["notice"])
        w("")
    u = quiet["unit"]
    if u:
        w("**Quiet Score %.0f** (likely %.0f to %.0f), from %s. %s" % (
            u["score"], u["range"][0], u["range"][1],
            " and ".join("%s (%.0f%%)" % (x["name"], 100 * x["weight"]) for x in u["from"]), quiet["note"]))
        w("")
    for limit in quiet.get("limits") or []:
        w("**Limit.** %s" % limit)
        w("")
    w("| Room | Level used | Level (dB) | Score | Likely |")
    w("|---|---|---|---|---|")
    for r in quiet["rooms"].values():
        w("| %s | %s | %s | %.0f | %.0f to %.0f |" % (r["name"], r["level_kind"], _f(r["level_db"]), r["score"],
                                                      r["range"][0], r["range"][1]))
    w("")
    w("| Field | Applies to | Value | Source | Note |")
    w("|---|---|---|---|---|")
    for e in prof["fields"]:
        el = e.get("element")
        where = "-" if not el else "%s, %s-facing (%s)" % (el["room_name"], el["facing"], el["wall"][:6])
        w("| %s | %s | %s | `%s` | %s |" % (e["label_text"], where, e["value_text"], e["label"],
                                            (e.get("note") or "").replace("|", "/")))
    w("")
    if prof.get("dataChanges"):
        w("Inputs the profile's data changed against the property file:")
        w("")
        for x in prof["dataChanges"]:
            w("- %s" % x["text"])
        w("")
    if worth:
        w("**Worth checking.** The unconfirmed fields that could move this unit's score most (one rerun per "
          "alternative value):")
        w("")
        for x in worth[:5]:
            w("- %s" % x["text"])
        w("")
    if comparison is not None:
        w("## Before and after")
        w("")
        b, e = comparison["baseline"]["score"]["unit"], comparison["edited"]["score"]["unit"]
        if b and e:
            w("Auto-filled profile: **%.0f**. With the edits: **%.0f** (%+.0f). Each edit is applied on top of the "
              "earlier ones, in the order made, so the changes add up to the total." % (
                  b["score"], e["score"], comparison["total_change_raw"]))
            w("")
        w("| Edit | Score change |")
        w("|---|---|")
        for c in comparison["changes"]:
            w("| %s | %s |" % (c["text"], "rejected: %s" % c["rejected"] if c["rejected"] else
                                "%+.1f" % c["unit_change_raw"]))
        w("")
        if comparison["edited"]["flags"]:
            for f in comparison["edited"]["flags"]:
                w("- %s" % f)
            w("")
    return "\n".join(L)
