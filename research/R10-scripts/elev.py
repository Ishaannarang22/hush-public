"""Elevation image of a wall from the coloured point cloud.
usage: elev.py name axis pos out u0 u1 [dmin dmax]
Keeps points whose outward distance d from the plane is in [dmin, dmax] (default -0.05..0.6) and for each
1 cm pixel shows the point closest to the room. Writes /tmp/hush-r10/q/elev_<name>.png (z up, u to the right)."""
import sys, os
import numpy as np
from PIL import Image
cache = '/tmp/hush-r10/q/cloud.npy'
if not os.path.exists(cache):
    a = np.loadtxt('/tmp/hush-r10/pak/x/cloud.xyz', dtype=np.float32)
    np.save(cache, a)
P = np.load(cache)
name, axis, pos, out, u0, u1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
dmin = float(sys.argv[7]) if len(sys.argv) > 7 else -0.05
dmax = float(sys.argv[8]) if len(sys.argv) > 8 else 0.60
a_i, u_i = (0, 1) if axis == 'x' else (1, 0)
d = (P[:, a_i] - pos) * out
u = P[:, u_i]; z = P[:, 2]
m = (d >= dmin) & (d <= dmax) & (u >= u0) & (u <= u1) & (z >= -0.05) & (z <= 3.05)
d, u, z, rgb = d[m], u[m], z[m], P[m][:, 3:6]
R = 0.01
W = int((u1 - u0) / R) + 1; H = int(3.1 / R) + 1
img = np.full((H, W, 3), 255, np.uint8)
depth = np.full((H, W), 99.0, np.float32)
ii = ((u - u0) / R).astype(int); kk = (H - 1 - (np.clip(z, 0, 3.09) / R).astype(int))
order = np.argsort(-d)  # draw farthest first, nearest last wins
for idx in order:
    img[kk[idx], ii[idx]] = rgb[idx]
# grid lines every 0.5 m
for k in range(0, H, 10): img[H - 1 - k, ::2, :] = (img[H - 1 - k, ::2, :] * (0.4 if k % 50 == 0 else 0.8)).astype(np.uint8)
for i in range(0, W, 10): img[::2, i, :] = (img[::2, i, :] * (0.4 if i % 50 == 0 else 0.8)).astype(np.uint8)
Image.fromarray(img).save('/tmp/hush-r10/q/elev_%s.png' % name)
print('points', m.sum(), 'image', W, H)
