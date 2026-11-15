"""Composite exterior wall (wall, windows, doors, leaks) and the wall-to-room step.

SOUND_MODEL.md 3.4 with V1 4b (leak area capped per wall) and 5c (openings larger than the wall are
clamped, with a warning). R3 E1 to E3.
"""
import math

ERAS = ("before_1960", "1960_1979", "1980_1999", "2000_on")


def sabine(volume_m3, a, reverberation_time=None):
    """Absorption area A = 0.161 V / T, m2 (R4 E1)."""
    t = reverberation_time if reverberation_time is not None else a.value("rooms.reverberation_time")
    return a.value("rooms.sabine_constant") * volume_m3 / t


def incidence_constant(a, mode="ambient", angle_deg=None):
    """C in L_room = L_ff + C - R + 10 log(S/A): +3 random incidence, or 6 + 10 log cos(theta) (R3 E1)."""
    if mode == "ambient":
        return float(a.value("facade.incidence_constant"))
    if mode == "speaker":
        if angle_deg is None or not 0.0 <= float(angle_deg) < 90.0:
            raise ValueError("speaker_angle_deg must be from 0 up to (not including) 90 degrees")
        return a.value("field_test.speaker_constant") + 10.0 * math.log10(math.cos(math.radians(float(angle_deg))))
    raise ValueError("unknown incidence mode %r" % mode)


def era_from_year(year):
    if year is None:
        return None
    year = int(year)
    if year < 1960:
        return "before_1960"
    if year < 1980:
        return "1960_1979"
    if year < 2000:
        return "1980_1999"
    return "2000_on"


def era_types(a, era, upper_floor=False):
    """Wall type, window type and leak key for an era (SOUND_MODEL.md section 4)."""
    d = a.value("era_defaults." + era)
    wall = d.get("upper_floor_wall") if (upper_floor and d.get("upper_floor_wall")) else d["wall"]
    return wall, d["window"], d["leak"]


def era_ratings(a, era, upper_floor=False):
    """(wall OITC, window OITC, leak fraction) for an era."""
    wall, window, leak = era_types(a, era, upper_floor)
    return float(a.value("walls." + wall)), float(a.value("windows." + window)), float(a.value("leak_fraction." + leak))


def wall_transmission(wall_area, wall_r, openings, a):
    """Transmission area T_w (m2) of one exterior wall, split by path.

    openings: [{"kind": "window" | "door", "area": m2, "R": dB, "leak_fraction": f}]
    Leak area = sum f_k S_k, scaled down when the openings exceed the cap fraction of the wall (V1 4b).
    """
    warnings = []
    total_open = sum(o["area"] for o in openings)
    scale = 1.0
    if total_open > wall_area:
        warnings.append("Openings of %.2f m2 are larger than the wall (%.2f m2); clamped to the wall area (V1 5c)."
                        % (total_open, wall_area))
        scale = wall_area / total_open
    parts = {"wall": max(0.0, wall_area - total_open * scale) * 10.0 ** (-wall_r / 10.0),
             "window": 0.0, "door": 0.0, "leak": 0.0}
    cap = a.value("facade.leak_area_cap_fraction") * wall_area
    open_area = total_open * scale
    leak_scale = min(1.0, cap / open_area) if open_area > 0 else 1.0
    for o in openings:
        s = o["area"] * scale
        parts[o["kind"]] += s * 10.0 ** (-o["R"] / 10.0)
        parts["leak"] += o["leak_fraction"] * s * leak_scale
    return {"total": sum(parts.values()), "parts": parts, "warnings": warnings}
