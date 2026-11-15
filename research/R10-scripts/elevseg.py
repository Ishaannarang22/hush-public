"""Elevation image of one auto segment (any direction). usage: elevseg.py walls.json cloud.npy floor room azimuth name"""
import sys, json
import numpy as np
from PIL import Image
d = json.load(open(sys.argv[1])); P = np.load(sys.argv[2])
fl, room, az, name = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
s = [s for s in d['segments'] if s['floor'] == fl and s['room'] == room and s['azimuth_deg'] == az][0]
p = s['plane']; fz = d['floor_z'][str(fl)]
ox, oy = p['ox'], p['oy']; tx, ty = -oy, ox
dd = P[:, 0] * ox + P[:, 1] * oy - p['offset']; u = P[:, 0] * tx + P[:, 1] * ty; z = P[:, 2] - fz
m = (dd > -0.05) & (dd < 0.6) & (u > p['u0']) & (u < p['u1']) & (z > 0) & (z < s['height_m'])
R = 0.02; W = int((p['u1'] - p['u0']) / R) + 1; H = int(s['height_m'] / R) + 1
img = np.full((H, W, 3), 255, np.uint8)
o = np.argsort(-dd[m]); q = P[m][o]
img[H - 1 - (z[m][o] / R).astype(int), ((u[m][o] - p['u0']) / R).astype(int)] = q[:, 3:6]
for k in range(0, W, 25): img[:, k] = (img[:, k] * 0.7).astype(np.uint8)
for k in range(0, H, 25): img[H - 1 - k, :] = (img[H - 1 - k, :] * 0.7).astype(np.uint8)
Image.fromarray(img).save('/tmp/hush-r10/q/seg_%s.png' % name)
print(s['width_m'], s['openings'])
