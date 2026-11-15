"""predict(property, sources, overrides=None) -> levels dict, and the command line.

    python -m noisemodel.predict samples/property.zzvymDx5ty7.json samples/sources.zzvymDx5ty7.json \
        --out samples/levels.zzvymDx5ty7.json --report --export-lab [--set key=value ...]

Everything is computed on 24 hourly values; blocks are energy means of their hours and DNL comes from
the hourly values (V1 5a). Each source mode is solved on its own and energy-summed (SOUND_MODEL.md 1.7).
"""
import argparse
import copy
import json
import math
import os
import sys

import numpy as np

from . import MODEL_VERSION, db, facade, fieldtest, outdoor
from .assumptions import Assumptions
from .rooms import Building

PATH_NAMES = {"wall": "wall", "window": "window glass", "leak": "frame leakage", "door": "door",
              "open window": "open window", "roof": "roof"}


# ---------------------------------------------------------------- overrides

def _parse_value(text):
    try:
        return json.loads(text)
    except ValueError:
        return text


def _find(items, key, value, what):
    for it in items:
        if it.get(key) == value:
            return it
    raise KeyError("override names unknown %s %r" % (what, value))


def _apply_input_override(prop, key, value):
    parts = key.split(".")
    head = parts[0]
    if head == "property" and len(parts) == 2:
        if parts[1] == "era":
            prop["era"] = {"value": value, "status": "override"}
        else:
            prop[parts[1]] = value
        return
    if head in ("window", "wall") and len(parts) == 3:
        walls = [w for r in prop["rooms"] for w in r.get("exterior_walls") or []]
        wall = _find(walls, "id", parts[1], "wall")
        field = {"type": "%s_type" % head, "area_m2": "window_area_m2", "open": "window_open",
                 "leak_fraction": "window_leak_fraction", "fixed": "window_fixed"}.get(parts[2], parts[2])
        if head == "wall" and parts[2] == "type":
            field = "wall_type"
        wall[field] = value
        return
    if head == "door" and len(parts) == 3:
        part = _find(prop.get("partitions") or [], "id", parts[1], "partition")
        field = {"state": "door", "type": "door_type", "area_m2": "door_area_m2", "sweep": "door_sweep"}.get(parts[2], parts[2])
        part[field] = value
        return
    if head == "room" and len(parts) == 3:
        _find(prop["rooms"], "id", parts[1], "room")[parts[2]] = value
        return
    raise KeyError("unknown override %r" % key)


def split_overrides(overrides, a):
    model, inputs = {}, {}
    for k, v in (overrides or {}).items():
        (model if a.has(k) else inputs)[k] = v
    return model, inputs


# ---------------------------------------------------------------- output helpers

def _out_level(x):
    """Round for output; values under the plausible floor are reported as null (SOUND_MODEL.md 6.C2)."""
    if x is None or not math.isfinite(x):
        return None
    return round(x, 2)


def _floor(a):
    return a.value("reporting.plausible_output_range")[0]


def _visible(x, a):
    return None if x is None or x < _floor(a) else _out_level(x)


def _block_mean(arr, hours):
    return float(np.mean(arr[hours]))


# ---------------------------------------------------------------- the run

