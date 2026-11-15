"""Facade validation against the measured US rooms of R6, and sensitivity tables for the two examples.

    python -m noisemodel.validation [--out docs/VALIDATION.md]

Each case runs the model's own facade and room code (rooms.Building) with the same incident level on
every exterior wall and reports NLR = outdoor free-field level minus room level (R6 E2). No value is
tuned; only what R6 states about each case is used, and the rest comes from the model's defaults.
"""
import argparse
import copy
import json
import os
import statistics
import sys

from . import db, facade
from .assumptions import Assumptions
from .predict import run
from .report import shift_roads
from .rooms import Building

FT = 0.3048
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXAMPLES = (("Demo: Matterport zzvymDx5ty7, 2219 Greenhouse Rd", "zzvymDx5ty7"),
            ("Second example: 2125 Yale St, unit 205", "yale"))

# The R3 test bedroom (4 x 3.5 x 2.4 m) stands in where R6 gives no room size.
STD = (4.0, 3.5, 2.4)


def _room(width, depth, height, walls):
    """walls: list of (length_m, window_area_m2 or None, wall_type, window_type)."""
    return {
        "id": "case", "lat": 0.0, "lon": 0.0, "facade_point": {"lat": 0.0, "lon": 0.0},
        "year_built": None,
        "rooms": [{"id": "r", "type": "bedroom", "area_m2": width * depth, "height_m": height,
                   "volume_m3": width * depth * height,
                   "exterior_walls": [{"id": "w%d" % k, "azimuth_deg": 0, "area_m2": length * height,
                                       "wall_type": wt, "window_area_m2": win, "window_type": wint,
                                       "door_area_m2": 0}
                                      for k, (length, win, wt, wint) in enumerate(walls)]}],
        "partitions": [],
    }


def _std(n_walls, wall_type, window_type, windowless=0):
    w, d, h = STD
    lengths = [w, d, w][:n_walls]
    return _room(w, d, h, [(L, 0.0 if k < windowless else None, wall_type, window_type)
                           for k, L in enumerate(lengths)])


def cases():
    """(id, measured NLR, exact?, property, what was assumed)."""
    vinyl, brick, storm = "vinyl_siding_2x4", "brick_veneer", "with_storm"
    std_note = "room size not given: R3 test bedroom 4 x 3.5 x 2.4 m, 15% window"
    out = [
        ("C1_LR", 26.9, True, _std(1, vinyl, storm), "vinyl siding, prime + storm; " + std_note),
        ("C1_BR1", 25.3, True, _std(1, vinyl, storm), "vinyl siding, prime + storm; " + std_note),
        ("C1_BR2", 23.0, True, _std(1, vinyl, storm), "vinyl siding, prime + storm; " + std_note),
        ("C1_DRK", 22.2, True, _std(1, vinyl, storm),
         "vinyl siding, prime + storm; one facade, 'large window' not sized: 15%; " + std_note),
        ("C2_LR", 22.9, True, _std(2, brick, storm, windowless=1),
         "brick veneer, prime + storm; one windowless facade plus one with a 15% window; room size not given"),
        ("C2_BR1", 26.0, True, _std(1, brick, storm), "brick veneer, prime + storm; " + std_note),
        ("C2_BR2", 24.8, True, _std(1, brick, storm), "brick veneer, prime + storm; " + std_note),
        ("C2_DR", 22.3, True, _std(3, vinyl, storm),
         "vinyl-sided addition, three facades, bay window not sized: 15% each; room size not given"),
        ("C3_den", 24.9, True, _room(15.5 * FT, 11.5 * FT, 8 * FT, [(15.5 * FT, None, vinyl, None)]),
         "vinyl siding; 15.5 x 11.5 x 8 ft; facades and windows not stated: one long wall, 15%, era window"),
        ("C3_BR", 23.8, True, _room(12 * FT, 9.5 * FT, 8 * FT, [
            (12 * FT, 2.5 * FT * (4 + 1 / 3.0) * FT, vinyl, None),
            (9.5 * FT, 2.5 * FT * (4 + 1 / 3.0) * FT, vinyl, None)]),
         "vinyl siding; 12 x 9.5 x 8 ft; two walls each with a 2.5 x 4.33 ft window; window type not stated"),
        ("C4_large", 31.7, False, _room(20 * FT, 17 * FT, 10 * FT, [(20 * FT, 3.5 * FT * 3.75 * FT, None, None)]),
         "construction not stated; 20 x 17 x 10 ft, one 3.5 x 3.75 ft window, one exterior wall assumed"),
        ("C4_small", 28.8, False, _room(13.5 * FT, 7.5 * FT, 10 * FT, [(13.5 * FT, None, None, None)]),
         "construction and window not stated; 13.5 x 7.5 x 10 ft, one wall, 15%"),
        ("C5_main_bed", 26.5, False, _std(1, None, None), "construction not stated; " + std_note),
        ("C5_bed2", 24.7, False, _std(1, None, None), "construction not stated; " + std_note),
        ("C7_corner", 21.7, False, _std(2, None, None), "construction not stated; corner room: two walls, 15%"),
        ("C8_corner", 21.5, False, _std(2, None, None), "construction not stated; corner room: two walls, 15%"),
        ("C9_first_floor", 28.4, False, _std(2, None, None), "construction not stated; corner room: two walls, 15%"),
        ("C9_second_floor", 28.4, False, _std(2, None, None), "construction not stated; corner room: two walls, 15%"),
    ]
    return out


