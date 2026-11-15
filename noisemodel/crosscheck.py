"""Cross-check of the Quiet Score against published sound scores (docs/UNIT_PROFILE_PLAN.md section 6a).

Published scores rate a location outdoors, so the comparison uses our outdoor free-field DNL at the building,
in decibels. Interim decisions of 2026-11-14 (Alejandro, plan 6a; revisit after the demo):

1. No outdoor 0 to 100 score is computed or shown. The outdoor level stays in dB and is compared by rank.
   The line HowLoud = 103.6 - 0.54 x DNL (score.crosscheck.howloud_line) is a diagnostic, fitted to 8 points
   on 2 roads; it is used only to measure gaps on HowLoud's scale.
2. No background traffic: the model counts only the roads it is given (see score.ROAD_LIMIT).
3. Tolerance: Spearman 0.8 or better across at least ten separate addresses, and on HowLoud's scale a
   median gap of 2 points or less and no gap above 5 (score.crosscheck.* in assumptions.yaml).

The agent reports; it never retunes. A missing lookup is never a pass.

    python -m noisemodel.crosscheck [--lookups docs/score_crosscheck_lookups.json]

prints the evaluation and the status line for docs/SCORE_CROSSCHECK.md.

lookups.json: {"sites": {site: {"scale": [min, max], "higher_is_quieter": bool, "measures": text}},
               "rows": [{"id", "address", "site", "score" (or null), "our_outdoor_dnl" (optional),
                         "distance_m" (optional)}]}
Lookups are entered by a person from the site, or through an official API; never by scraping. This module
makes no network calls. A HowLoud lookup script, if one is added, must read the key only from a local
HOWLOUD_API_KEY environment variable and never write it to a file or commit it.
"""
import argparse
import json
import os
import statistics
import sys

from .assumptions import Assumptions

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, "docs", "SCORE_CROSSCHECK.md")
LOOKUPS = os.path.join(ROOT, "docs", "score_crosscheck_lookups.json")
GAP_SITES = ("howloud",)  # sites whose scale the diagnostic line describes


def spearman(xs, ys):
    """Spearman rank correlation with average ranks for ties; None with fewer than three pairs."""
    n = len(xs)
    if n < 3:
        return None

    def ranks(v):
        order = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2.0 + 1.0
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    sx = sum((a - mx) ** 2 for a in rx) ** 0.5
    sy = sum((b - my) ** 2 for b in ry) ** 0.5
    if sx == 0 or sy == 0:
        return None
    return sxy / (sx * sy)


def line_value(dnl, a=None):
    """The diagnostic HowLoud-scale value at our outdoor DNL (score.crosscheck.howloud_line). Never a score."""
    a = a or Assumptions.load()
    ln = a.value("score.crosscheck.howloud_line")
    return float(ln["intercept"]) + float(ln["slope"]) * float(dnl)


def evaluate(rows, a=None):
    """rows: [{"address" (point id), "group" (the building's address), "our_dnl": dB or None,
               "theirs": published score or None, "higher_is_quieter": bool, "gap_site": bool}].

    Rank: Spearman of -DNL (or +DNL for a site where higher is louder) against the published score, so
    agreement is positive. Gap: |published - howloud_line(our DNL)|, only for sites the line describes.
    Returns {"status": "RESULT" | "ALERT", "reasons": [...], ...}. Rows without both values are missing.
    """
    a = a or Assumptions.load()
    rho_min = float(a.value("score.crosscheck.rank_correlation_min"))
    n_min = int(a.value("score.crosscheck.min_addresses"))
    med_max = float(a.value("score.crosscheck.median_gap_max"))
    any_max = float(a.value("score.crosscheck.any_gap_max"))
    pairs = [r for r in rows if r.get("our_dnl") is not None and r.get("theirs") is not None]
    missing = [r["address"] for r in rows if r.get("our_dnl") is None or r.get("theirs") is None]
    # Several lookup points near one building (e.g. distances from its road) count as one address.
    addresses = {r.get("group") or r["address"] for r in pairs}
    sign = lambda r: -1.0 if r.get("higher_is_quieter", True) else 1.0
    rho = spearman([sign(r) * r["our_dnl"] for r in pairs], [r["theirs"] for r in pairs])
    gaps = [(r["address"], r["theirs"] - line_value(r["our_dnl"], a)) for r in pairs if r.get("gap_site", True)]
    median = statistics.median([abs(g) for _, g in gaps]) if gaps else None
    worst = max(gaps, key=lambda x: abs(x[1])) if gaps else None
    reasons = []
    if len(addresses) < n_min:
        reasons.append("only %d of the required %d separate addresses with their own road inputs (%d lookup "
                       "points, %d missing)" % (len(addresses), n_min, len(pairs), len(missing)))
    if missing:
        reasons.append("missing lookups are not a pass: %s" % ", ".join(missing))
    if median is not None and median > med_max:
        reasons.append("median gap %.1f points is above %g" % (median, med_max))
    for addr, g in gaps:
        if abs(g) > any_max:
            reasons.append("%s gap %.1f points is above %g (published %s than the line)"
                           % (addr, abs(g), any_max, "quieter" if g > 0 else "louder"))
    if rho is None:
        if pairs:
            reasons.append("rank correlation cannot be computed from %d point(s)" % len(pairs))
    elif rho < rho_min:
        reasons.append("rank correlation %.2f is below %g" % (rho, rho_min))
    return {
        "status": "ALERT" if reasons else "RESULT",
        "reasons": reasons, "compared": len(pairs), "addresses": len(addresses), "missing": missing,
        "rank_correlation": None if rho is None else round(rho, 3),
        "median_gap": None if median is None else round(median, 2),
        "max_gap": None if worst is None else round(abs(worst[1]), 2),
        "max_gap_at": None if worst is None else worst[0],
        "tolerance": {"rank_correlation_min": rho_min, "min_addresses": n_min,
                      "median_gap_max": med_max, "any_gap_max": any_max},
    }


