"""Quiet Score: one number from 0 to 100 per room and per unit (docs/UNIT_PROFILE_PLAN.md section 6).

Computed from a `noisemodel` result only. The eight-band room balance in web/server/ never enters it
(AGENTS.md: the two room estimates are alternatives). Every number is in assumptions.yaml under score.*.

- Bedrooms use the overnight level (00-06): 100 at score.bedroom_night_anchors.silent or below, 0 at
  very_loud or above, linear between. Other rooms use DNL with score.daily_anchors.
- Unit: score.unit_weights of the lowest-scoring bedroom and the main (largest) living room; with only one
  of the two kinds present, that room alone.
- Range: the score at the top and bottom of the room's level range. A level the model reports as below
  15 dBA (null) is scored at 15 dBA, which is under every anchor, so it scores 100.

It is an indoor score for one unit. Published sound scores rate the location outdoors. No outdoor 0 to 100
score is computed (interim decision 1, plan section 6a): the outdoor level stays in dB (outdoor_dnl) and is
compared with published scores by rank; see docs/SCORE_CROSSCHECK.md.

Limit (interim decision 2): the model counts only the roads it is given, so a unit far from any counted road
gets an outdoor level that is too low and a Quiet Score that is too generous.
"""
from . import db
from .assumptions import Assumptions

NOTE = ("An indoor score for this unit, from the noise model's room levels. Published sound scores "
        "(for example Apartments.com) rate the location outdoors, so the two differ for good reasons.")
ROAD_LIMIT = ("The model counts only the roads it is given. A unit far from any counted road gets an outdoor "
              "level that is too low and a Quiet Score that is too generous (no background traffic is added).")


def linear(level, anchors):
    """0 to 100, higher is quieter. level None means below the model's 15 dBA floor (scores as 15 dBA)."""
    silent, loud = float(anchors["silent"]), float(anchors["very_loud"])
    x = 15.0 if level is None else float(level)
    s = 100.0 * (loud - x) / (loud - silent)
    return max(0.0, min(100.0, s))


def _anchors(a):
    return a.value("score.bedroom_night_anchors"), a.value("score.daily_anchors")


def room_score(room, a=None, range_db=None):
    """Score of one room of a levels.json result. range_db overrides the room's own range_db."""
    a = a or Assumptions.load()
    night, daily = _anchors(a)
    bedroom = room.get("type") == "bedroom"
    level = room["night_dba"] if bedroom else room["dnl_dba"]
    anchors = night if bedroom else daily
    rng = float(room["range_db"] if range_db is None else range_db)
    base = 15.0 if level is None else float(level)
    return {
        "id": room["id"], "name": room.get("name"), "type": room.get("type"),
        "score": round(linear(level, anchors), 1),
        "range": [round(linear(base + rng, anchors), 1), round(linear(None if level is None else base - rng, anchors), 1)],
        "level_db": level, "level_kind": "overnight LAeq (00-06)" if bedroom else "DNL",
        "level_range_db": rng,
    }


def score(result, a=None, ranges=None, areas=None):
    """{"unit": {...}, "rooms": {id: {...}}} from a levels.json result.

    ranges: optional {room id: plus or minus dB} (the profile's range rule, plan section 4).
    areas: optional {room id: floor area m2}, to pick the main living room (else the first living room).
    """
    a = a or Assumptions.load()
    ranges = ranges or {}
    areas = areas or {}
    rooms = {r["id"]: room_score(r, a, ranges.get(r["id"])) for r in result["rooms"]}
    bedrooms = [rooms[r["id"]] for r in result["rooms"] if r.get("type") == "bedroom"]
    living = [r for r in result["rooms"] if r.get("type") == "living"]
    main_living = None
    if living:
        main_living = rooms[max(living, key=lambda r: areas.get(r["id"], 0.0))["id"]]
    worst_bed = min(bedrooms, key=lambda r: r["score"]) if bedrooms else None
    w = a.value("score.unit_weights")
    if worst_bed and main_living:
        parts = [(worst_bed, float(w["bedroom"])), (main_living, float(w["living"]))]
    elif worst_bed:
        parts = [(worst_bed, 1.0)]
    elif main_living:
        parts = [(main_living, 1.0)]
    else:
        parts = []
    total = sum(x for _, x in parts)
    unit = None
    if parts:
        unit = {
            "score": round(sum(r["score"] * x for r, x in parts) / total, 1),
            "range": [round(sum(r["range"][i] * x for r, x in parts) / total, 1) for i in (0, 1)],
            "from": [{"room": r["id"], "name": r["name"], "weight": round(x / total, 3)} for r, x in parts],
        }
    return {"unit": unit, "rooms": rooms, "note": NOTE, "limits": [ROAD_LIMIT],
            "method": "noisemodel broadband room levels only; the eight-band room balance is not used"}


def outdoor_dnl(result):
    """Outdoor free-field DNL at the building, every mode energy-summed (DNL is linear in hourly energy)."""
    vals = [v.get("dnl_dba") for v in (result.get("outdoor_free_field") or {}).values()]
    return db.energy_sum([v for v in vals if v is not None]) if any(v is not None for v in vals) else None
