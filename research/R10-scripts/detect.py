"""Automatic window / door candidates on one wall plane, from the MatterPak point cloud (sampled from the textured mesh).
A 10 cm cell is 'opening-like' when, among points from 5 cm inside to 60 cm outside the plane:
  - there are none (hole: bare glass is not reconstructed), or
  - the point nearest the room is more than 3 cm beyond the plane (recess: glass or frame set back), or
  - the brightness standard deviation of points within 3 cm of the plane exceeds TEX (blinds and glass reflections are
    strongly textured; painted wall is about 6 to 8 grey levels).
Cells within 10 cm of floor or ceiling are ignored as edge noise. 4-connected regions of opening-like cells give
bounding boxes; boxes smaller than 0.4 m x 0.5 m are dropped. Box reaching below 0.25 m = door candidate.
Openings touching a plane end are clipped at the plane end.
usage (module): detect(P, axis, pos, out, u0, u1, z_top) -> list of dicts"""
import numpy as np
C = 0.10
TEX = 20.0

def detect(P, axis, pos, out, u0, u1, z_top):
    a_i, u_i = (0, 1) if axis == 'x' else (1, 0)
    d = (P[:, a_i] - pos) * out
    box = (P[:, u_i] >= u0) & (P[:, u_i] < u1) & (P[:, 2] >= 0) & (P[:, 2] < z_top)
    nu = int(np.ceil((u1 - u0) / C)); nz = int(np.ceil(z_top / C))
    dd_all = d[box]; ii_all = np.minimum(((P[box, u_i] - u0) / C).astype(int), nu - 1); kk_all = np.minimum((P[box, 2] / C).astype(int), nz - 1)
    m = (d >= -0.05) & (d <= 0.6) & (P[:, u_i] >= u0) & (P[:, u_i] < u1) & (P[:, 2] >= 0) & (P[:, 2] < z_top)
    d = d[m]; u = P[m, u_i]; z = P[m, 2]; g = P[m, 3:6].mean(1)
    nu = int(np.ceil((u1 - u0) / C)); nz = int(np.ceil(z_top / C))
    ii = np.minimum(((u - u0) / C).astype(int), nu - 1); kk = np.minimum((z / C).astype(int), nz - 1)
    near = np.full((nz, nu), np.inf); np.minimum.at(near, (kk, ii), d)
    on = np.abs(d) <= 0.03
    cnt = np.zeros((nz, nu)); s1 = np.zeros((nz, nu)); s2 = np.zeros((nz, nu))
    np.add.at(cnt, (kk[on], ii[on]), 1); np.add.at(s1, (kk[on], ii[on]), g[on]); np.add.at(s2, (kk[on], ii[on]), g[on] ** 2)
    with np.errstate(invalid='ignore', divide='ignore'):
        sd = np.sqrt(np.maximum(s2 / cnt - (s1 / cnt) ** 2, 0))
    # occlusion: furniture between the room and the wall (points 5-80 cm inside the plane)
    mo = (dd_all >= -0.8) & (dd_all < -0.05)
    occ = np.zeros((nz, nu)); np.add.at(occ, (kk_all[mo], ii_all[mo]), 1)
    occluded = occ >= 5
    openish = ((~np.isfinite(near)) | (near > 0.03) | ((cnt >= 10) & (sd > TEX))) & ~occluded
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
            if min(ks) * C < 0.25 and h < 1.8: continue   # low blob under furniture, neither window nor door
            fill = len(cells) / ((max(is_) - min(is_) + 1) * (max(ks) - min(ks) + 1))
            zb = min(ks) * C
            # see-through evidence: points 0.6-20 m beyond the plane inside the box footprint
            ub0 = u0 + min(is_) * C; ub1 = u0 + (max(is_) + 1) * C
            far = int(((dd_all > 0.6) & (dd_all < 20) & (ii_all >= min(is_)) & (ii_all <= max(is_)) & (kk_all >= min(ks)) & (kk_all <= max(ks))).sum())
            boxes.append(dict(far_pts=far, u_from=round(u0 + min(is_) * C, 2), u_to=round(u0 + (max(is_) + 1) * C, 2),
                              z_from=round(zb, 2), z_to=round((max(ks) + 1) * C, 2), width_m=round(w, 2), height_m=round(h, 2),
                              area_m2=round(w * h, 2), fill=round(fill, 2), kind='door?' if zb < 0.25 else 'window?'))
    return boxes

if __name__ == '__main__':
    import sys
    P = np.load(sys.argv[1])
    for line in open(sys.argv[2]):
        n, a, p, o, u0, u1, zt = line.split()
        for b in detect(P, a, float(p), int(o), float(u0), float(u1), float(zt)):
            print(n, b)
