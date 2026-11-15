"""Field test example: a speaker placed close to a window wall.

A standalone example. It is not part of the noise model and nothing in `noisemodel/`
imports it. It only reads the model's numbers (`assumptions.yaml`) so that the wall,
window, leak and room values are the same ones the model uses.

Why it exists: the model's built-in speaker mode (docs/BUILD_BRIEF.md section 8a) assumes
the speaker is far enough back to cover the whole wall evenly. A speaker one foot from the
wall is not: most of its sound lands on a small patch. This script does that spreading
step, then uses the model's values for everything after it.

Steps:
  1. Sound power of the speaker from the level measured close to it (point source).
  2. Share of that power landing on the window and on the rest of the wall, from the solid
     angle each one covers as seen from the speaker.
  3. Power passed into the room by the glass, by frame leakage and by the wall.
  4. Level at the listener: sound bounced around the room (4W/A) plus sound arriving
     straight from the window (W / (2 pi r^2)).
  5. Add the room's background level, and compare with what was measured.

Run:
    python fieldtests/near_speaker.py fieldtests/hotel_speaker_test.json
    python fieldtests/near_speaker.py fieldtests/hotel_speaker_test.json --json
"""
import argparse
import json
import math
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)

from noisemodel import db  # noqa: E402  (read-only helpers)
from noisemodel.assumptions import Assumptions  # noqa: E402


def _corner(x, y, d):
    return math.atan2(x * y, d * math.sqrt(x * x + y * y + d * d))


def solid_angle(x1, x2, y1, y2, d):
    """Solid angle (steradians) of the rectangle [x1, x2] x [y1, y2] in a plane a distance d away,
    seen from a point above the plane's origin."""
    return _corner(x2, y2, d) - _corner(x1, y2, d) - _corner(x2, y1, d) + _corner(x1, y1, d)


def incident_power(setup):
    """Power landing on the window and on the rest of the wall, per unit of the speaker's intensity at
    its reference distance. The wall is centred on the origin and the window is centred in the wall."""
    wall, window, spk = setup["wall"], setup["window"], setup["speaker"]
    d = spk["distance_from_wall_m"]
    off = spk.get("offset_from_window_centre_m", 0.0)
    ref = spk["reference_distance_m"]
    hw, hh = wall["width_m"] / 2.0, wall["height_m"] / 2.0
    ww, wh = window["width_m"] / 2.0, window["height_m"] / 2.0
    omega_wall = solid_angle(-hw - off, hw - off, -hh, hh, d)
    omega_window = solid_angle(-ww - off, ww - off, -wh, wh, d)
    # A point source of power P gives intensity I = P / (4 pi ref^2) at the reference distance, and
    # sends P * omega / (4 pi) into a solid angle omega. So power per unit I is omega * ref^2.
    return omega_window * ref * ref, (omega_wall - omega_window) * ref * ref, omega_window / omega_wall


def transmitted(setup, a):
    """Power entering the room by each path, per unit of the speaker's intensity at its reference distance."""
    wall, window = setup["wall"], setup["window"]
    on_window, on_wall, window_share = incident_power(setup)
    wall_area = wall["width_m"] * wall["height_m"]
    window_area = window["width_m"] * window["height_m"]
    r_wall = float(a.value("walls." + wall["type"]))
    r_window = float(a.value("windows." + window["type"]))
    f = float(a.value("leak_fraction." + window["leak_fraction"]))
    leak_area = f * min(window_area, a.value("facade.leak_area_cap_fraction") * wall_area)
    parts = {
        "glass": on_window * 10.0 ** (-r_window / 10.0),
        "frame leakage": (on_window / window_area) * leak_area,
        "wall": on_wall * 10.0 ** (-r_wall / 10.0),
    }
    return parts, window_share, {"wall_rating": r_wall, "window_rating": r_window, "leak_fraction": f}


def drop_to_listener(setup, a):
    """Level at the listener minus the level at the speaker's reference distance, in dB (negative)."""
    parts, window_share, used = transmitted(setup, a)
    total = sum(parts.values())
    room = setup["room"]
    absorption = a.value("rooms.sabine_constant") * room["volume_m3"] / a.value("rooms.reverberation_time")
    r = setup["listener"]["distance_from_wall_m"]
    reverberant = 4.0 * total / absorption
    direct = total / (2.0 * math.pi * r * r)
    return {
        "drop_db": db.level(reverberant + direct),
        "reverberant_db": db.level(reverberant),
        "direct_db": db.level(direct),
        "path_shares": {k: v / total for k, v in parts.items()},
        "window_share_of_wall_power": window_share,
        "absorption_m2": absorption,
        "values_used": used,
    }