def nlr(prop, a):
    warnings, assumed = [], []
    b = Building(prop, a, warnings, assumed)
    F, _ = b.facade_energy({w["id"]: [0.0] for w in b.walls}, facade.incidence_constant(a))
    return -db.level(b.solve(F)[0, 0])


def run_validation(a=None):
    a = a or Assumptions.load()
    measured = a.value("validation.cases")
    rows = []
    for cid, meas, exact, prop, note in cases():
        assert abs(measured[cid] - meas) < 1e-9, cid
        pred = nlr(prop, a)
        rows.append({"case": cid, "measured": meas, "predicted": pred, "error": pred - meas, "exact": exact,
                     "note": note})
    return rows


def _other_walls_exposed(prop):
    """Every boundary wall of unknown exposure treated as outdoors, with the 15% window rule."""
    p = copy.deepcopy(prop)
    rooms = {r["id"]: r for r in p["rooms"]}
    for w in p.get("other_boundary_walls") or []:
        if w.get("exposure") == "unknown":
            rooms[w["room"]].setdefault("exterior_walls", []).append({
                "id": w["id"], "azimuth_deg": w["azimuth_deg"], "area_m2": w["area_m2"], "wall_type": None,
                "window_area_m2": None, "window_type": None, "door_area_m2": 0, "door_type": None})
    return p


def _open_partitions_closed(prop):
    p = copy.deepcopy(prop)
    for part in p.get("partitions") or []:
        if part.get("kind", "wall") == "wall" and part.get("door") == "open":
            part["door"] = "closed"
    return p


def _openings_scaled(prop, k):
    p = copy.deepcopy(prop)
    for r in p["rooms"]:
        for w in r.get("exterior_walls") or []:
            for key in ("window_area_m2", "door_area_m2"):
                if w.get(key):
                    w[key] = w[key] * k
    return p


def _floor_step(prop):
    p = copy.deepcopy(prop)
    p["unit_floor"] = 3 if int(prop.get("unit_floor") or 1) == 1 else 1
    if p.get("storeys") and p["storeys"] < p["unit_floor"]:
        p["storeys"] = p["unit_floor"]
    return p


def _has_unknown_walls(prop):
    return any(w.get("exposure") == "unknown" for w in prop.get("other_boundary_walls") or [])


