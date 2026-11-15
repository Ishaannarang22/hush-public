"""Field test mode (docs/BUILD_BRIEF.md section 8a).

An optional `measured` block in sources.json gives a measured outdoor level at one wall. The outdoor
step is skipped for that wall, every other wall gets no sound, and everything after the wall (composite
facade, leaks, room absorption, room to room) is unchanged. The predicted indoor levels are compared with
measured indoor levels, after removing the background energy.
"""
from . import db, facade


def background_corrected(measured_dba, background_dba):
    """Measured level with the background energy removed; None if the background is as loud or louder."""
    return db.level(db.energy(measured_dba) - db.energy(background_dba))


def _position(position, level, a):
    if position == "2m_from_wall":
        refl = a.value("field_test.reflection_2m")
        return level - refl, ("2m_from_wall: the reading already contains the facade reflection, so %g dB is "
                              "removed to get the free-field level that R3 E1 starts from, so the reflection is "
                              "not counted twice." % refl)
    if position == "free_field":
        return level, "free_field: the reading is the free-field level of R3 E1, used with the normal constant."
    raise ValueError("outdoor_position must be '2m_from_wall' or 'free_field', not %r" % position)


def run(b, measured, a, warnings):
    wall_id = measured["wall"]
    if wall_id not in {w["id"] for w in b.walls}:
        raise ValueError("measured.wall %r is not an exterior wall of the property" % wall_id)
    mode = measured.get("mode") or "ambient"
    angle = measured.get("speaker_angle_deg")
    constant = facade.incidence_constant(a, mode, angle)
    outdoor_dba = float(measured["outdoor_dba"])
    free_field, rule = _position(measured.get("outdoor_position") or "free_field", outdoor_dba, a)
    F, _ = b.facade_energy({wall_id: [free_field]}, constant)
    E = b.solve(F)
    margin = a.value("field_test.background_margin")
    background = measured.get("indoor_background_dba") or {}
    rows = []
    for room_id, meas in sorted((measured.get("indoor_dba") or {}).items()):
        if meas is None:
            continue
        if room_id not in b.index:
            warnings.append("Field test: room %r is not in the property; skipped." % room_id)
            continue
        i = b.index[room_id]
        pred_raw = db.level(E[b.group_of[i], 0])
        bg = background.get(room_id)
        note = []
        not_reliable = False
        corrected = float(meas)
        if bg is not None:
            if meas - bg < margin:
                not_reliable = True
                note.append("not reliable: too close to background (%.1f dB above it, less than %g)"
                            % (meas - bg, margin))
            corrected = background_corrected(float(meas), float(bg))
            if corrected is None:
                note.append("measured level is not above the background")
        if pred_raw is not None and pred_raw < a.value("reporting.plausible_output_range")[0]:
            note.append("predicted level is below 15 dBA (model floor), so no difference is given")
            pred_raw = None
        pred = None if pred_raw is None else round(pred_raw, 2)
        meas_out = None if corrected is None else round(corrected, 1)
        rng = b.room_range(i)
        diff = None if (pred is None or meas_out is None) else round(pred - meas_out, 2)
        rows.append({
            "room": room_id,
            "predicted_dba": pred,
            "measured_dba": meas_out,
            "measured_raw_dba": float(meas),
            "background_dba": bg,
            "difference_db": diff,
            "predicted_reduction_db": None if pred is None else round(outdoor_dba - pred, 2),
            "measured_reduction_db": None if meas_out is None else round(outdoor_dba - meas_out, 2),
            "range_db": rng,
            "inside_range": diff is not None and abs(diff) <= rng,
            "not_reliable": not_reliable,
            "note": "; ".join(note),
        })
    return {
        "wall": wall_id,
        "mode": mode,
        "speaker_angle_deg": angle,
        "incidence_constant_db": round(constant, 2),
        "outdoor_dba": outdoor_dba,
        "outdoor_position": measured.get("outdoor_position") or "free_field",
        "position_rule": rule,
        "free_field_dba": round(free_field, 2),
        "walls_with_sound": [wall_id],
        "note": measured.get("note"),
        "rooms": rows,
    }
