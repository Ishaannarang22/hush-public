"""Outdoor level at each exterior wall, per source mode, for each of the 24 hours.

Road: R7 (TNM REMELs inside the FHWA-RD-77-108 closed form, segment by segment, D clamped at 15 m),
spread over the day with the R9 hourly shares and R9 truck shares by period.
Aircraft: R8 (closest point of approach, ANP 737-800 fallback NPD table, Doc 29 corrections).
Simple form: one BTS 24-hour level per mode, split by an hourly profile.
Shielding (road, rail, construction only): SOUND_MODEL.md 3.3 with V1 2a (orientation or rows, never
both; total capped at 25 dB) and 5d (rail uses the nearest rail line, construction the site bearing).
"""
import math
from datetime import datetime

from . import db

MODES = ("road", "rail", "aircraft", "construction", "mechanical")
VEHICLE_CLASSES = ("auto", "medium_truck", "heavy_truck")
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LON_EQUATOR = 111320.0
FT_PER_M = 1.0 / 0.3048


# ---------------------------------------------------------------- time of day

def night_hours(a):
    start, end = a.value("time.dnl_night_hours")
    return {h for h in range(24) if h >= start or h < end}


def hourly_shares(profile, a):
    """24 fractions of daily energy (or vehicles), summing to 1."""
    if profile in ("arterial", "freeway"):
        raw = [float(x) for x in a.value("time.hourly_share." + profile)]
        total = sum(raw)
        return [x / total for x in raw]
    if profile in ("hud_road", "aviation"):
        f = a.value("time.night_share." + ("road" if profile == "hud_road" else "aviation"))
        nights = night_hours(a)
        n = len(nights)
        return [f / n if h in nights else (1.0 - f) / (24 - n) for h in range(24)]
    if profile == "rail":
        d = a.value("time.rail_day_share")
        return [d / 12.0 if 6 <= h < 18 else (1.0 - d) / 12.0 for h in range(24)]
    if profile == "flat":
        return [1.0 / 24.0] * 24
    raise ValueError("unknown hourly profile %r" % profile)


def hourly_levels(l24, shares):
    """Hourly levels whose energy mean is l24 (SOUND_MODEL.md 3.2, R9 E1)."""
    return [None if s <= 0 else l24 + 10.0 * math.log10(s * 24.0) for s in shares]


def block_hours(a):
    return {b: list(range(lo, hi)) for b, (lo, hi) in a.value("time.blocks").items()}


def block_levels(hourly, a):
    """Each block is the energy mean of its hours (V1 5a)."""
    return {b: db.energy_mean([hourly[h] for h in hours]) for b, hours in block_hours(a).items()}


def dnl(hourly, a):
    """DNL from the 24 hourly values with the night penalty (V1 5a)."""
    penalty = a.value("time.dnl_night_penalty")
    nights = night_hours(a)
    vals = [None if hourly[h] is None else hourly[h] + (penalty if h in nights else 0.0) for h in range(24)]
    return db.energy_mean(vals)


# ---------------------------------------------------------------- geometry

def project(lon, lat, lat0, lon0):
    """Local metres east and north of (lat0, lon0) (R5 small-area constants)."""
    x = (lon - lon0) * M_PER_DEG_LON_EQUATOR * math.cos(math.radians(lat0))
    y = (lat - lat0) * M_PER_DEG_LAT
    return (x, y)


def bearing_deg(dx, dy):
    return math.degrees(math.atan2(dx, dy)) % 360.0


def angle_between(az1, az2):
    return abs((az1 - az2 + 180.0) % 360.0 - 180.0)


def nearest_point(poly, p):
    best = None
    for (ax, ay), (bx, by) in zip(poly[:-1], poly[1:]):
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L2))
        q = (ax + t * vx, ay + t * vy)
        d = math.hypot(q[0] - p[0], q[1] - p[1])
        if best is None or d < best[0]:
            best = (d, q)
    return best


def _polyline(geometry, origin):
    return [project(pt[0], pt[1], origin[0], origin[1]) for pt in geometry]


