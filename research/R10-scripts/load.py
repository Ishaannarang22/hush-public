"""Shared loader for the MatterPak OBJ: vertices, faces with group name and room (sub) index."""
import re, math, pickle, os, sys

def load(obj, cache='/tmp/hush-r10/q/mesh.pkl'):
    # face tuple: (i, j, k, sub, kind, group_name); floor index is in group_name as _groupNNN_
    if os.path.exists(cache):
        return pickle.load(open(cache, 'rb'))
    V = []; F = []
    g = None; sub = None; kind = None
    for line in open(obj):
        if line.startswith('v '):
            p = line.split(); V.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith('g '):
            g = line[2:].strip()
            m = re.search(r'_group(\d+)_sub(\d+)(?:_object([a-z]+))?', g)
            sub = int(m.group(2)); kind = m.group(3) or 'unknown'
            if g.startswith('mirror'): kind = 'mirror'
        elif line.startswith('f '):
            idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
            for k in range(1, len(idx) - 1):
                F.append((idx[0], idx[k], idx[k + 1], sub, kind, g))
    pickle.dump((V, F), open(cache, 'wb'))
    return V, F

def normal(V, f):
    a, b, c = V[f[0]], V[f[1]], V[f[2]]
    ux, uy, uz = b[0]-a[0], b[1]-a[1], b[2]-a[2]
    vx, vy, vz = c[0]-a[0], c[1]-a[1], c[2]-a[2]
    nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    n = math.sqrt(nx*nx+ny*ny+nz*nz)
    if n == 0: return (0, 0, 0), 0
    return (nx/n, ny/n, nz/n), n/2