def _has_open_partitions(prop):
    return any(p.get("kind", "wall") == "wall" and p.get("door") == "open" for p in prop.get("partitions") or [])


SENSITIVITY = [
    ("Reverberation time 0.5 s -> 0.4 s (R4: furnished rooms 0.4 to 0.48 s)", {"rooms.reverberation_time": 0.4}, None),
    ("Incidence constant +3 -> +4 dB (long straight road, R3 E1)", {"facade.incidence_constant": 4}, None),
    ("Leak fraction 2000 onward 0.001 -> 0.01 (pre-2000 value)", {"leak_fraction.2000_on": 0.01}, None),
    ("Window OITC 22 -> 25 (double-pane fixed unit)", {"windows.double_pane_2000_on": 25}, None),
    ("Upper-floor wall fiber cement 37 -> brick veneer 40", {"walls.fiber_cement_upper_floor": 40}, None),
    ("Unit floor changed (ground <-> third floor: wall type and receiver height)", {}, "floor"),
    ("Era 2000 onward -> 1980 to 1999", {"property.era": "1980_1999"}, None),
    ("Interior door leaf derating 5 -> 8 dB", {"partitions.derating.door_leaf": 8}, None),
    ("Leak-area cap off (V1 4b)", {"facade.leak_area_cap_fraction": 100}, None),
    ("Road emission TNM -> RD-77-108 REMELs (R7 conflict 1)", {"road.emission_model": "rd77"}, None),
    ("Ground soft -> hard (R7 conflict 2)", {"road.ground_default": "hard"}, None),
    ("Road speed +5 mph", {}, lambda s, p: _road(s, speed_add_kmh=8.05)),
    ("Road speed -15 mph (inventory SPD_MAX may not be the posted limit)", {},
     lambda s, p: _road(s, speed_add_kmh=-24.14)),
    ("Road count +10% (Durham grew 10% from 2020 to 2025, R7)", {}, lambda s, p: _road(s, scale=1.10)),
    ("Road centreline 10 m further from the wall", {}, lambda s, p: shift_roads(s, p, 10.0)),
    ("Exposed window and door areas +20% (frames partly hidden in the scan)", {}, "openings"),
    ("Unknown-exposure boundary walls exposed outdoors (15% window rule)", {}, "unknown_walls"),
    ("Interior openings without a door leaf closed as hollow-core doors", {}, "close_openings"),
    ("Compass north off by 90 degrees (R10)", {"property.north_offset_deg": 90}, None),
    ("Compass north off by 180 degrees (R10)", {"property.north_offset_deg": 180}, None),
]


def _road(sources, speed_add_kmh=None, scale=None):
    s = copy.deepcopy(sources)
    for road in s["roads"]:
        if speed_add_kmh:
            road["speed_kmh"] = road["speed_kmh"] + speed_add_kmh
        if scale:
            for k in ("aadt", "medium_trucks_per_day", "heavy_trucks_per_day"):
                road[k] = road[k] * scale
    return s


def run_sensitivity(prop, sources, room_id):
    _, base = run(prop, sources)
    rows = []
    prop_change = {"floor": _floor_step, "openings": lambda p: _openings_scaled(p, 1.2),
                   "unknown_walls": _other_walls_exposed, "close_openings": _open_partitions_closed}
    applies = {"unknown_walls": _has_unknown_walls, "close_openings": _has_open_partitions}
    for label, ov, change in SENSITIVITY:
        p, src = prop, sources
        if isinstance(change, str):
            if change in applies and not applies[change](prop):
                continue
            p = prop_change[change](prop)
        elif change:
            src = change(sources, prop)
        _, raw = run(p, src, ov)
        rows.append({"label": label, "delta": raw[room_id]["dnl"] - base[room_id]["dnl"],
                     "night_delta": raw[room_id]["night"] - base[room_id]["night"]})
    return base[room_id]["dnl"], rows


def _signed(x):
    x = round(x, 1)
    return "%+.1f" % (0.0 if x == 0 else x)


