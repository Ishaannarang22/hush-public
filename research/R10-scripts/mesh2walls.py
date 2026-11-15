"""Generic MatterPak -> walls, exterior/interior classification, compass azimuth, window/door candidates, partitions.

Inputs: mesh cache (load.py), point cloud .npy, floor levels, rotation angle theta (deg) from the Model API
geocoordinates quaternion (bearing of a model vector = 90 - (theta + atan2(vy, vx)), checked with geoLocationOf).

Method
1. Room footprint grid per floor (10 cm) from up-facing mesh faces of each room group (group 'subNNN').
2. Every vertical face of a room is a wall candidate; its normal points into the room. Probe the floor grid of the
   same floor 0.25, 0.5, 0.75 m beyond the face (outwards). Probes hitting another room -> interior wall with that
   room; probes hitting no room at all -> exterior; probes inside the same room -> furniture, ignored.
3. Faces are clustered per room, class (exterior / neighbour room) and outward direction (10 deg bins) and plane
   offset (0.3 m). Cluster = wall segment. Width = 2nd..98th percentile extent along the wall; gross area = width x
   room height (room height = room ceiling z - floor z from the mesh).
4. Window/door candidates on exterior segments with detect_arrays (holes, recess or strongly textured surface on the
   plane, not occluded by furniture).
"""
import sys, re, math, json, pickle, collections
import numpy as np
sys.path.insert(0, '/tmp/hush-r10/scripts')
from load import load, normal

C = 0.10; TEX = 20.0

def detect_arrays(d, u, z, g, u0, u1, z0, z_top):
    """d outward distance from plane, u along wall, z height above floor; same rules as detect.py."""
    nu = max(1, int(np.ceil((u1 - u0) / C))); nz = max(1, int(np.ceil((z_top - z0) / C)))
    box = (u >= u0) & (u < u1) & (z >= z0) & (z < z_top)
    d, u, z, g = d[box], u[box], z[box] - z0, g[box]
    ii = np.minimum(((u - u0) / C).astype(int), nu - 1); kk = np.minimum((z / C).astype(int), nz - 1)
    near = np.full((nz, nu), np.inf)
    m = (d >= -0.05) & (d <= 0.6)
    np.minimum.at(near, (kk[m], ii[m]), d[m])
    on = np.abs(d) <= 0.03
    cnt = np.zeros((nz, nu)); s1 = np.zeros((nz, nu)); s2 = np.zeros((nz, nu))
    np.add.at(cnt, (kk[on], ii[on]), 1); np.add.at(s1, (kk[on], ii[on]), g[on]); np.add.at(s2, (kk[on], ii[on]), g[on] ** 2)
    with np.errstate(invalid='ignore', divide='ignore'):
        sd = np.sqrt(np.maximum(s2 / cnt - (s1 / cnt) ** 2, 0))
    mo = (d >= -0.8) & (d < -0.05)
    occ = np.zeros((nz, nu)); np.add.at(occ, (kk[mo], ii[mo]), 1)
    openish = ((~np.isfinite(near)) | (near > 0.03) | ((cnt >= 10) & (sd > TEX))) & ~(occ >= 5)
    openish[:1, :] = False; openish[nz - 1:, :] = False
    seen = np.zeros_like(openish); boxes = []
    for k0 in range(nz):
        for i0 in range(nu):
            if not openish[k0, i0] or seen[k0, i0]: continue
            st = [(k0, i0)]; seen[k0, i0] = True; cells = []
            while st:
                k, i = st.pop(); cells.append((k, i))
                for dk, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    a, b = k + dk, i + di
                    if 0 <= a < nz and 0 <= b < nu and openish[a, b] and not seen[a, b]:
                        seen[a, b] = True; st.append((a, b))
            ks = [c[0] for c in cells]; is_ = [c[1] for c in cells]
            w = (max(is_) - min(is_) + 1) * C; h = (max(ks) - min(ks) + 1) * C
            if w < 0.4 or h < 0.5: continue
            if min(ks) * C < 0.25 and h < 1.8: continue
            far = int(((d > 0.6) & (d < 20) & (ii >= min(is_)) & (ii <= max(is_)) & (kk >= min(ks)) & (kk <= max(ks))).sum())
            boxes.append(dict(u_from=round(u0 + min(is_) * C, 2), u_to=round(u0 + (max(is_) + 1) * C, 2),
                              sill_m=round(min(ks) * C, 2), head_m=round((max(ks) + 1) * C, 2),
                              width_m=round(w, 2), height_m=round(h, 2), area_m2=round(w * h, 2),
                              fill=round(len(cells) / ((max(is_) - min(is_) + 1) * (max(ks) - min(ks) + 1)), 2),
                              see_through_pts=far, kind='door' if min(ks) * C < 0.25 else 'window'))
    return boxes