def run(prop, sources, overrides=None):
    """Full model run. Returns (levels dict, raw values for fixes and reports)."""
    probe = Assumptions.load()
    model_over, input_over = split_overrides(overrides, probe)
    a = Assumptions.load(overrides=model_over)
    prop = copy.deepcopy(prop)
    for k, v in input_over.items():
        _apply_input_override(prop, k, v)

    warnings, assumed = [], []
    b = Building(prop, a, warnings, assumed)
    for road in sources.get("roads") or []:
        if road.get("aadt") and road.get("status") in ("placeholder", "assumed"):
            first = (road.get("source") or "").split(". ")[0]
            assumed.append({"input": "traffic count of %s (%s)" % (road.get("name") or road["id"], road["status"]),
                            "value": road["aadt"], "source": first})
    fp = prop.get("facade_point") or {"lat": prop["lat"], "lon": prop["lon"]}
    origin = (float(fp["lat"]), float(fp["lon"]))
    receiver_height = a.value("outdoor.bts.receptor_height") + (b.unit_floor - 1) * a.value("rooms.storey_height")
    walls = [{"id": w["id"], "azimuth": w["azimuth"]} for w in b.walls]
    levels, info, peak, checks, free_field = outdoor.wall_levels(walls, sources, receiver_height, origin, a, warnings)

    constant = facade.incidence_constant(a)
    modes = [m for m in outdoor.MODES if m in free_field]
    m = len(b.members)
    energy = {}
    parts = {}
    for mode in modes:
        wl = {w: lv[mode] for w, lv in levels.items() if mode in lv}
        F, p = b.facade_energy(wl, constant, aircraft=(mode == "aircraft"),
                               roof_levels=free_field["aircraft"] if mode == "aircraft" else None)
        E = b.solve(F)
        p.update(b.inflow_parts(E))
        energy[mode] = E
        parts[mode] = p
    total = sum(energy.values()) if energy else np.zeros((m, 24))

    peak_in = None
    if peak is not None:
        unit = {w["id"]: [0.0] for w in b.walls}
        F1, _ = b.facade_energy(unit, constant, aircraft=True, roof_levels=[0.0])
        transfer = b.solve(F1)[:, 0]
        peak_in = [[None if (peak[h] is None or transfer[g] <= 0) else peak[h] + 10 * math.log10(transfer[g])
                    for h in range(24)] for g in range(m)]

    hours = outdoor.block_hours(a)
    hud = a.value("reporting.hud_interior_dnl")
    who = a.value("reporting.who_bedroom_night")
    who_max = a.value("reporting.who_bedroom_lamax")
    floor = _floor(a)

    rooms_out, raw = [], {}
    for i, r in enumerate(b.rooms):
        g = b.group_of[i]
        rng = b.room_range(i)
        hourly = [db.level(x) for x in total[g]]
        blocks = {}
        for name, hs in hours.items():
            e = _block_mean(total[g], hs)
            raw_level = db.level(e)
            by_source = {mode: _visible(db.level(_block_mean(energy[mode][g], hs)), a) for mode in modes}
            dom = None
            if e > 0:
                path_e = {}
                path_src = {}
                for mode in modes:
                    for (pg, key), arr in parts[mode].items():
                        if pg != g:
                            continue
                        v = _block_mean(np.asarray(arr), hs)
                        path_e[key] = path_e.get(key, 0.0) + v
                        if v > path_src.get(key, (None, -1.0))[1]:
                            path_src[key] = (mode, v)
                key = max(path_e, key=lambda k: path_e[k])
                if key.startswith("from:"):
                    dom = {"path": "from " + key[5:], "wall": None}
                else:
                    wall, part = key.split(":", 1)
                    dom = {"path": PATH_NAMES[part], "wall": None if wall == "roof" else wall}
                dom["source"] = path_src[key][0]
                dom["share"] = round(path_e[key] / e, 3)
            pk = None
            if peak_in is not None:
                vals = [peak_in[g][h] for h in hs if peak_in[g][h] is not None]
                pk = max(vals) if vals else None
            dba = _visible(raw_level, a)
            blocks[name] = {
                "dba": dba,
                "range_dba": None if dba is None else [round(raw_level - rng, 2), round(raw_level + rng, 2)],
                "below_15_dba": raw_level is not None and raw_level < floor,
                "by_source": by_source,
                "peak_dba": _visible(pk, a),
                "dominant": dom,
            }
        l24 = db.level(float(np.mean(total[g])))
        dnl = outdoor.dnl(hourly, a)
        night_raw = db.level(_block_mean(total[g], hours["overnight"]))
        e24 = float(np.sum(total[g]))
        path_share = {}
        if e24 > 0:
            for mode in modes:
                for (pg, key), arr in parts[mode].items():
                    if pg == g:
                        path_share[key] = path_share.get(key, 0.0) + float(np.sum(arr)) / e24
        room_out = {
            "id": r["id"], "name": r["name"], "type": r["type"],
            "solved_with": [b.rooms[k]["id"] for k in b.members[g] if k != i],
            "range_db": rng,
            "blocks": blocks,
            "l24_dba": _visible(l24, a),
            "dnl_dba": _visible(dnl, a),
            "exceeds_hud_45": dnl is not None and dnl > hud,
            "night_dba": _visible(night_raw, a),
            "exceeds_who_30_night": night_raw is not None and night_raw > who,
            "paths_24h": {k: round(v, 4) for k, v in sorted(path_share.items(), key=lambda kv: -kv[1])},
            "sources_24h": {mode: round(float(np.sum(energy[mode][g])) / e24, 4) for mode in modes} if e24 > 0 else {},
        }
        if peak_in is not None:
            peaks = [x for x in peak_in[g] if x is not None]
            room_out["exceeds_who_45_lamax"] = bool(peaks) and max(peaks) > who_max
        rooms_out.append(room_out)
        raw[r["id"]] = {"dnl": dnl, "l24": l24, "hourly": hourly, "night": night_raw,
                        "blocks": {n: db.level(_block_mean(total[g], hs)) for n, hs in hours.items()},
                        "paths": path_share,
                        "sources": {mode: float(np.sum(energy[mode][g])) / e24 for mode in modes} if e24 > 0 else {}}

    outdoor_out = []
    for w in b.walls:
        terms = info[w["id"]]["terms"] or {}
        blk = {}
        for name, hs in hours.items():
            blk[name] = {"by_source": {mode: _out_level(db.energy_mean([levels[w["id"]][mode][h] for h in hs]))
                                       for mode in modes if mode in levels[w["id"]]}}
        outdoor_out.append({
            "wall": w["id"], "room": w["room"], "azimuth_deg": round(w["azimuth"], 1), "blocks": blk,
            "shielded_source": info[w["id"]]["shielded_source"],
            "alpha_deg": None if terms.get("alpha") is None else round(terms["alpha"], 1),
            "source_distance_m": None if terms.get("distance") is None else round(terms["distance"], 1),
            "orientation_loss_db": round(terms.get("orientation", 0.0), 2),
            "barrier_loss_db": round(terms.get("barrier", 0.0), 2),
            "foliage_loss_db": round(terms.get("foliage", 0.0), 2),
            "rows_loss_db": round(terms.get("rows", 0.0), 2),
            "total_shielding_db": round(terms.get("total", 0.0), 2),
        })

    free_out = {}
    for mode, hourly in free_field.items():
        bl = outdoor.block_levels(hourly, a)
        free_out[mode] = {"blocks": {k: _out_level(v) for k, v in bl.items()},
                          "l24_dba": _out_level(db.energy_mean(hourly)), "dnl_dba": _out_level(outdoor.dnl(hourly, a))}

    result = {
        "property_id": prop.get("id"),
        "model_version": MODEL_VERSION,
        "era": b.era,
        "rooms": rooms_out,
        "outdoor": outdoor_out,
        "outdoor_free_field": free_out,
        "checks": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in checks.items()},
        "assumptions_used": {
            "inputs": assumed,
            "values": {k: {"value": v["value"], "status": v["status"]} for k, v in sorted(a.used.items())},
        },
        "warnings": [],
    }
    if sources.get("measured"):
        result["field_test"] = fieldtest.run(b, sources["measured"], a, warnings)
    seen = set()
    for w in warnings:
        if w not in seen:
            seen.add(w)
            result["warnings"].append(w)
    raw["_building"] = b
    raw["_free_field"] = free_field
    raw["_assumptions"] = a
    return result, raw


