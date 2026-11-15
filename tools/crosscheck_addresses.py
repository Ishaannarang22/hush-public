"""Build road inputs for cross-check locations from TxDOT's public Roadway Inventory, compute our outdoor
DNL at each, and look up HowLoud's Soundscore. Not part of the noise model; nothing in noisemodel/ imports it.

    HOWLOUD_API_KEY=... python tools/crosscheck_addresses.py --out outputs/crosscheck_points.json

Network: TxDOT 2020 Roadway Inventory feature service (research R7, [TXRI]) and HowLoud's official API
(research S4). The key is read from the HOWLOUD_API_KEY environment variable only and is never written out.
"""
import argparse, json, math, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from noisemodel.predict import predict  # noqa: E402

TXRI = ("https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/"
        "TxDOT_2020_Roadway_Inventory_/FeatureServer/0/query")
RADIUS_M = 800
FIELDS = "STE_NAM,HWY,RDBD_ID,F_SYSTEM,ADT_CUR,ADT_YEAR,SPD_MAX,AADT_SINGLE_UNIT,AADT_COMBINATION,TRF_STA_ID"

# Public map coordinates in Houston, chosen to span loud to quiet. Not taken from sponsor data.
POINTS = [
    ("demo-greenhouse", "2219 Greenhouse Rd, Houston TX 77084 (demo apartment)", 29.7955898, -95.7051799),
    ("demo-yale", "2125 Yale St, Houston TX 77008 (unit 205)", 29.805907, -95.399432),
    ("freeway-i10-heights", "Point by I-10, Heights", 29.7790, -95.4010),
    ("freeway-us59-kirby", "Point by US-59, Upper Kirby", 29.7330, -95.4200),
    ("freeway-i10-springbranch", "Point near I-10, Spring Branch", 29.7880, -95.5400),
    ("arterial-shepherd", "Point by N Shepherd Dr", 29.8000, -95.4095),
    ("arterial-westheimer", "Point by Westheimer Rd, Montrose", 29.7440, -95.4010),
    ("side-heights", "Residential street, Heights", 29.8150, -95.4040),
    ("side-montrose", "Residential street, Montrose", 29.7390, -95.3920),
    ("side-meyerland", "Residential street, Meyerland", 29.6850, -95.4600),
    ("side-memorial", "Residential street, Memorial", 29.7700, -95.5750),
    ("airport-hobby", "Residential street near Hobby Airport", 29.6600, -95.2850),
]


def get(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=60) as r:
        return json.load(r)


def txdot(lat, lon, radius=RADIUS_M):
    q = {"geometry": "%f,%f" % (lon, lat), "geometryType": "esriGeometryPoint", "inSR": 4326,
         "spatialRel": "esriSpatialRelIntersects", "distance": radius, "units": "esriSRUnit_Meter",
         "outFields": FIELDS, "returnGeometry": "true", "outSR": 4326, "f": "json"}
    d = get(TXRI + "?" + urllib.parse.urlencode(q))
    if d.get("error"):
        raise RuntimeError(d["error"])
    return d.get("features", [])


def roads_from(features):
    """Two alternative road lists, so a divided highway is not counted twice: A uses centreline (KG) records,
    B uses the two roadbeds (RG, LG) at half the count each. Frontage roads (AG) and streets are in both."""
    hwys_kg = {f["attributes"]["HWY"] for f in features if f["attributes"]["RDBD_ID"] == "KG"}
    hwys_rl = {f["attributes"]["HWY"] for f in features if f["attributes"]["RDBD_ID"] in ("RG", "LG")}
    both = hwys_kg & hwys_rl
    a, b = [], []
    for i, f in enumerate(features):
        at = f["attributes"]
        adt = at.get("ADT_CUR") or 0
        if adt <= 0:
            continue
        bed, hwy = at["RDBD_ID"], at["HWY"]
        share = 0.5 if bed in ("RG", "LG") else 1.0
        speed = at.get("SPD_MAX") or 30
        for j, path in enumerate(f["geometry"].get("paths") or []):
            if len(path) < 2:
                continue
            road = {"id": "tx-%d-%d" % (i, j), "name": (at.get("STE_NAM") or hwy or "").strip(),
                    "road_class": "freeway" if at.get("F_SYSTEM") in (1, 2) else "arterial",
                    "aadt": adt * share,
                    "medium_trucks_per_day": (at.get("AADT_SINGLE_UNIT") or 0) * share,
                    "heavy_trucks_per_day": (at.get("AADT_COMBINATION") or 0) * share,
                    "speed_kmh": speed * 1.609344,
                    "geometry": [[round(p[0], 6), round(p[1], 6)] for p in path]}
            if hwy in both:
                if bed == "KG":
                    a.append(road)
                elif bed in ("RG", "LG"):
                    b.append(road)
                else:
                    a.append(road); b.append(road)
            else:
                a.append(road); b.append(road)
    return a, b


def our_dnl(lat, lon, roads):
    if not roads:
        return None
    prop = {"id": "pt", "lat": lat, "lon": lon, "era": {"value": "2000_on"},
            "rooms": [{"id": "r", "type": "living", "area_m2": 14, "height_m": 2.4,
                       "exterior_walls": [{"id": "w", "azimuth_deg": 0, "area_m2": 9.6, "window_area_m2": 1.44}]}],
            "partitions": []}
    res = predict(prop, {"property_id": "pt", "roads": roads}, with_fixes=False)
    ff = res["outdoor_free_field"].get("road")
    return None if not ff else ff["dnl_dba"]


def howloud(lat, lon, key):
    d = get("https://api.howloud.com/v2/score?lat=%.7f&lng=%.7f" % (lat, lon), {"x-api-key": key})
    return d["result"][0]


def evaluate_point(pid, label, lat, lon, key):
    feats = txdot(lat, lon)
    a, b = roads_from(feats)
    da, db_ = our_dnl(lat, lon, a), our_dnl(lat, lon, b)
    dnl = max(x for x in (da, db_) if x is not None) if (da is not None or db_ is not None) else None
    h = howloud(lat, lon, key) if key else None
    loud = sorted(a, key=lambda r: -r["aadt"])[:1]
    return {"id": pid, "label": label, "lat": lat, "lon": lon, "radius_m": RADIUS_M,
            "txdot_segments": len(feats), "roads_used": len(a),
            "busiest_road": None if not loud else {"name": loud[0]["name"], "aadt": round(loud[0]["aadt"])},
            "our_outdoor_dnl": None if dnl is None else round(dnl, 1),
            "howloud": None if not h else {k: h.get(k) for k in ("score", "scoretext", "traffic", "local", "airports")}}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=os.path.join(ROOT, "outputs", "crosscheck_points.json"))
    ap.add_argument("--extra", help="JSON list of [id, label, lat, lon] to evaluate in place of the built-in list")
    args = ap.parse_args(argv)
    key = os.environ.get("HOWLOUD_API_KEY")
    if not key:
        sys.stderr.write("HOWLOUD_API_KEY is not set: our levels are computed, published scores are left empty.\n")
    points = json.load(open(args.extra)) if args.extra else POINTS
    out = []
    for pid, label, lat, lon in points:
        row = evaluate_point(pid, label, lat, lon, key)
        out.append(row)
        h = row["howloud"] or {}
        print("%-26s segs %3d  our DNL %s  HowLoud %s %-7s traffic %s local %s air %s  busiest %s"
              % (pid, row["txdot_segments"], row["our_outdoor_dnl"], h.get("score"), h.get("scoretext") or "",
                 h.get("traffic"), h.get("local"), h.get("airports"), row["busiest_road"]))
        time.sleep(0.4)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
