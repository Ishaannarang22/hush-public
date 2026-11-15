"""Tests for the standalone close-range speaker example. Run with: pytest fieldtests"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for path in (HERE, os.path.dirname(HERE)):
    if path not in sys.path:
        sys.path.insert(0, path)

import near_speaker as ns  # noqa: E402


def load():
    with open(os.path.join(HERE, "hotel_speaker_test.json")) as fh:
        return json.load(fh)


def setup_result(name):
    return [s for s in ns.evaluate(load())["setups"] if s["setup"] == name][0]


def test_solid_angle_of_a_huge_plane_is_a_hemisphere():
    assert abs(ns.solid_angle(-1e6, 1e6, -1e6, 1e6, 1.0) - 2 * math.pi) < 1e-4


def test_solid_angle_matches_the_on_axis_formula():
    a, b, d = 0.9145, 0.4955, 0.3048
    on_axis = 4 * math.atan(a * b / (d * math.sqrt(a * a + b * b + d * d)))
    assert abs(ns.solid_angle(-a, a, -b, b, d) - on_axis) < 1e-9
    assert abs(on_axis - 3.76) < 0.01


def test_far_speaker_covers_the_wall_evenly():
    # From far away, the window's share of the sound reaching the wall tends to its share of the area.
    test = load()
    setup = test["base"]
    setup["speaker"]["distance_from_wall_m"] = 200.0
    _, _, share = ns.incident_power(setup)
    area_share = (1.829 * 0.991) / (3.353 * 2.438)
    assert abs(share - area_share) < 0.01


def test_as_predicted_reproduces_the_recorded_drop():
    # hotel_speaker_test.md: "the level at the listener is 28.7 dB below the level 1 ft from the speaker"
    s = setup_result("as_predicted")
    assert abs(s["drop_db"] + 28.7) < 0.1
    assert abs(s["window_share_of_wall_power"] - 0.74) < 0.01


def test_as_predicted_reproduces_the_recorded_predictions():
    runs = {r["run"]: r for r in setup_result("as_predicted")["runs"]}
    assert abs(runs["run 1"]["predicted_speaker_alone_dba"][0] - 50.3) < 0.1
    assert abs(runs["run 2"]["predicted_centre_dba"] - 55.7) < 0.1
    assert abs(runs["run 2"]["predicted_on_meter_dba"][0] - 53.9) < 0.1
    assert abs(runs["run 2"]["predicted_on_meter_dba"][1] - 57.5) < 0.1


def test_confirmed_setup_lands_within_the_stated_range():
    runs = {r["run"]: r for r in setup_result("confirmed")["runs"]}
    assert 54.9 <= runs["run 2"]["predicted_centre_dba"] <= 55.3
    assert abs(runs["run 2"]["difference_at_centre_db"]) <= 3.0
    assert abs(runs["run 1"]["difference_at_centre_db"]) <= 3.0


def test_frame_leakage_is_the_main_path():
    shares = setup_result("confirmed")["path_shares"]
    assert shares["frame leakage"] > shares["glass"] > shares["wall"]
    assert abs(sum(shares.values()) - 1.0) < 0.005


def test_louder_speaker_is_louder_inside_by_the_same_amount():
    test = load()
    test["background_dba"] = None
    test["runs"] = [{"name": "a", "speaker_dba_at_reference": [80, 80], "measured_dba": [50, 50]},
                    {"name": "b", "speaker_dba_at_reference": [90, 90], "measured_dba": [50, 50]}]
    runs = ns.evaluate(test)["setups"][0]["runs"]
    assert abs((runs[1]["predicted_centre_dba"] - runs[0]["predicted_centre_dba"]) - 10.0) < 0.05


def test_moving_off_the_window_makes_it_quieter():
    test = load()
    base = ns.drop_to_listener(test["base"], ns.Assumptions.load())["drop_db"]
    test["base"]["speaker"]["offset_from_window_centre_m"] = 0.9144  # 3 ft: the window's edge
    edge = ns.drop_to_listener(test["base"], ns.Assumptions.load())["drop_db"]
    assert edge < base - 1.5


def test_background_is_added_and_removed_consistently():
    assert abs(ns.with_background(50.3, 45.0) - 51.4) < 0.1
    assert abs(ns.without_background(53.0, 45.0) - 52.3) < 0.1
    assert ns.without_background(44.0, 45.0) is None


def test_the_example_does_not_touch_the_model():
    # Nothing in noisemodel/ may import this example.
    model_dir = os.path.join(os.path.dirname(HERE), "noisemodel")
    for name in os.listdir(model_dir):
        if name.endswith(".py"):
            with open(os.path.join(model_dir, name)) as fh:
                text = fh.read()
            assert "near_speaker" not in text and "fieldtests" not in text, name
