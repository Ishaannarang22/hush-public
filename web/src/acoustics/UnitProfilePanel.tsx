import { useState } from "react";

/** One client change to a profile field (docs/UNIT_PROFILE.md, the edits file). */
export type ProfileEdit = {
  field: string;
  target?: string | null;
  value: string | number | null;
  edited_by: string;
  edited_at: string;
};
type Choice = { value: string; text: string };
type Field = {
  key: string;
  field: string;
  target: string | null;
  label_text: string;
  group: string;
  kind: "choice" | "number";
  value: string | number | null;
  value_text: string;
  label: string;
  note: string;
  choices?: Choice[];
  min?: number | null;
  max?: number | null;
  integer?: boolean;
  effect?: string;
  edited_by?: string;
  replaced?: { value: unknown; label: string };
  map_note?: string;
  element: {
    room_name: string;
    facing: string;
    wall: string;
    area_m2?: number;
  } | null;
};
type RoomScore = {
  id: string;
  name: string;
  type: string;
  score: number;
  range: [number, number];
  level_db: number | null;
  level_kind: string;
};
type Score = {
  unit: {
    score: number;
    range: [number, number];
    from: { room: string; name: string; weight: number }[];
  } | null;
  rooms: Record<string, RoomScore>;
  note: string;
  limits?: string[];
  crosscheck_notice?: string | null;
};
export type ProfileResult = {
  profile?: {
    fields: Field[];
    summary: string;
    groups: Record<string, string>;
    notes: string[];
  };
  score?: Score;
  baseline?: { score: Score };
  changes?: {
    text: string;
    unit_change: number | null;
    rejected: string | null;
    flags: string[];
  }[];
  totalChange?: number | null;
  worthChecking?: { key: string; text: string; spread: number }[];
  editsRejected?: { message: string; edit: ProfileEdit }[];
  scoreCrosscheck?: { status: string; line: string | null; notice: string | null };
};

const score = (n: number | undefined | null) =>
  n == null ? "—" : Math.round(n).toString();
const signed = (n: number | null) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
/** Score colour: red (loud) to green (quiet), for the room chips. */
const tone = (s: number) => `hsl(${Math.round((s / 100) * 125)} 55% 45%)`;
const where = (f: Field) =>
  f.element ? ` · ${f.element.room_name}, ${f.element.facing}-facing` : "";

function FieldControl({
  field,
  onEdit,
}: {
  field: Field;
  onEdit: (value: string | number | null) => void;
}) {
  const [draft, setDraft] = useState(String(field.value ?? ""));
  if (field.kind === "choice")
    return (
      <select
        aria-label={`${field.label_text}${where(field)}`}
        value={String(field.value ?? "")}
        onChange={(e) => onEdit(e.target.value)}
        autoFocus
      >
        {field.choices?.map((c) => (
          <option key={c.value} value={c.value}>
            {c.text}
          </option>
        ))}
      </select>
    );
  return (
    <form
      className="profile-number"
      onSubmit={(e) => {
        e.preventDefault();
        const v = draft.trim() === "" ? null : Number(draft);
        if (v === null || Number.isFinite(v)) onEdit(v);
      }}
    >
      <input
        aria-label={`${field.label_text}${where(field)}`}
        type="number"
        step={field.integer ? 1 : 0.01}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <button type="submit">Set</button>
    </form>
  );
}

