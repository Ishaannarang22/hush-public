"""Fresh model inputs/results over stdin/stdout, called by the end-to-end runner.
No network calls or credentials. Google/other providers populate sourceInputs later.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys
import time
from .matterport import build_property
from .predict import predict
from .export_lab import build as export_lab, SOURCE_SHAPES
from .assumptions import Assumptions
from .facade import incidence_constant
from . import profile as unit_profile
from .score import score as _quiet_score
from .crosscheck import status as crosscheck_status


def _score_of(result, prop, profile):
    """Quiet Score of an existing result, with the profile's range rule (no second model run)."""
    a = Assumptions.load()
    rng = unit_profile.ranges(profile, a)
    full = {r['id']: rng.get(r['id'], a.value('score.range_unconfirmed')) for r in result['rooms']}
    areas = {r['id']: float(r.get('area_m2') or 0.0) for r in prop['rooms']}
    return _quiet_score(result, a, full, areas)

ROOT = Path(__file__).resolve().parents[1]
PROFILE_CONTEXT_KEYS = ('yearBuilt', 'renovationYear', 'amenities', 'unitFloor', 'listingFeatures')
CATALOG = {
    'zzvymDx5ty7': {'raw': 'matterport_model_zzvymDx5ty7.json', 'survey': 'windows.zzvymDx5ty7.json', 'sources': 'sources.zzvymDx5ty7.json'},
    'D9CVkjeMoQx': {'property': 'property.yale.json', 'sources': 'sources.yale.json'},
}


class DatasetRepository:
    def read(self, name):
        with (ROOT / 'samples' / name).open() as f:
            return json.load(f)

    def context(self, model_id):
        path = ROOT / 'work/costar-kit/selected-acoustic-context.json'
        if not path.exists():
            return None
        with path.open() as f:
            rows = json.load(f).get('properties', [])
        row = next((r for r in rows if r.get('matterportModelId') == model_id), None)
        if not row:
            return None
        out = {k: row.get(k) for k in ('matterportModelId', 'name', 'stories', 'constructionMaterial')}
        # Unit profile, phase B: further keys pass through only when the local record has them, so a
        # record without them returns exactly what it did before.
        for k in PROFILE_CONTEXT_KEYS:
            if row.get(k) not in (None, '', []):
                out[k] = row[k]
        return out