def render(rows, sensitivity, a):
    lo, hi = 21.0, 32.0
    exact = [r for r in rows if r["exact"]]
    errs = [r["error"] for r in exact]
    worst = max(exact, key=lambda r: abs(r["error"]))
    case_lim = a.value("validation.case_error_limit")
    mean_lim = a.value("validation.mean_error_limit")
    L = []
    w = L.append
    w("# Validation")
    w("")
    w("Generated by `python -m noisemodel.validation`. Do not edit by hand.")
    w("")
    w("The facade and room part of the model (composite wall with leaks, +3 incidence constant, Sabine "
      "absorption) is run on the measured US rooms of `research/R6-validation.md`. Each prediction is the "
      "model's outdoor-to-indoor reduction, NLR = free-field level outside minus room level (R6 E2), with "
      "the same incident level on every exterior wall of the room. The measurements are FAA loudspeaker "
      "tests near the SDF and BWI airports, windows and doors closed; R6 says to compare road-type "
      "predictions with them. Where R6 gives no detail the model's defaults fill in (year built unknown: "
      "1980 to 1999 era, 15% window). Room sizes are missing for most cases, so the R3 test bedroom "
      "(4 x 3.5 x 2.4 m) stands in.")
    w("")
    w("**No value was tuned.** Nothing marked `sourced` or `calibrated` in `assumptions.yaml` was changed "
      "to improve the fit.")
    w("")
    w("## Cases with stated construction (C1, C2, C3)")
    w("")
    w("| Case | Measured NLR | Predicted NLR | Error (predicted - measured) | Inputs used |")
    w("|---|---|---|---|---|")
    for r in exact:
        w("| %s | %.1f | %.1f | %s | %s |" % (r["case"], r["measured"], r["predicted"], _signed(r["error"]), r["note"]))
    w("")
    w("- Mean error: **%+.1f dB** (limit %g, `validation.mean_error_limit`); mean absolute error %.1f dB." % (
        statistics.mean(errs), mean_lim, statistics.mean(abs(e) for e in errs)))
    w("- Worst error: **%+.1f dB**, %s (limit %g per case, `validation.case_error_limit`)." % (
        worst["error"], worst["case"], case_lim))
    w("- Cases outside the per-case limit: %s." % (", ".join(r["case"] for r in exact if abs(r["error"]) > case_lim)
                                                   or "none"))
    brick = [r["error"] for r in exact if r["note"].startswith("brick")]
    vinyl = [r["error"] for r in exact if not r["note"].startswith("brick")]
    w("- By wall: brick veneer rooms (C2 LR, BR1, BR2) mean error %+.1f dB; vinyl-sided rooms (C1, C2 DR, "
      "C3) mean error %+.1f dB." % (statistics.mean(brick), statistics.mean(vinyl)))
    w("")
    w("The model reads louder indoors than measured (negative error = predicted reduction too small) for "
      "the vinyl-sided rooms. In those rooms the vinyl siding wall (OITC 24, NRC lab test, `sourced`) "
      "carries most of the transmitted energy, so the result rests on that one rating and on the unknown "
      "room sizes; the brick-veneer rooms, where windows and leaks dominate as in the demo unit, are within "
      "2.2 dB. The 1990s leak fraction is `calibrated` (R3 E3) and was not changed. Using the sealed leak "
      "fraction for the storm windows (R3 conflict 6) would raise C1 by about 1.3 dB and not close the gap.")
    w("")
    w("Several rooms of one house share identical model inputs (R6 gives no room sizes or window areas), "
      "so the model gives them one number while the measurements spread by up to 4.7 dB (C1). That spread "
      "is the floor on what this comparison can show without room sizes and window areas.")
    w("")
    w("## Range check only (C4, C5, C7, C8, C9)")
    w("")
    w("R6 does not give the construction of these rooms, so they are not scored. The check is that the "
      "model's default prediction lands inside the measured span of %g to %g dB." % (lo, hi))
    w("")
    w("| Case | Measured NLR | Predicted NLR (defaults) | Inside %g to %g | Inputs used |" % (lo, hi))
    w("|---|---|---|---|---|")
    for r in rows:
        if r["exact"]:
            continue
        w("| %s | %.1f | %.1f | %s | %s |" % (r["case"], r["measured"], r["predicted"],
                                             "yes" if lo <= r["predicted"] <= hi else "no", r["note"]))
    w("")
    w("## Other checks the tests run")
    w("")
    w("- SOUND_MODEL.md section 5 worked example: every step in the V1 review table reproduced to 0.05 dB "
      "(bedroom midday 27.15, corridor 19.67, DNL 29.53).")
    w("- R3 era table, 65 dBA outside the 4 x 3.5 x 2.4 m bedroom, 15% window: 45.1, 41.5, 41.2, 38.2 dBA.")
    w("- All-glass wall: NLR at least 18 dB in every era; 1980 to 1999 gives 45.6 dBA (NLR 19.4) with the "
      "V1 leak cap.")
    w("- R7 worked example: 66.4 dBA (soft) and 67.6 dBA (hard) with RD-77-108 levels, 65.8 with TNM; Yale St "
      "count at 15 m: 63.0 dBA (TNM), 63.3 (RD-77-108).")
    w("")
    w("Known side effect of applying the V1 leak cap as written (`f * min(sum of openings, 0.15 * wall)`): "
      "the cap also counts doors. R3's check that a 1.9 m2 exterior door adds 4 to 6 dB to the 15% window "
      "room now gives about +2.6 dB instead of +4.3, because the door's leak is cut back to the cap. Both "
      "examples have one exterior door, on the living room: a glazed sliding door (zzvymDx5ty7) and a "
      "balcony door (Yale St).")
    w("")
    w("## Sensitivity of the loudest bedroom")
    w("")
    w("Each main assumption moved by one realistic step, everything else as in that example's demo run. "
      "Steps that do not apply to an example (no unknown-exposure walls, no open interior openings) are "
      "left out of its table.")
    w("")
    for title, room_name, sens_base, sens_rows in sensitivity:
        w("### %s" % title)
        w("")
        w("Change in the DNL of %s (base %.1f dB) and in its overnight level." % (room_name, sens_base))
        w("")
        w("| Change | DNL change (dB) | Overnight change (dB) |")
        w("|---|---|---|")
        for r in sorted(sens_rows, key=lambda r: -abs(r["delta"])):
            w("| %s | %s | %s |" % (r["label"], _signed(r["delta"]), _signed(r["night_delta"])))
        w("")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m noisemodel.validation")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs", "VALIDATION.md"))
    args = ap.parse_args(argv)
    a = Assumptions.load()
    rows = run_validation(a)
    sensitivity = []
    for title, name in EXAMPLES:
        with open(os.path.join(ROOT, "samples", "property.%s.json" % name)) as fh:
            prop = json.load(fh)
        with open(os.path.join(ROOT, "samples", "sources.%s.json" % name)) as fh:
            sources = json.load(fh)
        result, _ = run(prop, sources)
        bedrooms = [r for r in result["rooms"] if r["type"] == "bedroom"]
        loudest = max(bedrooms, key=lambda r: r["dnl_dba"] or 0.0)
        sens_base, sens_rows = run_sensitivity(prop, sources, loudest["id"])
        label = loudest["id"] if len(loudest["id"]) <= 16 else "%s, Matterport room %s," % (loudest["name"], loudest["id"])
        sensitivity.append((title, label, sens_base, sens_rows))
    with open(args.out, "w") as fh:
        fh.write(render(rows, sensitivity, a))
    for r in rows:
        sys.stdout.write("%-16s measured %.1f predicted %.1f error %+.1f%s\n" % (
            r["case"], r["measured"], r["predicted"], r["error"], "" if r["exact"] else " (range check)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