def _segment_intersection(p, r, q, s):
    """Fraction t along p + t*r where it crosses segment q + u*s, or None."""
    cross = r[0] * s[1] - r[1] * s[0]
    if abs(cross) < 1e-12:
        return None
    qp = (q[0] - p[0], q[1] - p[1])
    t = (qp[0] * s[1] - qp[1] * s[0]) / cross
    u = (qp[0] * r[1] - qp[1] * r[0]) / cross
    if 0.0 < t < 1.0 and 0.0 <= u <= 1.0:
        return t
    return None


# ---------------------------------------------------------------- road emission (R7)

def remel(vehicle_class, speed_kmh, a, model=None):
    """Reference energy mean emission level at 15 m, dBA (R7 E3)."""
    model = model or a.value("road.emission_model")
    if model == "tnm":
        A, B, C = a.value("road.remel_tnm")[vehicle_class]
        return 10.0 * math.log10((0.6214 * speed_kmh) ** (A / 10.0) * 10.0 ** (B / 10.0) + 10.0 ** (C / 10.0))
    if model == "rd77":
        k, c = a.value("road.remel_rd77")[vehicle_class]
        return k * math.log10(speed_kmh) + c
    raise ValueError("unknown emission model %r" % model)


def _psi(phi1, phi2, soft, a):
    if phi2 <= phi1:
        return 0.0
    if not soft:
        return phi2 - phi1
    steps = int(a.value("road.segment_integration_steps"))
    h = (phi2 - phi1) / steps
    return h * sum(math.sqrt(max(0.0, math.cos(phi1 + (k + 0.5) * h))) for k in range(steps))


def segment_term(phi1, phi2, soft, a):
    """10*log10(Psi/pi), the finite-segment adjustment (R7 E5)."""
    return db.level(_psi(phi1, phi2, soft, a) / math.pi)


def class_leq(l0, vehicles_per_hour, speed_kmh, distance_m, phi1, phi2, soft, a):
    """Hourly Leq of one vehicle class from one straight segment (R7 E1, no shielding)."""
    d0 = a.value("road.reference_distance")
    alpha = a.value("road.alpha")["soft" if soft else "hard"]
    if vehicles_per_hour <= 0:
        return None
    seg = segment_term(phi1, phi2, soft, a)
    if seg is None:
        return None
    return (l0 + 10.0 * math.log10(vehicles_per_hour * d0 / speed_kmh) + a.value("road.flow_constant")
            + 10.0 * (1.0 + alpha) * math.log10(d0 / distance_m) + seg)


def _ground_soft(road, a):
    ground = road.get("ground") or a.value("road.ground_default")
    return ground == "soft"


def road_geometry_factor(road, rx, origin, a):
    """G = sum over pieces of (D0/D)^(1+alpha) * Psi/pi, so that Leq = emission + flow + 10*log10(G) (R7 E6)."""
    soft = _ground_soft(road, a)
    alpha = a.value("road.alpha")["soft" if soft else "hard"]
    d0 = a.value("road.reference_distance")
    dmin = a.value("road.min_distance")
    dang = a.value("road.min_angle_distance")
    poly = _polyline(road["geometry"], origin)
    g = 0.0
    clamped = False
    for (ax, ay), (bx, by) in zip(poly[:-1], poly[1:]):
        L = math.hypot(bx - ax, by - ay)
        if L == 0:
            continue
        ux, uy = (bx - ax) / L, (by - ay) / L
        ta = (ax - rx[0]) * ux + (ay - rx[1]) * uy
        tb = (bx - rx[0]) * ux + (by - rx[1]) * uy
        d = abs((ax - rx[0]) * uy - (ay - rx[1]) * ux)
        phis = sorted((math.atan2(ta, max(d, dang)), math.atan2(tb, max(d, dang))))
        if d < dmin:
            clamped = True
        g += (d0 / max(d, dmin)) ** (1.0 + alpha) * _psi(phis[0], phis[1], soft, a) / math.pi
    near = nearest_point(poly, rx)
    return g, {"distance_m": near[0], "nearest": near[1], "clamped": clamped, "soft": soft}