def run(mesh_cache, cloud, floorz, theta, out_json, Rg=0.10):
    V, F = load('', cache=mesh_cache)
    P = np.load(cloud)
    floor_of = {}
    for f in F:
        mm = re.search(r'_group(\d+)', f[5]); floor_of[f[3]] = int(mm.group(1))
    # 1. footprint grid
    xs = [v[0] for v in V]; ys = [v[1] for v in V]
    x0, y0 = min(xs) - 1, min(ys) - 1; W = int((max(xs) + 1 - x0) / Rg) + 1; H = int((max(ys) + 1 - y0) / Rg) + 1
    lab = {fl: np.full((W, H), -1, int) for fl in floorz}
    cz = collections.defaultdict(list)
    for f in F:
        n, a = normal(V, f)
        fl = floor_of[f[3]]; z = sum(V[i][2] for i in f[:3]) / 3
        if n[2] < -0.95 and z > floorz[fl] + 1.8: cz[f[3]].append((z, a))
        is_floor = n[2] > 0.95 and abs(z - floorz[fl]) <= 0.45
        is_ceil = n[2] < -0.95 and z > floorz[fl] + 1.8
        if not (is_floor or is_ceil): continue
        px = [V[i][0] for i in f[:3]]; py = [V[i][1] for i in f[:3]]
        steps = max(1, int(max(max(px) - min(px), max(py) - min(py)) / (Rg / 2)) + 1)
        for s in range(steps + 1):
            for t in range(steps + 1 - s):
                w0 = s / steps; w1 = t / steps; w2 = 1 - w0 - w1
                i = int((w0 * px[0] + w1 * px[1] + w2 * px[2] - x0) / Rg); j = int((w0 * py[0] + w1 * py[1] + w2 * py[2] - y0) / Rg)
                lab[fl][i, j] = f[3]
    # fill gaps: grow labels into empty cells, 2 steps of 10 cm
    for fl in lab:
        L = lab[fl]
        for _ in range(2):
            G = L.copy()
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                S = np.roll(np.roll(L, di, 0), dj, 1)
                G = np.where((G == -1) & (S != -1), S, G)
            L = G
        lab[fl] = L
    height = {}
    for r, L in cz.items():
        L.sort(); tot = sum(a for _, a in L); acc = 0
        for z, a in L:
            acc += a
            if acc >= tot / 2: height[r] = round(z - floorz[floor_of[r]], 2); break
    area = {r: round(float((lab[floor_of[r]] == r).sum()) * Rg * Rg, 2) for r in floor_of}
    def lookup(fl, x, y):
        i = int((x - x0) / Rg); j = int((y - y0) / Rg)
        if 0 <= i < W and 0 <= j < H: return lab[fl][i, j]
        return -1
    # 2. classify faces
    clusters = collections.defaultdict(list)
    for f in F:
        if f[4] == 'mirror': continue
        n, a = normal(V, f)
        if a == 0 or abs(n[2]) > 0.2: continue
        r = f[3]; fl = floor_of[r]
        if r not in height: continue
        p = [V[i] for i in f[:3]]
        zc = sum(q[2] for q in p) / 3 - floorz[fl]
        if zc < 0.3 or zc > height[r] - 0.2: continue
        hn = math.hypot(n[0], n[1]); ox, oy = -n[0] / hn, -n[1] / hn
        cx = sum(q[0] for q in p) / 3; cy = sum(q[1] for q in p) / 3
        hits = [lookup(fl, cx + ox * t, cy + oy * t) for t in (0.45, 0.7, 0.95)]
        others = [h for h in hits if h not in (-1, r)]
        if others: cls = collections.Counter(others).most_common(1)[0][0]
        elif all(h == -1 for h in hits): cls = 'ext'
        else: continue
        ang = math.degrees(math.atan2(oy, ox))
        clusters[(r, cls, int(round(ang / 10.0)) % 36)].append((f, a, ox, oy, cx * ox + cy * oy))
    segs = []
    for (r, cls, ab), L in clusters.items():
        # split by plane offset
        L.sort(key=lambda e: e[4])
        groups = []; cur = [L[0]]
        for e in L[1:]:
            if e[4] - cur[-1][4] > 0.3: groups.append(cur); cur = [e]
            else: cur.append(e)
        groups.append(cur)
        for G in groups:
            A = sum(e[1] for e in G)
            if A < 1.0: continue
            ox = sum(e[2] * e[1] for e in G) / A; oy = sum(e[3] * e[1] for e in G) / A; nn = math.hypot(ox, oy); ox /= nn; oy /= nn
            offs = sorted((e[4], e[1]) for e in G); acc = 0
            for o_, a_ in offs:
                acc += a_
                if acc >= A / 2: off = o_; break
            tx, ty = -oy, ox
            us = sorted(V[i][0] * tx + V[i][1] * ty for e in G for i in e[0][:3])
            u0 = us[int(0.02 * (len(us) - 1))]; u1 = us[int(0.98 * (len(us) - 1))]
            width = u1 - u0
            if width < 0.3: continue
            bearing = (90 - (theta + math.degrees(math.atan2(oy, ox)))) % 360
            seg = dict(room=r, floor=floor_of[r], kind='exterior' if cls == 'ext' else 'interior',
                       other_room=None if cls == 'ext' else int(cls), azimuth_deg=round(bearing),
                       width_m=round(width, 2), height_m=height[r], gross_area_m2=round(width * height[r], 2),
                       mesh_face_area_m2=round(A, 2), plane=dict(ox=round(ox, 4), oy=round(oy, 4), offset=round(off, 3), u0=round(u0, 2), u1=round(u1, 2)))
            # 'beyond' test: scanned geometry 0.4-3 m behind the wall at this floor's heights means another indoor
            # space is there; an outside wall has almost nothing behind it except what is seen through glass
            fz = floorz[floor_of[r]]
            selb = (P[:, 2] > fz + 0.3) & (P[:, 2] < fz + height[r] - 0.3)
            db = P[selb, 0] * ox + P[selb, 1] * oy - off; ub = P[selb, 0] * tx + P[selb, 1] * ty
            nb = int(((db > 0.4) & (db < 3.0) & (ub >= u0) & (ub < u1)).sum())
            seg['beyond_pts_per_m2'] = round(nb / max(0.1, width * (height[r] - 0.6)), 1)
            if cls == 'ext':
                fz = floorz[floor_of[r]]
                sel = (P[:, 2] > fz - 0.05) & (P[:, 2] < fz + height[r] + 0.05)
                Q = P[sel]
                d = Q[:, 0] * ox + Q[:, 1] * oy - off
                u = Q[:, 0] * tx + Q[:, 1] * ty
                near = (u >= u0) & (u < u1) & (d > -0.85) & (d < 20)
                Q, d, u = Q[near], d[near], u[near]
                seg['openings'] = detect_arrays(d, u, Q[:, 2], Q[:, 3:6].mean(1), u0, u1, fz, fz + height[r])
            segs.append(seg)
    segs.sort(key=lambda s: (s['floor'], s['room'], s['kind'], s['azimuth_deg']))
    json.dump(dict(theta_deg=theta, floor_z=floorz, room_height_m=height, room_floor_area_grid_m2=area, segments=segs),
              open(out_json, 'w'), indent=1)
    return segs, height, area

if __name__ == '__main__':
    cfg = json.loads(sys.argv[1])
    segs, height, area = run(cfg['mesh'], cfg['cloud'], {int(k): v for k, v in cfg['floorz'].items()}, cfg['theta'], cfg['out'])
    for s in segs:
        o = s.get('openings')
        print(s['floor'], s['room'], s['kind'], s['other_room'], s['azimuth_deg'], s['width_m'], s['height_m'], s['gross_area_m2'], 'beyond', s['beyond_pts_per_m2'],
              s['mesh_face_area_m2'], '' if o is None else [(b['kind'], b['width_m'], b['height_m'], b['sill_m'], b['see_through_pts']) for b in o])