export default function UnitProfilePanel({
  result,
  current,
  edits,
  onEdits,
  modelId,
}: {
  result: ProfileResult | null;
  current: boolean;
  edits: ProfileEdit[];
  onEdits: (edits: ProfileEdit[]) => void;
  modelId: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<"edited" | "data">("edited");
  const [who, setWho] = useState("resident");
  const [error, setError] = useState("");
  const profile = result?.profile;
  if (!profile || !result?.score)
    return (
      <details className="lab-notes lab-profile" open>
        <summary>Unit profile and Quiet Score</summary>
        <p role="status">Waiting for the noise model…</p>
      </details>
    );
  const hasEdits = edits.length > 0 && !!result.baseline;
  const shown = view === "data" && hasEdits ? result.baseline!.score : result.score;
  const unit = shown.unit;
  const groups = Object.entries(profile.groups);
  const edit = (f: Field, value: string | number | null) => {
    setEditing(null);
    if (value === f.value) return;
    onEdits([
      ...edits,
      {
        field: f.field,
        ...(f.target ? { target: f.target } : {}),
        value,
        edited_by: who,
        edited_at: new Date().toISOString(),
      },
    ]);
    setView("edited");
  };
  const undo = (f: Field) =>
    onEdits(
      edits.filter(
        (e) => !(e.field === f.field && (e.target ?? null) === f.target),
      ),
    );
  return (
    <details className="lab-notes lab-profile" open>
      <summary>Unit profile and Quiet Score</summary>
      {result.scoreCrosscheck?.notice && (
        <p className="profile-alert" role="note">
          {result.scoreCrosscheck.notice}
        </p>
      )}
      <div className="profile-score" aria-live="polite">
        <strong data-testid="quiet-score">{score(unit?.score)}</strong>
        <span>
          Quiet Score
          {unit
            ? `, likely ${score(unit.range[0])} to ${score(unit.range[1])}`
            : ""}
          {!current && " · updating…"}
        </span>
      </div>
      <p>{profile.summary}.</p>
      <p className="profile-small">{shown.note}</p>
      {shown.limits?.map((l, i) => (
        <p key={i} className="profile-small" data-testid="score-limit">
          Limit: {l}
        </p>
      ))}
      {hasEdits && (
        <div className="profile-toggle" role="group" aria-label="Score view">
          <button
            aria-pressed={view === "data"}
            onClick={() => setView("data")}
          >
            From data · {score(result.baseline!.score.unit?.score)}
          </button>
          <button
            aria-pressed={view === "edited"}
            onClick={() => setView("edited")}
          >
            With your changes · {score(result.score.unit?.score)}
          </button>
        </div>
      )}
      <ul className="profile-rooms" aria-label="Room scores">
        {Object.values(shown.rooms).map((r) => (
          <li key={r.id}>
            <i style={{ background: tone(r.score) }} />
            {r.name} <b>{score(r.score)}</b>
            <span>
              {r.level_db == null ? "below 15" : r.level_db.toFixed(1)} dB{" "}
              {r.level_kind === "DNL" ? "DNL" : "overnight"}
            </span>
          </li>
        ))}
      </ul>
      {!!result.worthChecking?.length && (
        <>
          <div className="lab-section-title">Worth checking</div>
          <ol className="profile-worth">
            {result.worthChecking
              .filter((w) => w.spread >= 0.5)
              .slice(0, 3)
              .map((w) => (
                <li key={w.key}>
                  <button
                    className="profile-link"
                    onClick={() => setEditing(w.key)}
                  >
                    {w.text}
                  </button>
                </li>
              ))}
          </ol>
        </>
      )}
      {!!result.changes?.length && (
        <>
          <div className="lab-section-title">
            What changed <span>{signed(result.totalChange ?? null)}</span>
          </div>
          <ul className="profile-changes">
            {result.changes.map((c, i) => (
              <li key={i}>
                {c.text}:{" "}
                {c.rejected ? (
                  <em role="alert">rejected. {c.rejected}</em>
                ) : (
                  <b>{signed(c.unit_change)}</b>
                )}
                {c.flags.map((f, j) => (
                  <em key={j}> {f}</em>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
      <label>
        Editing as
        <select
          aria-label="Editing as"
          value={who}
          onChange={(e) => setWho(e.target.value)}
        >
          <option value="resident">Resident (this unit)</option>
          <option value="owner">Owner</option>
          <option value="manager">Property manager</option>
        </select>
      </label>
      {groups.map(([group, title]) => {
        const rows = profile.fields.filter((f) => f.group === group);
        if (!rows.length) return null;
        return (
          <div key={group} className="profile-group">
            <div className="lab-section-title">{title}</div>
            <ul className="profile-fields">
              {rows.map((f) => (
                <li key={f.key} data-key={f.key}>
                  <div className="profile-field-name">
                    {f.label_text}
                    {f.element && (
                      <small>
                        {f.element.room_name}, {f.element.facing}-facing
                      </small>
                    )}
                  </div>
                  {editing === f.key ? (
                    <FieldControl field={f} onEdit={(v) => edit(f, v)} />
                  ) : (
                    <button
                      className="profile-value"
                      title={`${f.note}${f.map_note ? `. ${f.map_note}` : ""}`}
                      onClick={() => setEditing(f.key)}
                    >
                      {f.value_text}
                    </button>
                  )}
                  <span className={`profile-tag profile-tag-${f.label}`}>
                    {f.label}
                  </span>
                  {f.label === "edited" && (
                    <button
                      className="profile-link"
                      aria-label={`Undo ${f.label_text}${where(f)}`}
                      onClick={() => undo(f)}
                    >
                      undo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!!result.editsRejected?.length && (
        <ul>
          {result.editsRejected.map((r, i) => (
            <li key={i} role="alert">
              {r.message}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="profile-actions">
        <button
          disabled={!edits.length}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [JSON.stringify({ schemaVersion: 1, modelId, edits }, null, 2)],
                { type: "application/json" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `edits.${modelId}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Share edits
        </button>{" "}
        <button disabled={!edits.length} onClick={() => onEdits([])}>
          Undo all
        </button>
        <label>
          Import edits
          <input
            aria-label="Import profile edits"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const doc = JSON.parse(await file.text());
                const list = Array.isArray(doc) ? doc : doc?.edits;
                if (!Array.isArray(list)) throw new Error("Expected an edits file");
                setError("");
                onEdits(list);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid edits");
              }
            }}
          />
        </label>
      </div>
      {profile.notes.map((n, i) => (
        <p key={i} className="profile-small">
          {n}
        </p>
      ))}
    </details>
  );
}