def road_daily_classes(road, a):
    """Vehicles per day by class (R7 E7: own single-unit and combination counts first)."""
    aadt = float(road["aadt"])
    mt, ht = road.get("medium_trucks_per_day"), road.get("heavy_trucks_per_day")
    if mt is None or ht is None:
        trucks = aadt * float(road.get("truck_share") or 0.0)
        cls = road.get("road_class") or "arterial"
        m = a.value("road.medium_truck_share_of_trucks").get(cls, a.value("road.medium_truck_share_of_trucks")["other"])
        mt, ht = trucks * m, trucks * (1.0 - m)
    return {"auto": aadt - mt - ht, "medium_truck": float(mt), "heavy_truck": float(ht)}


def _truck_period_of_hour(a):
    periods = a.value("time.truck_periods")
    out = {}
    for name, (lo, hi) in periods.items():
        hours = range(lo, hi) if lo < hi else list(range(lo, 24)) + list(range(0, hi))
        for h in hours:
            out[h] = name
    return out


def road_hourly_volumes(road, a):
    """24 dicts of vehicles per hour by class: daily count times R9 share; trucks follow the R9 truck profile."""
    profile = "freeway" if road.get("road_class") == "freeway" else "arterial"
    shares = hourly_shares(profile, a)
    daily = road_daily_classes(road, a)
    truck_table = a.value("time.truck_share_by_period." + profile)
    period = _truck_period_of_hour(a)
    weights = {}
    for cls, key in (("medium_truck", "single_unit"), ("heavy_truck", "combination")):
        w = [shares[h] * truck_table[key][period[h]] for h in range(24)]
        tot = sum(w)
        weights[cls] = [x / tot for x in w]
    aadt = float(road["aadt"])
    out = []
    for h in range(24):
        mt = daily["medium_truck"] * weights["medium_truck"][h]
        ht = daily["heavy_truck"] * weights["heavy_truck"][h]
        out.append({"auto": max(0.0, aadt * shares[h] - mt - ht), "medium_truck": mt, "heavy_truck": ht})
    return out


def _road_level(volumes_per_hour, speed, g, a):
    d0 = a.value("road.reference_distance")
    flow = a.value("road.flow_constant")
    e = 0.0
    for cls in VEHICLE_CLASSES:
        n = volumes_per_hour[cls]
        if n > 0:
            e += db.energy(remel(cls, speed, a) + 10.0 * math.log10(n * d0 / speed) + flow)
    return db.level(e * g)


def road_hourly(road, rx, origin, a):
    """Free-field road level at the receiver for each hour (no shielding)."""
    g, _ = road_geometry_factor(road, rx, origin, a)
    speed = float(road["speed_kmh"])
    return [_road_level(v, speed, g, a) for v in road_hourly_volumes(road, a)]


def road_l24(road, rx, origin, a):
    """24-hour level from daily counts (R7 E4: -25 - 10*log10(24))."""
    g, _ = road_geometry_factor(road, rx, origin, a)
    daily = road_daily_classes(road, a)
    level = _road_level(daily, float(road["speed_kmh"]), g, a)
    return None if level is None else level - 10.0 * math.log10(24.0)


# ---------------------------------------------------------------- shielding (R2, V1 2a)

def orientation_loss(alpha_deg, a):
    back = a.value("propagation.orientation.back_wall_loss")
    if alpha_deg >= 180.0:
        return float(back)
    return min(10.0 * math.log10(180.0 / (180.0 - alpha_deg)), float(back))


def barrier_loss(delta_m, a):
    """FHWA Kurze-Anderson barrier loss at 550 Hz, walls only (berms dropped, V1 2b)."""
    n = a.value("propagation.barrier.fresnel_factor") * delta_m
    n_lower = a.value("propagation.barrier.n_lower")
    n_cap = a.value("propagation.barrier.n_cap")
    cap = float(a.value("propagation.barrier.cap_wall"))
    if n <= n_lower:
        return 0.0
    if n >= n_cap:
        return cap
    if n == 0:
        return 5.0
    x = math.sqrt(2.0 * math.pi * abs(n))
    if n < 0:
        return 5.0 + 20.0 * math.log10(x / math.tan(x))
    return min(cap, 5.0 + 20.0 * math.log10(x / math.tanh(x)))


