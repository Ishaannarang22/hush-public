import { useEffect, useRef, useState } from "react";
import type { SourceDataset } from "./integration/sources";
import type { RoomTarget } from "./integration/datasets";
import type { ProfileResult } from "./UnitProfilePanel";

export type PipelineResult = {
  runId: string;
  inputHash: string;
  elapsedMs: number;
  labSources: SourceDataset;
  roomTargets: { rooms: Record<string, RoomTarget> };
  warnings: string[];
  timings: { emissionsMs: number; roomBalanceMs: number };
} & ProfileResult;
export default function PipelinePanel({
  inputKey,
  onResult,
  onSourceInputs,
}: {
  inputKey: string;
  onResult: (result: PipelineResult, key: string) => void;
  onSourceInputs: (value: Record<string, unknown> | undefined) => void;
}) {
  const [retry, setRetry] = useState(0),
    [status, setStatus] = useState("Preparing calculation…");
  const [error, setError] = useState(""),
    [result, setResult] = useState<PipelineResult | null>(null);
  const callback = useRef(onResult);
  useEffect(() => {
    callback.current = onResult;
  });
  useEffect(() => {
    const ac = new AbortController();
    setStatus("Updating emissions and room predictions…");
    setError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/acoustics/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: inputKey,
          signal: ac.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Calculation failed");
        if (ac.signal.aborted) return;
        setResult(data);
        callback.current(data, inputKey);
        setStatus(
          `Updated in ${Math.round(data.elapsedMs)} ms · 5 time periods`,
        );
      } catch (e) {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : "Calculation failed");
          setStatus("Calculation unavailable");
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [inputKey, retry]);
  return (
    <details className="lab-notes lab-pipeline" open>
      <summary>End-to-end noise model</summary>
      <p role="status">{status}</p>
      <p>
        Outdoor emissions → measured walls and openings → frequency-dependent
        transmission → room predictions and floor grid.
      </p>
      <p>
        Materials and opening edits recalculate automatically. The floor grid
        updates separately as sources move.
      </p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setRetry((n) => n + 1)}>
        Recalculate model
      </button>{" "}
      <button
        disabled={!result}
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(result, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "hush-room-model-run.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download room calculation
      </button>
      <details>
        <summary>Emission inputs and assumptions</summary>
        <p>
          Google traffic data is unconnected. Import road, construction, flight,
          rail-level or mechanical inputs when available. No speech sources.
        </p>
        <p>
          <a href="/templates/emission-inputs.json" download>
            Empty emission-input template
          </a>
        </p>
        <label>
          Import emission inputs
          <input
            aria-label="Import emission inputs"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = JSON.parse(await file.text());
                if (!data || Array.isArray(data) || typeof data !== "object")
                  throw new Error("Expected an input object");
                onSourceInputs(data);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid inputs");
              }
            }}
          />
        </label>
        <button onClick={() => onSourceInputs(undefined)}>
          Restore sample emissions
        </button>
        <ul>
          {result?.warnings.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </details>
    </details>
  );
}