def predict(prop, sources, overrides=None, with_fixes=True):
    result, raw = run(prop, sources, overrides)
    if with_fixes:
        from . import report
        for r in result["rooms"]:
            fx = report.fixes(prop, sources, r["id"], overrides, base=raw)
            best = min(fx, key=lambda x: x["delta_db"]) if fx else None
            r["fix"] = None if best is None else {k: best[k] for k in ("action", "target", "delta_db", "text")}
    return result


def to_json(result):
    return json.dumps(result, indent=2, allow_nan=False) + "\n"


# ---------------------------------------------------------------- command line

def _load(path):
    with open(path) as fh:
        return json.load(fh)


def _profile_run(prop, sources, args):
    """--profile: the profile-applied property and the profile outputs added to levels.json."""
    from . import crosscheck
    from . import profile as unit_profile
    context = _load(args.context) if args.context else None
    if isinstance(context, dict) and "properties" in context:
        mid = prop.get("matterport_model_id")
        context = next((r for r in context["properties"] if r.get("matterportModelId") == mid), None)
    auto = unit_profile.build(prop, sources, context)
    edits = unit_profile.merge_edits(unit_profile.load_edits(args.building_edits) if args.building_edits else None,
                                     unit_profile.load_edits(args.edits) if args.edits else None)
    comparison = unit_profile.compare(prop, sources, auto, edits)
    prop2 = comparison["edited"]["property"]
    base = predict(prop2, sources, with_fixes=False)
    shown = unit_profile._relabel(unit_profile.build(prop2, sources, None, result=base),
                                  comparison["edited"]["profile"])
    shown["dataChanges"] = comparison["baseline"]["data_changes"]
    worth = unit_profile.worth_checking(prop, sources, auto, edits)
    check = crosscheck.status()
    outputs = {"profile": shown, "score": dict(comparison["edited"]["score"], crosscheck_notice=check["notice"]),
               "score_crosscheck": check}
    if edits:
        outputs.update({
            "baseline_score": comparison["baseline"]["score"],
            "changes": [{k: c[k] for k in ("edit", "text", "unit_change", "room_changes", "rejected", "flags")}
                        for c in comparison["changes"]],
            "total_change": comparison["total_change"],
        })
    outputs["worth_checking"] = worth
    if args.profile_out:
        with open(args.profile_out, "w") as fh:
            fh.write(json.dumps(shown, indent=2, allow_nan=False) + "\n")
    return prop2, {"outputs": outputs, "profile": shown, "comparison": comparison if edits else None, "worth": worth}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m noisemodel.predict", description=__doc__.split("\n")[0])
    ap.add_argument("property")
    ap.add_argument("sources")
    ap.add_argument("--out", help="write levels.json here")
    ap.add_argument("--report", action="store_true", help="write the markdown report and print a summary")
    ap.add_argument("--report-path", default=os.path.join("docs", "DEMO_RESULTS.md"))
    ap.add_argument("--report-note", help="a line printed under the report title")
    ap.add_argument("--export-lab", action="store_true",
                    help="write lab_sources.<model>.json and room_targets.<model>.json for the simulation")
    ap.add_argument("--export-dir", help="folder for --export-lab files (default: the folder of --out, else samples)")
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help="override an assumption or an input, e.g. window.bed1-n.type=laminated_acoustic")
    ap.add_argument("--profile", action="store_true",
                    help="build the unit profile, run on it and add the Quiet Score (docs/UNIT_PROFILE.md)")
    ap.add_argument("--edits", help="with --profile: an edits file (samples/edits.zzvymDx5ty7.example.json)")
    ap.add_argument("--building-edits", help="with --profile: a manager's building edits, applied before --edits")
    ap.add_argument("--context", help="with --profile: a local CoStar context record (never commit sponsor data)")
    ap.add_argument("--profile-out", help="with --profile: write the profile JSON here")
    args = ap.parse_args(argv)
    overrides = {}
    for item in args.set:
        k, _, v = item.partition("=")
        overrides[k.strip()] = _parse_value(v.strip())
    prop, sources = _load(args.property), _load(args.sources)
    prof = None
    if args.profile:
        prop, prof = _profile_run(prop, sources, args)
    result = predict(prop, sources, overrides)
    if prof is not None:
        result.update(prof["outputs"])
    text = to_json(result)
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(text)
    if args.report:
        from . import report
        command = " ".join(["python -m noisemodel.predict", args.property, args.sources]
                           + (["--out", args.out] if args.out else []) + ["--report"]
                           + (["--report-path", args.report_path] if args.report_path != ap.get_default("report_path") else [])
                           + (["--export-lab"] if args.export_lab else [])
                           + ["--set %s" % x for x in args.set]
                           + (["--profile"] if args.profile else [])
                           + (["--edits", args.edits] if args.edits else [])
                           + (["--building-edits", args.building_edits] if args.building_edits else [])
                           + (["--profile-out", args.profile_out] if args.profile_out else []))
        md = report.render(prop, sources, result, overrides, args.property, args.sources,
                           command=command, note=args.report_note)
        if prof is not None:
            md = md.rstrip("\n") + "\n\n" + report.render_profile(
                prof["profile"], prof["outputs"]["score"], prof["comparison"], prof["worth"],
                prof["outputs"]["score_crosscheck"]) + "\n"
        with open(args.report_path, "w") as fh:
            fh.write(md)
        sys.stdout.write(report.summary(result))
    elif not args.out:
        sys.stdout.write(text)
    if args.export_lab:
        from . import export_lab
        folder = args.export_dir or (os.path.dirname(args.out) if args.out else "samples")
        for path in export_lab.write(prop, sources, folder or ".", overrides, result):
            sys.stdout.write("wrote %s\n" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