def foliage_loss(r_f, a):
    f = "propagation.foliage."
    if r_f < a.value(f + "min_path"):
        return 0.0
    if r_f < 20.0:
        return float(a.value(f + "short_path_loss"))
    if r_f <= a.value(f + "max_path"):
        return a.value(f + "rate") * r_f
    return float(a.value(f + "cap"))


def rows_loss(rows, a):
    if not rows:
        return 0.0
    k = "propagation.building_rows."
    frac = float(rows.get("first_row_built_fraction") or 0.0)
    if frac >= 0.65:
        first = a.value(k + "first_row_65_90pct")
    elif frac >= 0.40:
        first = a.value(k + "first_row_40_65pct")
    else:
        first = a.value(k + "first_row_under_40pct")
    return float(first) + a.value(k + "each_further_row") * float(rows.get("further_rows") or 0)


def wall_shielding(alpha_deg, barrier_db, foliage_db, rows_db, a):
    """Combine the four terms on one wall with every cap (V1 2a). Returns the applied terms."""
    orient = 0.0 if rows_db > 0 else orientation_loss(alpha_deg, a)
    rows = min(rows_db, a.value("propagation.building_rows.trees_plus_rows_cap"))
    foliage = min(foliage_db, a.value("propagation.building_rows.trees_plus_rows_cap") - rows)
    foliage = max(0.0, min(foliage, a.value("propagation.barrier.plus_foliage_cap") - barrier_db))
    barrier = barrier_db
    excess = orient + barrier + foliage + rows - a.value("propagation.shielding_total_cap")
    terms = {"foliage": foliage, "orientation": orient, "rows": rows, "barrier": barrier}
    for name in ("foliage", "orientation", "rows", "barrier"):
        if excess <= 0:
            break
        cut = min(excess, terms[name])
        terms[name] -= cut
        excess -= cut
    terms["total"] = terms["orientation"] + terms["barrier"] + terms["foliage"] + terms["rows"]
    return terms


def barrier_delta(barrier, ray_end, rx, receiver_height, origin, a):
    """Path difference over a recorded barrier on the ray from the receiver to the source point."""
    if barrier.get("path_difference_m") is not None:
        return float(barrier["path_difference_m"])
    poly = _polyline(barrier["geometry"], origin)
    r = (ray_end[0] - rx[0], ray_end[1] - rx[1])
    d = math.hypot(*r)
    for q0, q1 in zip(poly[:-1], poly[1:]):
        t = _segment_intersection(rx, r, q0, (q1[0] - q0[0], q1[1] - q0[1]))
        if t is None:
            continue
        hb = float(barrier["height_m"])
        hs = a.value("propagation.barrier.source_height")
        b_dist, a_dist = t * d, (1.0 - t) * d
        return (math.hypot(a_dist, hb - hs) + math.hypot(b_dist, hb - receiver_height)
                - math.hypot(d, receiver_height - hs))
    return None


# ---------------------------------------------------------------- construction (R1 E3)

def construction_hourly(site, distance_m, a):
    ref_ft = a.value("outdoor.construction.reference_distance")
    d_ft = max(distance_m * FT_PER_M, 1.0)
    e = 0.0
    for name in site.get("equipment") or []:
        eq = a.value("outdoor.construction.equipment." + name)
        lmax50 = eq["actual"] if eq.get("actual") is not None else eq["spec"]
        e += db.energy(lmax50 - 20.0 * math.log10(d_ft / ref_ft) + 10.0 * math.log10(eq["usage"]))
    leq = db.level(e)
    lo, hi = a.value("outdoor.construction.allowed_hours")
    a.value("outdoor.construction.hours_worked")
    active = set()
    for b in site.get("active_blocks") or []:
        active.update(block_hours(a)[b])
    return [leq if (h in active and lo <= h < hi) else None for h in range(24)]


# ---------------------------------------------------------------- aircraft (R8)

def _interp_log(distances_ft, values, d_ft):
    lg = [math.log10(x) for x in distances_ft]
    x = math.log10(d_ft)
    if x <= lg[0]:
        i = 0
    elif x >= lg[-1]:
        i = len(lg) - 2
    else:
        i = max(k for k in range(len(lg) - 1) if lg[k] <= x)
    return values[i] + (values[i + 1] - values[i]) * (x - lg[i]) / (lg[i + 1] - lg[i])


