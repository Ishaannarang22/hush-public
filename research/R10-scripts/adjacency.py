"""Room-to-room partitions from the MatterPak mesh.
Each room (sub index) has axis-aligned wall planes (vertical faces of that room's groups). Two rooms share a partition
when one room's plane faces +axis, the other's faces -axis, they are 5-45 cm apart (wall thickness) and their
along-wall extents overlap. Overlap length x lower room height = partition area. Gaps where neither side has mesh
from 0.2 to 2.0 m over >= 0.6 m width are reported as doorway candidates.
usage: adjacency.py out.json"""
import sys, json, collections, math
sys.path.insert(0, '/tmp/hush-r10/scripts')
from load import load, normal
V, F = load('/tmp/hush-r10/pak/x/784d81a97860404f869884f544c550b5.obj')
C = 0.05; Bp = 0.02
H = collections.defaultdict(collections.Counter)
faces = collections.defaultdict(list)
for f in F:
    n, a = normal(V, f)
    if a == 0 or abs(n[2]) > 0.2: continue
    for ax, nk in ((0, 'x'), (1, 'y')):
        if abs(n[ax]) > 0.97:
            s = 1 if n[ax] > 0 else -1
            pos = sum(V[i][ax] for i in f[:3]) / 3
            H[(nk, s, f[3])][round(pos / Bp)] += a
            faces[(nk, s, f[3])].append((pos, f))
planes = []
for key, h in H.items():
    for b, a in h.items():
        tot = sum(h.get(b + k, 0) for k in range(-2, 3))
        if tot >= 1.0 and all(tot >= sum(h.get(c + k, 0) for k in range(-2, 3)) for c in (b - 2, b - 1, b + 1, b + 2)):
            planes.append(dict(axis=key[0], sign=key[1], sub=key[2], pos=b * Bp, area=tot))
# merge peaks closer than 6 cm
planes.sort(key=lambda p: (p['axis'], p['sign'], p['sub'], p['pos']))
merged = []
for p in planes:
    if merged and all(merged[-1][k] == p[k] for k in ('axis', 'sign', 'sub')) and p['pos'] - merged[-1]['pos'] < 0.06:
        if p['area'] > merged[-1]['area']: merged[-1] = p
    else:
        merged.append(p)
planes = merged
# occupancy along u for each plane (z 0.2..2.4)
U0 = -10.0; NU = int(24 / C)
for p in planes:
    ax = 0 if p['axis'] == 'x' else 1; ui = 1 - ax
    occ = [0] * NU
    for pos, f in faces[(p['axis'], p['sign'], p['sub'])]:
        if abs(pos - p['pos']) > 0.05: continue
        pts = [V[i] for i in f[:3]]
        zs = [q[2] for q in pts]
        if max(zs) < 0.2 or min(zs) > 2.4: continue
        us = [q[ui] for q in pts]
        for i in range(int((min(us) - U0) / C), int((max(us) - U0) / C) + 1):
            occ[i] = 1
    p['occ'] = occ
    idx = [i for i, v in enumerate(occ) if v]
    p['u_min'] = round(U0 + idx[0] * C, 2) if idx else None
    p['u_max'] = round(U0 + (idx[-1] + 1) * C, 2) if idx else None
heights = {2: 2.873, 3: 2.865, 4: 2.861, 5: 2.893, 6: 2.518, 7: 2.525, 8: 2.869, 9: 2.863, 10: 2.894}
res = []
for a in planes:
    for b in planes:
        if a['axis'] != b['axis'] or a['sub'] >= b['sub'] or a['sign'] == b['sign']: continue
        # room on +side has plane with sign +1; the other room's plane (sign -1) lies at a smaller coordinate
        plus, minus = (a, b) if a['sign'] > 0 else (b, a)
        t = plus['pos'] - minus['pos']
        if not (0.05 <= t <= 0.45): continue
        lo = max(plus['u_min'], minus['u_min']); hi = min(plus['u_max'], minus['u_max'])
        if hi - lo < 0.3: continue
        i0 = int((lo - U0) / C); i1 = int((hi - U0) / C)
        both = sum(1 for i in range(i0, i1) if plus['occ'][i] or minus['occ'][i]) * C
        gaps = []; run = 0
        for i in range(i0, i1 + 1):
            if i < i1 and not plus['occ'][i] and not minus['occ'][i]: run += 1
            else:
                if run * C >= 0.6: gaps.append(round(run * C, 2))
                run = 0
        h = min(heights[plus['sub']], heights[minus['sub']])
        res.append(dict(rooms=[plus['sub'], minus['sub']], axis=a['axis'], plane_pos=[plus['pos'], minus['pos']],
                        thickness_m=round(t, 2), along=[lo, hi], length_m=round(hi - lo, 2),
                        mesh_covered_m=round(both, 2), height_m=round(h, 2), area_m2=round((hi - lo) * h, 1),
                        doorway_gaps_m=gaps))
res.sort(key=lambda r: r['rooms'])
for r in res: print(r)
json.dump(dict(planes=[{k: v for k, v in p.items() if k != 'occ'} for p in planes], partitions=res),
          open(sys.argv[1], 'w'), indent=1)