def with_background(level, background):
    return db.energy_sum([level, background]) if background is not None else level


def without_background(level, background):
    if background is None:
        return level
    return db.level(db.energy(level) - db.energy(background))


def evaluate(test, a=None):
    """Run every setup in a test file against every run. Returns a plain dict."""
    a = a or Assumptions.load()
    background = test.get("background_dba")
    out = {"name": test.get("name"), "background_dba": background, "setups": []}
    for setup_name, overrides in test["setups"].items():
        setup = json.loads(json.dumps(test["base"]))
        for section, values in overrides.items():
            if section != "note":
                setup[section].update(values)
        res = drop_to_listener(setup, a)
        runs = []
        for run in test["runs"]:
            lo, hi = run["speaker_dba_at_reference"]
            mlo, mhi = run["measured_dba"]
            centre = (lo + hi) / 2.0
            pred = [with_background(x + res["drop_db"], background) for x in (lo, centre, hi)]
            measured_centre = (mlo + mhi) / 2.0
            runs.append({
                "run": run["name"],
                "blind": run.get("blind", False),
                "speaker_dba": [lo, hi],
                "predicted_speaker_alone_dba": [round(lo + res["drop_db"], 1), round(hi + res["drop_db"], 1)],
                "predicted_on_meter_dba": [round(pred[0], 1), round(pred[2], 1)],
                "predicted_centre_dba": round(pred[1], 1),
                "measured_dba": [mlo, mhi],
                "measured_centre_dba": measured_centre,
                "measured_speaker_alone_dba": [round(without_background(mlo, background), 1),
                                               round(without_background(mhi, background), 1)],
                "difference_at_centre_db": round(pred[1] - measured_centre, 1),
                "above_background_db": [round(mlo - background, 1), round(mhi - background, 1)]
                if background is not None else None,
            })
        out["setups"].append({
            "setup": setup_name,
            "note": overrides.get("note"),
            "drop_db": round(res["drop_db"], 2),
            "reverberant_db": round(res["reverberant_db"], 2),
            "direct_db": round(res["direct_db"], 2),
            "path_shares": {k: round(v, 3) for k, v in res["path_shares"].items()},
            "window_share_of_wall_power": round(res["window_share_of_wall_power"], 3),
            "values_used": res["values_used"],
            "runs": runs,
        })
    return out


def render(result):
    lines = ["Field test: %s" % result["name"], "Background: %s dBA" % result["background_dba"], ""]
    for s in result["setups"]:
        shares = ", ".join("%s %d%%" % (k, round(100 * v)) for k, v in s["path_shares"].items())
        lines.append("Setup: %s" % s["setup"])
        if s["note"]:
            lines.append("  %s" % s["note"])
        lines.append("  Level at listener is %.1f dB below the level at the speaker's reference distance."
                     % -s["drop_db"])
        lines.append("  Window receives %d%% of the sound reaching the wall. Paths into the room: %s."
                     % (round(100 * s["window_share_of_wall_power"]), shares))
        for r in s["runs"]:
            lines.append("  %-6s speaker %s to %s dBA -> predicted on meter %s to %s (centre %s); measured %s to %s "
                         "(centre %s); model minus measured %+.1f dB%s"
                         % (r["run"], r["speaker_dba"][0], r["speaker_dba"][1],
                            r["predicted_on_meter_dba"][0], r["predicted_on_meter_dba"][1],
                            r["predicted_centre_dba"], r["measured_dba"][0], r["measured_dba"][1],
                            r["measured_centre_dba"], r["difference_at_centre_db"],
                            "  [blind]" if r["blind"] else ""))
        lines.append("")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Close-range speaker field test (standalone example).")
    ap.add_argument("test_file")
    ap.add_argument("--json", action="store_true", help="print the result as JSON")
    args = ap.parse_args(argv)
    with open(args.test_file) as fh:
        test = json.load(fh)
    result = evaluate(test)
    print(json.dumps(result, indent=2) if args.json else render(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