def lateral_attenuation(l_m, beta_deg, a):
    k = a.value("aircraft.lateral_attenuation")
    gamma = 1.0 if l_m > k["gamma_max_l_m"] else k["gamma_a"] * (1.0 - math.exp(-k["gamma_k"] * l_m))
    if beta_deg > k["lambda_max_beta_deg"]:
        lam = 0.0
    else:
        lam = k["lambda_a"] - k["lambda_b"] * beta_deg + k["lambda_c"] * math.exp(-k["lambda_k"] * beta_deg)
    return gamma * lam


def aircraft_event(flight, rx, receiver_height, origin, a, warnings):
    """SEL and LAmax at the receiver from the closest point of approach (R8 E1, E2, E4)."""
    pts = [(project(p[0], p[1], origin[0], origin[1]), float(p[2])) for p in flight["track"]]
    best = None
    for (p0, z0), (p1, z1) in zip(pts[:-1], pts[1:]):
        v = (p1[0] - p0[0], p1[1] - p0[1], z1 - z0)
        w = (rx[0] - p0[0], rx[1] - p0[1], receiver_height - z0)
        vv = v[0] ** 2 + v[1] ** 2 + v[2] ** 2
        t = 0.0 if vv == 0 else max(0.0, min(1.0, (w[0] * v[0] + w[1] * v[1] + w[2] * v[2]) / vv))
        c = (p0[0] + t * v[0], p0[1] + t * v[1], z0 + t * v[2])
        d = math.sqrt((c[0] - rx[0]) ** 2 + (c[1] - rx[1]) ** 2 + (c[2] - receiver_height) ** 2)
        if best is None or d < best[0]:
            best = (d, c)
    slant_m = max(best[0], a.value("aircraft.min_slant_distance_m"))
    cpa = best[1]
    lateral = math.hypot(cpa[0] - rx[0], cpa[1] - rx[1])
    height = cpa[2] - receiver_height
    beta = math.degrees(math.atan2(height, lateral)) if lateral > 0 else 90.0
    climbing = pts[-1][1] > pts[0][1]
    if not climbing:
        phase, op = "arrival", "arrival"
    elif cpa[2] * FT_PER_M < a.value("aircraft.climb_phase_above_ft"):
        phase, op = "takeoff", "departure"
    else:
        phase, op = "climb", "departure"
    table = a.value("aircraft.npd_fallback_737_800")
    d_ft = slant_m * FT_PER_M
    sel = _interp_log(table["distances_ft"], table[phase]["sel"], d_ft)
    lamax = _interp_log(table["distances_ft"], table[phase]["lamax"], d_ft)
    offset = 0.0
    code = flight.get("aircraft_type")
    subs = a.value("aircraft.substitution_offsets")
    if code in subs:
        offset = subs[code][op]
    elif code:
        warnings.append("Aircraft type %s has no 737-800-proxy offset; the 737-800 fallback table is used "
                        "with 0 dB (R8 E4)." % code)
    lat = lateral_attenuation(lateral, max(beta, 0.0), a)
    v = flight.get("groundspeed_kt")
    speed = 10.0 * math.log10(a.value("aircraft.reference_speed_kt") / float(v)) if v else 0.0
    return {"sel": sel + speed - lat + offset, "lamax": lamax - lat + offset, "slant_m": slant_m, "phase": phase}


def flight_hour(flight, warnings):
    stamp = str(flight["time"])
    if stamp.endswith("Z"):
        stamp = stamp[:-1] + "+00:00"
        warnings.append("A flight time is in UTC; its local hour is taken as the UTC hour.")
    return datetime.fromisoformat(stamp).hour


def aircraft_hourly(flights, rx, receiver_height, origin, a, warnings):
    """Hourly Leq from summed event exposure (R8 E3, T = 3600 s) and the loudest LAmax in each hour."""
    exposure = [0.0] * 24
    peak = [None] * 24
    seen = set()
    for fl in flights:
        local = []
        ev = aircraft_event(fl, rx, receiver_height, origin, a, local)
        for w in local:
            if w not in seen:
                seen.add(w)
                warnings.append(w)
        h = flight_hour(fl, warnings)
        exposure[h] += db.energy(ev["sel"])
        peak[h] = ev["lamax"] if peak[h] is None else max(peak[h], ev["lamax"])
    return [db.level(e / 3600.0) for e in exposure], peak