class NoiseModelPipeline:
    def __init__(self, repository=None):
        self.repository = repository or DatasetRepository()

    def run(self, request):
        started = time.perf_counter()
        model_id = request.get('modelId', 'zzvymDx5ty7')
        if model_id not in CATALOG:
            raise ValueError('Choose a registered property; arbitrary filesystem paths are not accepted')
        entry = CATALOG[model_id]
        repo = self.repository
        raw, survey, warnings = None, None, []
        if 'raw' in entry:
            raw = repo.read(entry['raw'])
            survey = repo.read(entry['survey'])
            if 'openings' in request:
                survey['openings'] = copy.deepcopy(request['openings'])
            prop, warnings = build_property(raw, survey, response_path=entry['raw'], survey_path=entry['survey'])
        else:
            prop = repo.read(entry['property'])
            prop['matterport_model_id'] = model_id
            warnings.append('This property has room predictions only: registered wall geometry is not available for a spatial grid.')
        context = repo.context(model_id)
        if context:
            if isinstance(context.get('stories'), int) and context['stories'] > 0:
                prop['storeys'] = context['stories']
            prop['construction'] = context.get('constructionMaterial')
            warnings.append('CoStar construction is building-level context, not an assignment of every wall material.')
        sources = copy.deepcopy(request.get('sourceInputs', repo.read(entry['sources'])))
        if not isinstance(sources, dict):
            raise ValueError('sourceInputs must be an object')
        for key in ('roads', 'construction', 'flights', 'rail', 'mechanical', 'barriers'):
            rows = sources.get(key) or []
            if not isinstance(rows, list) or len(rows) > 500:
                raise ValueError('%s must contain at most 500 records' % key)
        # Field-test readings validate the model; they never override normal emissions.
        sources.pop('measured', None)
        # Unit profile (issue #36). It is "in use" only when the request carries edits (an empty list
        # counts); then every output below is computed from the profile-applied property. Without edits
        # the existing outputs are exactly as before and the profile and score are added alongside.
        in_use = 'edits' in request or 'buildingEdits' in request
        auto = unit_profile.build(prop, sources, context)
        comparison, merged, original = None, [], prop
        if in_use:
            merged = unit_profile.merge_edits(request.get('buildingEdits'), request.get('edits'))
            if len(merged) > 200:
                raise ValueError('At most 200 profile edits are accepted')
            comparison = unit_profile.compare(prop, sources, auto, merged)
            prop = comparison['edited']['property']
        result = predict(prop, sources, with_fixes=False)
        lab, targets = export_lab(prop, sources, result=result)
        signature = hashlib.sha256(json.dumps({'property': prop, 'sources': sources}, sort_keys=True, allow_nan=False).encode()).hexdigest()
        response = {
            'schemaVersion': 1, 'modelId': model_id, 'property': prop,
            'rooms': raw['data']['model']['rooms'] if raw else [],
            'survey': survey, 'sourceInputs': sources, 'labSources': lab,
            'referenceTargets': targets, 'outdoor': result['outdoor'],
            'sourceShapes': SOURCE_SHAPES,
            'incidenceDb': incidence_constant(Assumptions.load()),
            'legacyRoomPrediction': result, 'context': context,
            'warnings': warnings + result.get('warnings', []) + lab.get('omitted', []),
            'inputHash': signature, 'emissionElapsedMs': round((time.perf_counter()-started)*1000, 2),
        }
        response.update(self.profile_outputs(original, prop, sources, auto, comparison, merged, result))
        response['emissionElapsedMs'] = round((time.perf_counter()-started)*1000, 2)
        return response

    @staticmethod
    def profile_outputs(original, prop, sources, auto, comparison, merged, result):
        """profile, score and scoreCrosscheck for every run; baseline, changes and worthChecking with edits.

        original: the property before the profile; prop: the property the outputs above were computed from.
        """
        check = crosscheck_status()
        if comparison is None:
            p2, s2, log = unit_profile.apply(prop, sources, auto, [])
            profile = unit_profile.build(p2, s2, None, result=result)
            profile = unit_profile._relabel(profile, auto)
            if log['data']:
                _, sc = unit_profile.run_profile(p2, s2, log['profile'])
            else:
                sc = _score_of(result, prop, log['profile'])
            sc['basis'] = 'auto-filled profile'
            sc['crosscheck_notice'] = check['notice']
            return {'profile': dict(profile, dataChanges=log['data']), 'score': sc, 'scoreCrosscheck': check}
        edited = comparison['edited']
        sc = edited['score']
        sc['basis'] = 'auto-filled profile with edits'
        sc['crosscheck_notice'] = check['notice']
        base = comparison['baseline']['score']
        base['crosscheck_notice'] = check['notice']
        profile = unit_profile._relabel(unit_profile.build(edited['property'], sources, None, result=result),
                                        edited['profile'])
        return {
            'profile': dict(profile, dataChanges=comparison['baseline']['data_changes']),
            'score': sc, 'scoreCrosscheck': check,
            'baseline': {'score': base, 'profile': comparison['baseline']['profile']},
            'changes': [{k: c[k] for k in ('edit', 'text', 'unit_change', 'room_changes', 'rejected', 'flags')}
                        for c in comparison['changes']],
            'totalChange': comparison['total_change'],
            'editsRejected': edited['rejected'], 'editFlags': edited['flags'],
            'worthChecking': unit_profile.worth_checking(original, sources, auto, merged),
        }


def main():
    try:
        request = json.load(sys.stdin)
        result = NoiseModelPipeline().run(request)
        json.dump(result, sys.stdout, allow_nan=False)
    except Exception as exc:
        json.dump({'error': str(exc)}, sys.stdout)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