def first_line(status, reasons):
    if status == "RESULT":
        return "RESULT: within tolerance"
    return "ALERT: outside tolerance (%s)" % ("; ".join(reasons[:2]) if reasons else "see below")


def status(path=DOC):
    """The last cross-check, for the pipeline response, the report and the UI."""
    if not os.path.exists(path):
        return {"status": "not_run", "settled": False, "line": None, "document": "docs/SCORE_CROSSCHECK.md",
                "notice": "The Quiet Score has not been cross-checked against published sound scores yet."}
    with open(path) as fh:
        line = fh.readline().strip()
    kind = "result" if line.startswith("RESULT:") else "alert" if line.startswith("ALERT:") else "invalid"
    notice = None
    if kind != "result":
        notice = ("The last cross-check against published sound scores did not pass (%s). Treat the Quiet "
                  "Score as provisional; see docs/SCORE_CROSSCHECK.md." % (line or "no result line"))
    return {"status": kind, "settled": kind == "result", "line": line, "document": "docs/SCORE_CROSSCHECK.md",
            "notice": notice}


# ---------------------------------------------------------------- our side

def our_levels():
    """Our outdoor DNL (dB) and Quiet Score for every registered property with model inputs."""
    from .pipeline import CATALOG, NoiseModelPipeline
    from .score import outdoor_dnl
    out = []
    pipe = NoiseModelPipeline()
    for model_id in CATALOG:
        r = pipe.run({"modelId": model_id})
        dnl = outdoor_dnl(r["legacyRoomPrediction"])
        out.append({"model_id": model_id, "address": r["property"].get("address"),
                    "outdoor_dnl": None if dnl is None else round(dnl, 2),
                    "quiet_score": ((r.get("score") or {}).get("unit") or {}).get("score")})
    return out


def _rows(doc, ours=None, keep=None):
    ours = ours or {}
    rows = []
    for x in doc.get("rows") or []:
        if keep is not None and not keep(x):
            continue
        dnl = x.get("our_outdoor_dnl")
        if dnl is None and x.get("address") in ours:
            dnl = ours[x["address"]]["outdoor_dnl"]
        site = (doc.get("sites") or {}).get(x.get("site")) or {}
        rows.append({"address": x.get("id") or x["address"], "group": x.get("address"), "our_dnl": dnl,
                     "theirs": x.get("score"), "higher_is_quieter": site.get("higher_is_quieter", True),
                     "gap_site": x.get("site") in GAP_SITES})
    return rows


def evaluate_lookups(doc, a=None, ours=None):
    """Evaluate a lookups document under the rules, plus two diagnostic subsets of the distance points.

    Rows that carry `our_outdoor_dnl` use it; other rows take our DNL from `ours` ({address: {"outdoor_dnl"}}).
    """
    a = a or Assumptions.load()
    # Separate addresses carry the test. Distance points near one building are diagnostics (roles_note).
    ev = evaluate(_rows(doc, ours, lambda x: x.get("distance_m") is None), a)
    every = evaluate(_rows(doc, ours), a)
    near = evaluate(_rows(doc, ours, lambda x: x.get("distance_m") is not None and x["distance_m"] <= 160), a)
    allp = evaluate(_rows(doc, ours, lambda x: x.get("distance_m") is not None), a)
    keys = ("compared", "rank_correlation", "median_gap", "max_gap", "max_gap_at")
    ev["diagnostics"] = {
        "note": "Subsets of the distance points, for reading the result. Gaps use the diagnostic line, which was "
                "fitted to the eight points within 160 m, so small gaps there are partly by construction.",
        "within_160_m": {k: near[k] for k in keys},
        "all_distance_points": {k: allp[k] for k in keys},
        "every_row": {k: every[k] for k in keys},
    }
    return ev


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m noisemodel.crosscheck", description=__doc__.split("\n")[0])
    ap.add_argument("--lookups", help="published scores entered by hand", default=LOOKUPS)
    args = ap.parse_args(argv)
    ours = our_levels()
    with open(args.lookups) as fh:
        lookups = json.load(fh)
    ev = evaluate_lookups(lookups, ours={o["address"]: o for o in ours})
    json.dump({"ours": ours, "evaluation": ev, "first_line": first_line(ev["status"], ev["reasons"])},
              sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