# ---------------------------------------------------------------- per wall

def _floor_check(name, value, a, warnings):
    """A BTS pixel at the floor means '45 or less': treat the mode as absent (R1 E4)."""
    if value is None:
        return None
    floor = a.value("outdoor.bts.floor")
    if value <= floor:
        warnings.append("BTS %s value %.1f dBA is at the %.0f dBA map floor ('%.0f or less'); %s is treated "
                        "as absent." % (name, value, floor, floor, name))
        return None
    return float(value)


class _Path(object):
    """A shielded source (road, rail line or construction site) seen from the receiver."""

    def __init__(self, mode, hourly, bearing, distance):
        self.mode, self.hourly, self.bearing, self.distance = mode, hourly, bearing, distance


def _sum_hourly(series):
    return [db.energy_sum([s[h] for s in series]) for h in range(24)]


def wall_levels(walls, sources, receiver_height, origin, a, warnings):
    """Outdoor level at every wall, per mode, per hour.

    walls: [{"id", "azimuth"}] with the north offset applied. The receiver is the origin (facade point).
    Returns (levels {wall: {mode: [24]}}, info {wall: {...}}, aircraft peaks [24] or None, checks,
    free-field levels at the receiver {mode: [24]}).
    """
    rx = (0.0, 0.0)
    out = sources.get("outdoor_levels_dba") or {}
    paths = []
    free_field = {}
    checks = {}

    roads = [r for r in sources.get("roads") or [] if r.get("aadt")]
    if roads:
        detailed = []
        for road in roads:
            _, geo = road_geometry_factor(road, rx, origin, a)
            if geo["clamped"]:
                warnings.append("Road %s is closer than %.0f m to the facade point; the distance term is clamped "
                                "at %.0f m (R7 E6, placeholder)." % (road["id"], a.value("road.min_distance"),
                                                                     a.value("road.min_distance")))
            hourly = road_hourly(road, rx, origin, a)
            paths.append(_Path("road", hourly, bearing_deg(*geo["nearest"]), geo["distance_m"]))
            detailed.append(road_l24(road, rx, origin, a))
        free_field["road"] = _sum_hourly([p.hourly for p in paths if p.mode == "road"])
        bts = out.get("road")
        if bts is not None:
            l24 = db.energy_sum(detailed)
            checks = {"road_detailed_l24_dba": l24, "road_bts_dba": bts, "road_detailed_minus_bts_db": l24 - bts}
    else:
        level = _floor_check("road", out.get("road"), a, warnings)
        if level is not None:
            profile = out.get("road_profile") or "arterial"
            hourly = hourly_levels(level, hourly_shares("hud_road" if profile == "hud" else profile, a))
            free_field["road"] = hourly
            paths.append(_Path("road", hourly, out.get("road_bearing_deg"), out.get("road_distance_m")))

    level = _floor_check("rail", out.get("rail"), a, warnings)
    if level is not None:
        hourly = hourly_levels(level, hourly_shares("rail", a))
        free_field["rail"] = hourly
        bearing, distance = out.get("rail_bearing_deg"), out.get("rail_distance_m")
        lines = [_polyline(r["geometry"], origin) for r in sources.get("rail") or []]
        if lines:
            near = min((nearest_point(p, rx) for p in lines), key=lambda x: x[0])
            bearing, distance = bearing_deg(*near[1]), near[0]
        paths.append(_Path("rail", hourly, bearing, distance))

    for site in sources.get("construction") or []:
        xy = project(site["lon"], site["lat"], origin[0], origin[1])
        dist = math.hypot(*xy)
        paths.append(_Path("construction", construction_hourly(site, dist, a), bearing_deg(*xy), dist))
    if any(p.mode == "construction" for p in paths):
        free_field["construction"] = _sum_hourly([p.hourly for p in paths if p.mode == "construction"])

    for machine in sources.get("mechanical") or []:
        xy = project(machine["lon"], machine["lat"], origin[0], origin[1])
        ground_distance = math.hypot(*xy)
        height = float(machine.get("height_m", 1.5))
        level = float(machine["level_at_1m_dba"])
        duty = float(machine.get("duty_fraction", 1.0))
        if not all(math.isfinite(v) for v in (*xy, height, level, duty)) or not 0 <= duty <= 1 or not -120 <= level <= 200:
            raise ValueError("Mechanical levels and heights must be finite; duty_fraction must be 0–1")
        if not machine.get("evidence"):
            raise ValueError("Mechanical source evidence is required")
        distance = max(1.0, math.hypot(ground_distance, height-receiver_height))
        at_receiver = None if duty == 0 else level - 20*math.log10(distance) + 10*math.log10(duty)
        active = machine.get("active_blocks", list(block_hours(a)))
        if not isinstance(active, list) or any(b not in block_hours(a) for b in active):
            raise ValueError("Unknown mechanical operating time block")
        active_hours = {h for name in active for h in block_hours(a)[name]}
        hourly = [at_receiver if h in active_hours else None for h in range(24)]
        paths.append(_Path("mechanical", hourly, bearing_deg(*xy), ground_distance))
    if any(p.mode == "mechanical" for p in paths):
        free_field["mechanical"] = _sum_hourly([p.hourly for p in paths if p.mode == "mechanical"])

    aircraft, peak = None, None
    flights = sources.get("flights") or []
    if flights:
        aircraft, peak = aircraft_hourly(flights, rx, receiver_height, origin, a, warnings)
    else:
        level = _floor_check("aviation", out.get("aviation"), a, warnings)
        if level is not None:
            aircraft = hourly_levels(level, hourly_shares("aviation", a))
    if aircraft is not None:
        free_field["aircraft"] = aircraft

    if not free_field:
        warnings.append("No source is above the 45 dBA mapped floor outdoors (or none was given), so indoor "
                        "levels are null (V1 5b). For an upper bound, run each mode at 45 dBA.")

    tree = (sources.get("tree_cover") or {}).get("fraction")
    rows_db = rows_loss(sources.get("building_rows"), a)
    barriers = sources.get("barriers") or []
    max_tree_path = a.value("propagation.foliage.max_tree_path_from_road") if tree else None
    if tree:
        a.value("propagation.foliage.tree_cover_input")
    for p in paths:
        if p.bearing is None:
            warnings.append("No bearing to the %s source is known; no orientation loss is applied to it." % p.mode)

    levels, info = {}, {}
    for w in walls:
        per_mode = {}
        dominant = None
        for p in paths:
            alpha = angle_between(w["azimuth"], p.bearing) if p.bearing is not None else 0.0
            end = None
            if p.bearing is not None and p.distance is not None:
                end = (math.sin(math.radians(p.bearing)) * p.distance, math.cos(math.radians(p.bearing)) * p.distance)
            barrier_db = 0.0
            for b in barriers:
                delta = barrier_delta(b, end, rx, receiver_height, origin, a) if (
                    end is not None or b.get("path_difference_m") is not None) else None
                if delta is not None:
                    barrier_db = max(barrier_db, barrier_loss(delta, a))
            foliage_db = 0.0
            if tree:
                reach = min(p.distance, max_tree_path) if p.distance is not None else max_tree_path
                foliage_db = foliage_loss(float(tree) * reach, a)
            terms = wall_shielding(alpha, barrier_db, foliage_db, rows_db, a)
            terms["alpha"] = alpha if p.bearing is not None else None
            terms["distance"] = p.distance
            shielded = [None if x is None else x - terms["total"] for x in p.hourly]
            prev = per_mode.get(p.mode)
            per_mode[p.mode] = shielded if prev is None else [db.energy_sum([x, y]) for x, y in zip(prev, shielded)]
            weight = db.energy_mean(shielded)
            if weight is not None and (dominant is None or weight > dominant[0]):
                dominant = (weight, p.mode, terms)
        if aircraft is not None:
            per_mode["aircraft"] = list(aircraft)
        levels[w["id"]] = per_mode
        info[w["id"]] = {"shielded_source": dominant[1] if dominant else None,
                         "terms": dominant[2] if dominant else None}
    return levels, info, peak, checks, free_field
