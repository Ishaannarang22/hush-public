"""Fingerprints of every existing model output for the two demo properties.

`python3 tests/fingerprints.py --write` records them in tests/fixtures/main_fingerprints.json. The file
committed with the unit profile was written from `main` at fd69dd3, before any profile code existed, so
tests/test_profile_regression.py proves that runs with no profile are byte-identical to `main`.
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
FIXTURE = os.path.join(HERE, "fixtures", "main_fingerprints.json")
VOLATILE = {"emissionElapsedMs"}
DEMOS = {
    "zzvymDx5ty7": ("samples/property.zzvymDx5ty7.json", "samples/sources.zzvymDx5ty7.json"),
    "D9CVkjeMoQx": ("samples/property.yale.json", "samples/sources.yale.json"),
}


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


class NoContext(object):
    """The saved samples without the optional local CoStar file, so fingerprints do not depend on it."""

    def __init__(self):
        from noisemodel.pipeline import DatasetRepository
        self._inner = DatasetRepository()

    def read(self, name):
        return self._inner.read(name)

    def context(self, model_id):
        return None


def compute(extra_pipeline_keys=None):
    """Fingerprints of levels.json, the report and each key of the pipeline response.

    extra_pipeline_keys: keys added by the unit profile; they are left out so the remaining keys can be
    compared with the fingerprints taken on `main`.
    """
    from noisemodel import report
    from noisemodel.pipeline import NoiseModelPipeline
    from noisemodel.predict import predict, to_json
    skip = VOLATILE | set(extra_pipeline_keys or ())
    out = {}
    for model, (pp, sp) in DEMOS.items():
        with open(os.path.join(ROOT, pp)) as fh:
            prop = json.load(fh)
        with open(os.path.join(ROOT, sp)) as fh:
            sources = json.load(fh)
        result = predict(prop, sources)
        levels = to_json(result)
        md = report.render(prop, sources, result, {}, pp, sp)
        pipe = NoiseModelPipeline(NoContext()).run({"modelId": model})
        out[model] = {
            "levels_json": sha(levels),
            "report_md": sha(md),
            "pipeline": {k: sha(json.dumps(v, sort_keys=True, allow_nan=False))
                         for k, v in sorted(pipe.items()) if k not in skip},
        }
    return out


if __name__ == "__main__":
    data = compute()
    if "--write" in sys.argv:
        with open(FIXTURE, "w") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
            fh.write("\n")
        print("wrote", FIXTURE)
    else:
        print(json.dumps(data, indent=2, sort_keys=True))
