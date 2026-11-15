"""Builders for made-up test inputs (allowed in unit tests only, docs/BUILD_BRIEF.md section 1)."""
import copy
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = os.path.join(ROOT, "samples")


def load_sample(name):
    with open(os.path.join(SAMPLES, name)) as fh:
        return json.load(fh)


def yale():
    return load_sample("property.yale.json"), load_sample("sources.yale.json")


def one_room(width=4.0, depth=3.5, height=2.4, wall_area=None, azimuth=0.0, window_area=None,
             era="1980_1999", window_type=None, wall_type=None, door_area=0.0, extra_walls=None):
    """The R3 test bedroom: 4 x 3.5 x 2.4 m with one 9.6 m2 exterior wall."""
    wall = {
        "id": "w1", "azimuth_deg": azimuth,
        "area_m2": width * height if wall_area is None else wall_area,
        "wall_type": wall_type, "window_area_m2": window_area, "window_type": window_type,
        "door_area_m2": door_area, "door_type": None,
    }
    walls = [wall] + list(extra_walls or [])
    return {
        "id": "test-room", "lat": 29.8, "lon": -95.4,
        "facade_point": {"lat": 29.8, "lon": -95.4},
        "year_built": None,
        "era": {"value": era} if era else None,
        "rooms": [{
            "id": "bed", "type": "bedroom", "area_m2": width * depth, "height_m": height,
            "volume_m3": width * depth * height, "exterior_walls": walls,
        }],
        "partitions": [],
    }


def simple_road(level=65.0, bearing=0.0, profile="flat", distance=15.0, **extra):
    src = {
        "property_id": "test",
        "outdoor_levels_dba": {
            "road": level, "rail": None, "aviation": None,
            "road_profile": profile, "road_bearing_deg": bearing, "road_distance_m": distance,
        },
    }
    src.update(extra)
    return src


def worked_example():
    """SOUND_MODEL.md section 5: bedroom 1 and the corridor, road only, door open."""
    prop = {
        "id": "worked-example", "lat": 29.8058666, "lon": -95.3993738,
        "facade_point": {"lat": 29.8058666, "lon": -95.3993738},
        "year_built": None,
        "rooms": [
            {"id": "bed1", "type": "bedroom", "area_m2": 19.785, "height_m": 2.865, "volume_m3": 56.68,
             "exterior_walls": [{"id": "bed1-n", "azimuth_deg": 0, "area_m2": 3.703 * 2.865,
                                 "wall_type": None, "window_area_m2": None, "window_type": None,
                                 "door_area_m2": 0, "door_type": None}]},
            {"id": "corridor", "type": "corridor", "area_m2": 8.032, "height_m": 2.893, "volume_m3": 23.24,
             "exterior_walls": []},
        ],
        "partitions": [
            {"id": "p1", "room_a": "bed1", "room_b": "corridor", "area_m2": 8.0, "kind": "wall",
             "partition_type": None, "door": "open", "door_area_m2": 1.6, "door_type": None},
        ],
    }
    src = {
        "property_id": "worked-example",
        "outdoor_levels_dba": {"road": 54.8, "rail": None, "aviation": None, "road_profile": "hud",
                               "road_bearing_deg": 90, "road_distance_m": 40},
        "tree_cover": {"fraction": 0.04},
    }
    return prop, src


def deep(obj):
    return copy.deepcopy(obj)


def room(result, room_id):
    for r in result["rooms"]:
        if r["id"] == room_id:
            return r
    raise KeyError(room_id)


def walk_levels(obj, path=""):
    """Yield (path, value) for every numeric level field in a levels.json result."""
    level_keys = {"dba", "dnl_dba", "night_dba", "peak_dba", "l24_dba"}
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = path + "." + k
            if k in level_keys and isinstance(v, (int, float)):
                yield p, v
            elif k in ("by_source",) and isinstance(v, dict):
                for s, x in v.items():
                    if isinstance(x, (int, float)):
                        yield p + "." + s, x
            else:
                for item in walk_levels(v, p):
                    yield item
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            for item in walk_levels(v, "%s[%d]" % (path, i)):
                yield item
