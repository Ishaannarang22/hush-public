"""Rooms, exterior walls and partitions of one property, and the coupled room-to-room solve.

SOUND_MODEL.md 3.4 and 3.5 (R4 E2 to E5): E = F + C E solved directly as (I - C) E = F. Open doorway
area is added to the absorption of both rooms; rooms joined with c_ij above the merge limit are merged.
"""
import numpy as np

from . import db, facade


def solve(F, C):
    """Solve (I - C) E = F for one or many right-hand sides."""
    C = np.asarray(C, dtype=float)
    return np.linalg.solve(np.eye(C.shape[0]) - C, np.asarray(F, dtype=float))


DERATING_KEY = {
    "stud_wall": "stud_wall", "stud_wall_insulated": "stud_wall",
    "wood_floor": "wood_floor", "wood_floor_insulated": "wood_floor",
    "concrete_4in": "concrete", "concrete_6in": "concrete",
}


class Building(object):
    """The rooms of one property, ready to receive outdoor levels wall by wall."""

    def __init__(self, prop, a, warnings, assumed):
        self.a = a
        self.warnings = warnings
        self.assumed = assumed
        self._era(prop)
        self._rooms(prop)
        self._walls(prop)
        self._other_walls(prop)
        self._partitions(prop)
        self._group()

    # ------------------------------------------------------------ inputs
    def _era(self, prop):
        a = self.a
        entry = prop.get("era")
        era = entry.get("value") if isinstance(entry, dict) else entry
        if era and isinstance(entry, dict) and entry.get("status") == "assumed":
            self.assumed.append({"input": "era", "value": era, "source": entry.get("source")})
        if not era:
            era = facade.era_from_year(prop.get("year_built"))
        if not era:
            era = a.value("facade.default_era_when_year_unknown")
            self.warnings.append("Year built is missing; the %s defaults are used "
                                 "(facade.default_era_when_year_unknown, placeholder)." % era)
            self.assumed.append({"input": "era", "value": era, "source": "facade.default_era_when_year_unknown"})
        self.era = era
        self.unit_floor = int(prop.get("unit_floor") or 1)
        self.storeys = int(prop.get("storeys") or self.unit_floor)
        self.upper_floor = self.unit_floor > 1
        self.top_floor = self.unit_floor >= self.storeys
        self.north_offset = float(prop.get("north_offset_deg") or 0.0)
        if prop.get("unit_floor_status") == "assumed":
            self.assumed.append({"input": "unit_floor", "value": self.unit_floor, "source": prop.get("unit_floor_source")})
        wall_type, window_type, leak = facade.era_types(a, era, self.upper_floor)
        self.era_wall_type, self.era_window_type, self.era_leak_key = wall_type, window_type, leak

    def _rooms(self, prop):
        a = self.a
        self.rooms = []
        for r in prop["rooms"]:
            height = r.get("height_m")
            if not height:
                height = a.value("rooms.height_default")
                self.warnings.append("Room %s has no height; the default %.1f m is used (rooms.height_default)."
                                     % (r["id"], height))
            elif r.get("height_status") == "assumed":
                self.assumed.append({"input": "height of room %s" % r["id"], "value": height,
                                     "source": "rooms.height_default (no height in the scan)"})
            volume = r.get("volume_m3") or float(r["area_m2"]) * float(height)
            self.rooms.append({"id": r["id"], "name": r.get("name") or r["id"], "type": r.get("type"),
                               "area": float(r["area_m2"]), "volume": float(volume)})
        self.index = {r["id"]: i for i, r in enumerate(self.rooms)}

    def _walls(self, prop):
        a = self.a
        self.walls = []
        for r in prop["rooms"]:
            for w in r.get("exterior_walls") or []:
                area = float(w["area_m2"])
                wall_type = w.get("wall_type") or self.era_wall_type
                win_area = w.get("window_area_m2")
                measured = win_area is not None and w.get("window_area_status") != "assumed"
                if win_area is None:
                    win_area = a.value("facade.window_fraction_default") * area
                    self.assumed.append({"input": "window area of %s" % w["id"], "value": round(win_area, 2),
                                         "source": "facade.window_fraction_default (15% rule)"})
                window_type = w.get("window_type") or self.era_window_type
                if w.get("window_leak_fraction") is not None:
                    f_win = float(w["window_leak_fraction"])
                elif w.get("window_fixed"):
                    f_win = a.value("leak_fraction.fixed_glazing")
                else:
                    f_win = a.value("leak_fraction." + self.era_leak_key)
                door_area = float(w.get("door_area_m2") or 0.0)
                door_type = w.get("door_type") or a.value("doors_exterior.default")
                if w.get("door_type_status") == "assumed":
                    self.assumed.append({"input": "door type of %s" % w["id"], "value": door_type,
                                         "source": w.get("source")})
                f_door = (float(w["door_leak_fraction"]) if w.get("door_leak_fraction") is not None
                          else a.value("leak_fraction." + self.era_leak_key))
                window_open = bool(w.get("window_open"))
                if window_open and (w.get("window_fixed") or win_area <= 0):
                    self.warnings.append("Wall %s has no operable window to open; it stays closed." % w["id"])
                    window_open = False
                self.walls.append({
                    "id": w["id"], "room": r["id"], "area": area,
                    "azimuth": (float(w["azimuth_deg"]) + self.north_offset) % 360.0,
                    "wall_r": float(a.value("walls." + wall_type)), "wall_type": wall_type,
                    "window_area": float(win_area), "window_r": float(a.value("windows." + window_type)),
                    "window_type": window_type, "window_leak": f_win, "window_measured": measured,
                    "window_fixed": bool(w.get("window_fixed")), "window_open": window_open,
                    "door_area": door_area, "door_r": float(a.value("doors_exterior." + door_type)) if door_area else 0.0,
                    "door_type": door_type if door_area else None, "door_leak": f_door,
                })

    def _other_walls(self, prop):
        unknown = [w["id"] for w in prop.get("other_boundary_walls") or [] if w.get("exposure") == "unknown"]
        if unknown:
            self.warnings.append("Boundary walls with unknown exposure (outdoors, a neighbour or a corridor; the scan "
                                 "cannot tell) are treated as not exposed to outdoor noise: %s." % ", ".join(unknown))

    def _partitions(self, prop):
        a = self.a
        self.partitions = []
        door_area_default = None
        for p in prop.get("partitions") or []:
            if p["room_a"] not in self.index or p["room_b"] not in self.index:
                self.warnings.append("Partition %s names an unknown room; it is ignored." % p.get("id"))
                continue
            kind = p.get("kind") or "wall"
            elements = []
            open_area = 0.0
            door_state = p.get("door") or "none"
            if p.get("door_status") == "assumed":
                self.assumed.append({"input": "door on %s" % p["id"], "value": door_state if kind != "opening" else "opening",
                                     "source": p.get("source")})
            if kind == "opening":
                area = p.get("area_m2")
                if area is None:
                    area = door_area_default = door_area_default or a.value("partitions.door_area")
                open_area = float(area)
                elements.append((open_area, a.value("partitions.gap_and_open_door_r")))
            else:
                area = float(p["area_m2"])
                ptype = p.get("partition_type") or a.value("partitions.default_wall")
                r_wall = a.value("partitions." + ptype) - a.value("partitions.derating." + DERATING_KEY[ptype])
                if door_state in ("closed", "open"):
                    darea = p.get("door_area_m2") or a.value("partitions.door_area")
                    darea = float(darea)
                    if darea > area:
                        self.warnings.append("Door on %s is larger than the partition; clamped (V1 5c)." % p["id"])
                        darea = area
                    if door_state == "closed":
                        dtype = p.get("door_type") or a.value("partitions.default_door")
                        leaf_r = a.value("partitions." + dtype) - a.value("partitions.derating.door_leaf")
                        gap = 0.0 if p.get("door_sweep") else (
                            a.value("partitions.door_width") * a.value("partitions.door_undercut_height"))
                        elements.append((darea - gap, leaf_r))
                        if gap:
                            elements.append((gap, a.value("partitions.gap_and_open_door_r")))
                    else:
                        open_area = darea
                        elements.append((darea, a.value("partitions.gap_and_open_door_r")))
                    elements.append((area - darea, r_wall))
                else:
                    elements.append((area, r_wall))
            P = sum(s * 10.0 ** (-r / 10.0) for s, r in elements)
            self.partitions.append({"id": p.get("id"), "i": self.index[p["room_a"]], "j": self.index[p["room_b"]],
                                    "P": P, "open_area": open_area, "door": door_state if kind != "opening" else "opening"})

    # ------------------------------------------------------------ groups and coupling
    def _group(self):
        a = self.a
        n = len(self.rooms)
        parent = list(range(n))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        limit = a.value("solver.merge_coupling_limit")
        while True:
            groups = sorted({find(i) for i in range(n)})
            gidx = {g: k for k, g in enumerate(groups)}
            m = len(groups)
            A = np.array([0.0] * m)
            for i, r in enumerate(self.rooms):
                A[gidx[find(i)]] += facade.sabine(r["volume"], a)
            P = np.zeros((m, m))
            for p in self.partitions:
                gi, gj = gidx[find(p["i"])], gidx[find(p["j"])]
                if gi == gj:
                    continue
                A[gi] += p["open_area"]
                A[gj] += p["open_area"]
                P[gi, gj] += p["P"]
                P[gj, gi] += p["P"]
            C = P / A[:, None]
            merged = False
            for gi in range(m):
                for gj in range(m):
                    if gi != gj and C[gi, gj] > limit:
                        parent[find(groups[gi])] = find(groups[gj])
                        merged = True
            if not merged:
                break
        self.group_of = [gidx[find(i)] for i in range(n)]
        self.members = [[i for i in range(n) if self.group_of[i] == g] for g in range(m)]
        self.A, self.C, self.P = A, C, P
        for g, mem in enumerate(self.members):
            if len(mem) > 1:
                self.warnings.append("Rooms %s are joined by an opening with coupling above %.1f and are solved as "
                                     "one room (R4 E5)." % (" and ".join(self.rooms[i]["id"] for i in mem), limit))
        walls_by_group = {self.group_of[self.index[w["room"]]] for w in self.walls}
        linked = {g for g in range(m) if any(self.P[g, h] > 0 for h in range(m))}
        for g in range(m):
            if g not in walls_by_group and g not in linked:
                self.warnings.append("Room %s has no exterior wall and no partition, so no sound reaches it in the "
                                     "model; its levels are null." % "+".join(self.rooms[i]["id"] for i in self.members[g]))

    def room_range(self, i):
        """+/- 3 dB when every exterior wall feeding the room has a measured window area, else +/- 5."""
        g = self.group_of[i]
        own = [w for w in self.walls if self.group_of[self.index[w["room"]]] == g]
        if own and all(w["window_measured"] for w in own):
            return self.a.value("reporting.range_measured_windows")
        return self.a.value("reporting.range_default")

    def group_name(self, g):
        return "+".join(self.rooms[i]["id"] for i in self.members[g])

    # ------------------------------------------------------------ facade energy
    def transmission(self, wall, aircraft=False):
        a = self.a
        off = a.value("facade.aircraft_rating_offset") if aircraft else 0.0
        openings = []
        if wall["window_area"] > 0:
            openings.append({"kind": "window", "area": wall["window_area"], "R": wall["window_r"] + off,
                             "leak_fraction": wall["window_leak"]})
        if wall["door_area"] > 0:
            openings.append({"kind": "door", "area": wall["door_area"], "R": wall["door_r"],
                             "leak_fraction": wall["door_leak"]})
        t = facade.wall_transmission(wall["area"], wall["wall_r"] + off, openings, a)
        for w in t["warnings"]:
            msg = "Wall %s: %s" % (wall["id"], w)
            if msg not in self.warnings:
                self.warnings.append(msg)
        return t

    def facade_energy(self, wall_levels, constant, aircraft=False, roof_levels=None):
        """F (groups x hours) and its parts {(group, path): hourly energy array}.

        wall_levels: {wall_id: [hourly levels or None]} (walls not listed get no sound).
        """
        a = self.a
        m = len(self.members)
        hours = len(next(iter(wall_levels.values()))) if wall_levels else 24
        F = np.zeros((m, hours))
        parts = {}
        open_reduction = a.value("facade.windows_open_reduction")
        for g in range(m):
            gwalls = [w for w in self.walls if self.group_of[self.index[w["room"]]] == g and w["id"] in wall_levels]
            open_walls = [w for w in gwalls if w["window_open"]]
            if open_walls:
                best = np.zeros(hours)
                best_wall = [None] * hours
                for w in open_walls:
                    e = np.array([db.energy(None if x is None else x - open_reduction) for x in wall_levels[w["id"]]])
                    for h in range(hours):
                        if e[h] > best[h]:
                            best[h], best_wall[h] = e[h], w["id"]
                F[g] = best
                for w in open_walls:
                    mask = np.array([1.0 if best_wall[h] == w["id"] else 0.0 for h in range(hours)])
                    if mask.any():
                        parts[(g, "%s:open window" % w["id"])] = best * mask
                continue
            for w in gwalls:
                t = self.transmission(w, aircraft)
                e_out = np.array([db.energy(None if x is None else x + constant) for x in wall_levels[w["id"]]])
                for part, area in t["parts"].items():
                    if area > 0:
                        key = (g, "%s:%s" % (w["id"], part))
                        contrib = e_out * area / self.A[g]
                        parts[key] = parts.get(key, 0.0) + contrib
                        F[g] += contrib
            if roof_levels is not None and self.top_floor:
                roof_r = self.roof_r() + a.value("facade.aircraft_rating_offset")
                area = sum(self.rooms[i]["area"] for i in self.members[g])
                e_out = np.array([db.energy(None if x is None else x + constant) for x in roof_levels])
                contrib = e_out * area * 10.0 ** (-roof_r / 10.0) / self.A[g]
                parts[(g, "roof:roof")] = contrib
                F[g] += contrib
        return F, parts

    def roof_r(self):
        self.a.value("walls.roof")
        return float(self.a.value("walls." + self.era_wall_type))

    def solve(self, F):
        return solve(F, self.C)

    def inflow_parts(self, E):
        """{(group, 'from:<room>'): energy} for every partition path, given the solved energies."""
        parts = {}
        m = len(self.members)
        for g in range(m):
            for h in range(m):
                if g != h and self.C[g, h] > 0:
                    parts[(g, "from:%s" % self.group_name(h))] = self.C[g, h] * E[h]
        return parts
