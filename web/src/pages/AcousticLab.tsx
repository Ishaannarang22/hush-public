import { useEffect, useMemo, useRef, useState } from "react";
import {
  roomPolygon,
  type ApiRoom,
  type BundleWindow,
  type MpSdk,
  type RoomInfo,
} from "../acoustics/matterport";
import type { Point } from "../acoustics/field";
import { acousticSource, type DemoSource } from "../acoustics/demo";
import {
  MatterportSceneImporter,
  parseOpeningDataset,
  type OpeningMeasurement,
} from "../acoustics/engine/importer";
import {
  displayField,
  type SpectralField,
  type DisplayBand,
} from "../acoustics/engine/grid";
import { OCTAVES } from "../acoustics/engine/domain";
import { MATERIALS } from "../acoustics/engine/materials";
import { createOverlay, type OverlayState } from "../acoustics/overlay";
import MeasuredFacadePanel from "../acoustics/MeasuredFacadePanel";
import SitePlan from "../acoustics/SitePlan";
import ModelComparison from "../acoustics/ModelComparison";
import PipelinePanel, { type PipelineResult } from "../acoustics/PipelinePanel";
import UnitProfilePanel, { type ProfileEdit } from "../acoustics/UnitProfilePanel";
import {
  modelSources,
  measuredOpenings,
  savedRooms,
  APARTMENT_ID,
} from "../acoustics/integration/datasets";
import {
  EnvironmentalSourceAdapter,
  TIME_BLOCKS,
  type TimeBlock,
} from "../acoustics/integration/sources";
import "./acoustic-lab.css";
type Model = { id: string; name: string };
async function readJson(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? "Request failed");
  return b;
}
export default function AcousticLab() {
  const [sourceMode, setSourceMode] = useState<"model" | "demo">("model");
  const [block, setBlock] = useState<TimeBlock>("midday");
  const [sourceAdapter, setSourceAdapter] = useState(modelSources);
  const [editedSources, setEditedSources] = useState(false);
  const [sourceInputs, setSourceInputs] = useState<
    Record<string, unknown> | undefined
  >();
  const [pipeline, setPipeline] = useState<{
    result: PipelineResult;
    key: string;
  } | null>(null);
  const emissionKey = useRef<string | null>(null);
  const [profileEdits, setProfileEdits] = useState<ProfileEdit[]>([]);
  const [surfaceMaterials, setSurfaceMaterials] = useState<
    Record<string, string>
  >({});
  const [selectedWall, setSelectedWall] = useState("");
  const [costar, setCostar] = useState<{
    constructionMaterial: string;
    stories: number;
    name: string;
  } | null>(null);
  const [models, setModels] = useState<Model[]>([]),
    [modelId, setModelId] = useState(""),
    [sdkKey, setSdkKey] = useState("");
  const [apiRooms, setApiRooms] = useState<ApiRoom[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quality, setQuality] = useState<"preview" | "detail">("preview");
  const [sources, setSources] = useState<DemoSource[]>([]),
    [spectral, setSpectral] = useState<SpectralField | null>(null);
  const [wallMaterial, setWallMaterial] = useState("plasterboard"),
    [opacity, setOpacity] = useState(0.85),
    [grid, setGrid] = useState(true),
    [visible, setVisible] = useState(true),
    [resolution, setResolution] = useState(48);
  const [sdkRooms, setSdkRooms] = useState<RoomInfo[]>([]),
    [floor, setFloor] = useState(0),
    [connected, setConnected] = useState(false);
  const stops = useRef<(() => void)[]>([]),
    connectionGeneration = useRef(0);
  const sourceHandles = useRef<HTMLDivElement>(null);
  const moveSource = useRef(move);
  useEffect(() => {
    moveSource.current = move;
  });
  const [floorMaterial, setFloorMaterial] = useState("floor"),
    [windowMaterial, setWindowMaterial] = useState("glass");
  const [doorsOpen, setDoorsOpen] = useState(true),
    [windowsOpen, setWindowsOpen] = useState(false);
  const [reflections, setReflections] = useState(true),
    [diffraction, setDiffraction] = useState(true),
    [receiverHeight, setReceiverHeight] = useState(1.2);
  const [displayBand, setDisplayBand] = useState<DisplayBand>("A"),
    [component, setComponent] = useState<
      "total" | "direct" | "reflected" | "diffracted"
    >("total");
  const [measurements, setMeasurements] = useState<OpeningMeasurement[]>([]),
    [progress, setProgress] = useState(0);
  const sceneRevision = useRef(0),
    openingFile = useRef<HTMLInputElement>(null);
  const floorId = apiRooms[0]?.floor?.id ?? "default";
  const imported = useMemo(() => {
    if (!apiRooms.length) return { value: null, error: "" };
    try {
      return {
        value: new MatterportSceneImporter().import(
          modelId,
          apiRooms,
          {
            wallMaterial,
            floorMaterial,
            windowMaterial,
            doorsOpen,
            windowsOpen,
            assumedHeightM: 2.7,
            floorId,
            surfaceMaterials,
          },
          measurements,
        ),
        error: "",
      };
    } catch (e) {
      return {
        value: null,
        error: e instanceof Error ? e.message : "Invalid geometry",
      };
    }
  }, [
    apiRooms,
    modelId,
    wallMaterial,
    floorMaterial,
    windowMaterial,
    doorsOpen,
    windowsOpen,
    floorId,
    measurements,
    surfaceMaterials,
  ]);
  const pipelineInputKey = JSON.stringify({
    modelId,
    sourceInputs,
    // Unit profile edits (issue #36). An empty list runs the auto-filled profile, which equals the
    // property file unless local CoStar context changes an input; the response then lists each change.
    edits: profileEdits,
    openings: measurements,
    scenario: {
      wallMaterial,
      floorMaterial,
      windowMaterial,
      doorsOpen,
      windowsOpen,
      assumedHeightM: 2.7,
      floorId,
      surfaceMaterials,
    },
  });
  const field = useMemo(
    () => (spectral ? displayField(spectral, displayBand, component) : null),
    [spectral, displayBand, component],
  );
  const [view, setView] = useState<"plan" | "tour">("plan");
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    displayedRequest = useRef(0),
    iframe = useRef<HTMLIFrameElement>(null),
    sdk = useRef<MpSdk | null>(null);
  const polygons = useMemo(
    () => apiRooms.map(roomPolygon).filter((p) => p.length >= 3),
    [apiRooms],
  );
  const bounds = useMemo(() => {
    const pts = polygons.flat();
    return pts.length
      ? {
          minX: Math.min(...pts.map((p) => p.x)),
          maxX: Math.max(...pts.map((p) => p.x)),
          minZ: Math.min(...pts.map((p) => p.z)),
          maxZ: Math.max(...pts.map((p) => p.z)),
        }
      : null;
  }, [polygons]);
  const alignment = useMemo(() => {
    if (!sdkRooms.length) return null;
    const errors = (sign: number) =>
      sdkRooms.flatMap((room) => {
        const raw = apiRooms.find((r) => r.id === room.id);
        if (!raw) return [];
        const p = roomPolygon(raw);
        if (!p.length) return [];
        return [
          Math.abs(Math.min(...p.map((v) => v.x)) - room.bounds.min.x) +
            Math.abs(Math.max(...p.map((v) => v.x)) - room.bounds.max.x) +
            Math.abs(
              Math.min(...p.map((v) => v.z * sign)) - room.bounds.min.z,
            ) +
            Math.abs(Math.max(...p.map((v) => v.z * sign)) - room.bounds.max.z),
        ];
      });
    const positive = errors(1),
      negative = errors(-1),
      score = (list: number[]) => list.filter((v) => v < 1.5).length;
    const sign = score(positive) > score(negative) ? 1 : -1,
      chosen = sign === 1 ? positive : negative;
    return chosen.length >= 2 && score(chosen) >= Math.ceil(chosen.length * 0.6)
      ? sign
      : null;
  }, [apiRooms, sdkRooms]);
  const overlayState = useRef<OverlayState>({
    field: null,
    polygons: [],
    floor: 0,
    flipZ: 1,
    opacity: 1,
    grid: true,
    visible: false,
    sources: [],
  });
  useEffect(() => {
    overlayState.current = {
      field,
      polygons,
      floor,
      flipZ: alignment ?? 1,
      opacity,
      grid,
      visible: visible && alignment !== null,
      sources,
    };
  }, [field, polygons, floor, alignment, opacity, grid, visible, sources]);
  const sourceBounds = useMemo(() => {
    const original = sourceMode === "model" ? sourceAdapter.sources(block) : [];
    return {
      minX: Math.min(bounds?.minX ?? 0, ...original.map((s) => s.x)) - 10,
      maxX: Math.max(bounds?.maxX ?? 0, ...original.map((s) => s.x)) + 10,
      minZ: Math.min(bounds?.minZ ?? 0, ...original.map((s) => s.z)) - 10,
      maxZ: Math.max(bounds?.maxZ ?? 0, ...original.map((s) => s.z)) + 10,
    };
  }, [bounds, sourceMode, sourceAdapter, block]);
  function defaults() {
    if (!bounds) return;
    setEditedSources(false);
    if (sourceMode === "model") {
      setSources(sourceAdapter.sources(block));
      return;
    }
    const b = bounds;
    setSources([
      {
        id: "road",
        name: "Traffic",
        x: b.minX - 4,
        z: (b.minZ + b.maxZ) / 2,
        level: 82,
        enabled: true,
        color: "#edb979",
      },
      {
        id: "works",
        name: "Construction",
        x: b.maxX + 4,
        z: b.minZ + 1,
        level: 88,
        enabled: true,
        color: "#f47d6b",
      },
      {
        id: "hvac",
        name: "Outdoor AC",
        x: (b.minX + b.maxX) / 2,
        z: b.maxZ + 4,
        level: 74,
        enabled: true,
        color: "#72c8c0",
      },
    ]);
  }
  useEffect(() => {
    const ac = new AbortController();
    setModels([
      { id: APARTMENT_ID, name: "Volterra at West Lake · 1BR / 664 SF" },
    ]);
    setModelId(APARTMENT_ID);
    readJson("/api/matterport/config", ac.signal)
      .then((c) => setSdkKey(c.sdkKey))
      .catch(() => {});
    readJson("/api/property-context", ac.signal)
      .then((d) =>
        setCostar(
          d.properties?.find(
            (p: { matterportModelId: string }) =>
              p.matterportModelId === APARTMENT_ID,
          ) ?? null,
        ),
      )
      .catch(() => {});
    return () => ac.abort();
  }, []);
  useEffect(() => {
    if (!modelId) return;
    const ac = new AbortController();
    setApiRooms([]);
    setSpectral(null);
    setSources([]);
    setError("");
    // Use the same saved geometry as Alejandro's model so wall IDs and surveys match.
    setApiRooms(modelId === APARTMENT_ID ? savedRooms : []);
    setMeasurements(modelId === APARTMENT_ID ? measuredOpenings : []);
    setSurfaceMaterials({});
    return () => ac.abort();
  }, [modelId]);
  // Reset demo positions only when the property's actual boundaries change.
  useEffect(() => {
    defaults();
  }, [bounds, sourceMode, sourceAdapter, block]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const w = new Worker(
      new URL("../acoustics/field.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = w;
    w.onmessage = (e) => {
      const data = e.data;
      if (data.revision !== sceneRevision.current || data.type === "ready")
        return;
      if (data.type === "progress") {
        if (data.id === request.current) setProgress(data.progress);
        return;
      }
      if (data.type === "error") {
        if (data.id === undefined || data.id === request.current) {
          setBusy(false);
          setError(data.error);
        }
        return;
      }
      // A completed preview may lag the pointer by one small job. Display it
      // while the newest input computes, but never regress to an older result.
      if (data.type === "result" && data.id >= displayedRequest.current) {
        displayedRequest.current = data.id;
        setSpectral(data.result);
        setQuality(data.phase);
        setBusy(data.phase !== "detail" || data.id !== request.current);
        if (data.phase === "detail" && data.id === request.current)
          setProgress(1);
        setError("");
      }
    };
    w.onerror = () => {
      setBusy(false);
      setError("Local calculation failed. Reload to retry.");
    };
    return () => w.terminate();
  }, []);
  useEffect(() => {
    const revision = ++sceneRevision.current;
    request.current++;
    displayedRequest.current = request.current;
    worker.current?.postMessage({ type: "cancel" });
    setSpectral(null);
    if (imported.value)
      worker.current?.postMessage({
        type: "scene",
        scene: imported.value.scene,
        revision,
      });
  }, [imported]);
  useEffect(() => {
    const id = ++request.current;
    if (!imported.value || !bounds || !sources.length) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setProgress(0);
    const spanX = bounds.maxX - bounds.minX,
      spanZ = bounds.maxZ - bounds.minZ;
    const width = Math.max(
        8,
        Math.round((resolution * spanX) / Math.max(spanX, spanZ)),
      ),
      height = Math.max(
        8,
        Math.round((resolution * spanZ) / Math.max(spanX, spanZ)),
      );
    worker.current?.postMessage({
      type: "compute",
      id,
      revision: sceneRevision.current,
      request: {
        bounds: { minX: bounds.minX, minZ: bounds.minZ, spanX, spanZ },
        width,
        height,
        floorId,
        receiverHeightM: receiverHeight,
        sources: sources.map(acousticSource),
        options: { reflections, diffraction },
      },
    });
  }, [
    imported,
    bounds,
    sources,
    resolution,
    reflections,
    diffraction,
    receiverHeight,
    floorId,
  ]);
  useEffect(() => {
    setConnected(false);
    setSdkRooms([]);
    return () => {
      connectionGeneration.current++;
      stops.current
        .splice(0)
        .reverse()
        .forEach((fn) => fn());
      sdk.current = null;
    };
  }, [view, modelId]);
  function update(id: string, patch: Partial<DemoSource>) {
    setEditedSources(true);
    setSources((list) =>
      list.map((s) =>
        s.id === id
          ? {
              ...s,
              ...patch,
              evidence: {
                kind: "assumed",
                source: s.evidence?.source ?? "Manual scenario",
                note: "Source edited in the lab; scenario values override the original source estimate.",
              },
            }
          : s,
      ),
    );
  }
  function move(id: string, p: Point) {
    if (!bounds) return;
    update(id, {
      x: Math.max(sourceBounds.minX, Math.min(sourceBounds.maxX, p.x)),
      z: Math.max(sourceBounds.minZ, Math.min(sourceBounds.maxZ, p.z)),
    });
  }
  async function connect() {
    const generation = connectionGeneration.current;
    try {
      const win = iframe.current?.contentWindow as BundleWindow;
      if (!win.MP_SDK) throw new Error("Viewer is still loading");
      const mp = await win.MP_SDK.connect(win);
      if (generation !== connectionGeneration.current) {
        mp.disconnect();
        return;
      }
      sdk.current = mp;
      stops.current.push(() => mp.disconnect());
      const roomSub = mp.Room.data.subscribe({
        onCollectionUpdated: (r) => setSdkRooms(Object.values(r)),
      });
      stops.current.push(() => roomSub.cancel());
      const sweepSub = mp.Sweep.data.subscribe({
        onCollectionUpdated: (r) => {
          const ys = Object.values(r)
            .map((v) => v.puckPosition?.y)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
          if (ys.length) setFloor(ys[Math.floor(ys.length / 2)]);
        },
      });
      stops.current.push(() => sweepSub.cancel());
      const stop = await createOverlay(
        mp,
        () => overlayState.current,
        sourceHandles.current!,
        (id, point) => moveSource.current(id, point),
      );
      if (generation !== connectionGeneration.current) {
        stop();
        return;
      }
      stops.current.push(stop);
      setConnected(true);
      await mp.App.state.waitUntil((s) => s.phase === mp.App.Phase.PLAYING);
      if (generation === connectionGeneration.current)
        await mp.Mode.moveTo(mp.Mode.Mode.FLOORPLAN);
    } catch (e) {
      if (generation === connectionGeneration.current)
        setError(
          `3D overlay: ${e instanceof Error ? e.message : "unable to connect"}. The noise map remains available.`,
        );
    }
  }

  const openingStates =
    imported.value?.scene.surfaces.flatMap((s) =>
      s.kind === "wall" ? s.openings : [],
    ) ?? [];
  const allDoorsOpen = openingStates
    .filter((o) => o.kind === "door")
    .every((o) => o.state === "open");
  const allWindowsOpen =
    openingStates.some((o) => o.kind === "window") &&
    openingStates
      .filter((o) => o.kind === "window")
      .every((o) => o.state === "open");
  const levels = field
      ? Array.from(field.db).filter((_, i) => field.mask[i])
      : [],
    active = sources.filter((s) => s.enabled).length;
  const range =
    levels.length && active
      ? `${Math.min(...levels) <= -119 ? "No path" : Math.round(Math.min(...levels))}–${Math.round(Math.max(...levels))}`
      : "—";
  return (
    <div className="acoustic-lab">
      <aside className="lab-sidebar">
        <div className="lab-eyebrow">
          <span /> LOCAL DEMO
        </div>
        <h1>
          Noise outside.
          <br />
          <span>Impact inside.</span>
        </h1>
        <p className="lab-intro">
          Outdoor source estimates meet measured walls and openings. Explore the
          resulting indoor sound field.
        </p>
        <label>
          Demo home
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {modelId && apiRooms.length > 0 && (
          <PipelinePanel
            inputKey={pipelineInputKey}
            onSourceInputs={setSourceInputs}
            onResult={(result, key) => {
              setPipeline({ result, key });
              const sourcesKey = JSON.stringify(result.labSources);
              if (emissionKey.current !== sourcesKey) {
                emissionKey.current = sourcesKey;
                setSourceAdapter(
                  new EnvironmentalSourceAdapter(result.labSources, modelId),
                );
                setSourceMode("model");
              }
            }}
          />
        )}
        {modelId && apiRooms.length > 0 && (
          <UnitProfilePanel
            result={pipeline?.result ?? null}
            current={pipeline?.key === pipelineInputKey}
            edits={profileEdits}
            onEdits={setProfileEdits}
            modelId={modelId}
          />
        )}
        <div className="lab-section-title">
          Outdoor sources{" "}
          <span>{sourceMode === "model" ? "Noise model" : "Illustrative"}</span>
        </div>
        <label>
          Source scenario
          <select
            aria-label="Source scenario"
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as "model" | "demo")}
          >
            <option value="model">Alejandro’s noise model</option>
            <option value="demo">Illustrative demo sources</option>
          </select>
        </label>
        <label>
          Time of day
          <select
            aria-label="Time of day"
            value={block}
            onChange={(e) => setBlock(e.target.value as TimeBlock)}
          >
            {Object.entries(TIME_BLOCKS).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="lab-intro">
          {sourceMode === "model"
            ? "Outdoor levels from the emissions model; frequency shape and equivalent source position are approximations. Changing time restores that period’s source scenario."
            : "Illustrative traffic, construction and equipment levels."}
        </p>
        {sourceAdapter.data.omitted?.map((note) => (
          <p className="lab-intro" key={note}>
            {note}
          </p>
        ))}
        <details className="lab-notes">
          <summary>External source data</summary>
          <p>
            Traffic / Google connection: pending. Construction, rail, aircraft
            and mechanical equipment accept equivalent point-source inputs.
            Missing data stays absent. Flight tracks and rail lines need an
            emission adapter before import.
          </p>
          <p>
            <a href="/templates/environmental-sources.json" download>
              Download empty source template
            </a>
          </p>
          <input
            aria-label="Import environmental sources"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setSourceAdapter(
                  new EnvironmentalSourceAdapter(
                    JSON.parse(await file.text()),
                    modelId,
                  ),
                );
                setSourceMode("model");
                setError("");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Invalid sources",
                );
              }
            }}
          />
        </details>
        {sources.map((s) => (
          <div
            className="lab-source-card"
            key={s.id}
            style={{ borderLeftColor: s.color }}
          >
            <div>
              <strong>{s.name}</strong>
              <button
                aria-label={`Toggle ${s.name}`}
                aria-pressed={s.enabled}
                onClick={() => update(s.id, { enabled: !s.enabled })}
              >
                {s.enabled ? "On" : "Muted"}
              </button>
            </div>
            <label>
              Level at 1 m <output>{s.level.toFixed(1)} dB</output>
              <input
                aria-label={`${s.name} level`}
                type="range"
                min="0"
                max={Math.max(130, Math.ceil(s.level))}
                value={s.level}
                step=".1"
                onChange={(e) => update(s.id, { level: +e.target.value })}
              />
            </label>
            <label>
              Source height <output>{(s.heightM ?? 1.5).toFixed(1)} m</output>
              <input
                aria-label={`${s.name} height`}
                type="range"
                min={Math.min(-10, s.heightM ?? 0)}
                max={Math.max(100, s.heightM ?? 0)}
                step=".1"
                value={s.heightM ?? 1.5}
                onChange={(e) => update(s.id, { heightM: +e.target.value })}
              />
            </label>
            <div className="lab-source-grid">
              <label>
                Left / right
                <input
                  aria-label={`${s.name} left right`}
                  type="range"
                  min={sourceBounds.minX}
                  max={sourceBounds.maxX}
                  step=".1"
                  value={s.x}
                  onChange={(e) => move(s.id, { x: +e.target.value, z: s.z })}
                />
              </label>
              <label>
                Near / far
                <input
                  aria-label={`${s.name} near far`}
                  type="range"
                  min={sourceBounds.minZ}
                  max={sourceBounds.maxZ}
                  step=".1"
                  value={s.z}
                  onChange={(e) => move(s.id, { x: s.x, z: +e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
        <button className="lab-reset" onClick={defaults}>
          Reset source scenario
        </button>
        <div className="lab-divider" />
        <div className="lab-section-title">
          Acoustic model <span>Band-energy paths</span>
        </div>
        <label>
          Frequency view
          <select
            aria-label="Frequency view"
            value={String(displayBand)}
            onChange={(e) =>
              setDisplayBand(
                e.target.value === "total" || e.target.value === "A"
                  ? e.target.value
                  : +e.target.value,
              )
            }
          >
            <option value="A">Broadband · A-weighted</option>
            <option value="total">Broadband · unweighted</option>
            {OCTAVES.map((f, i) => (
              <option key={f} value={i}>
                {f} Hz octave band
              </option>
            ))}
          </select>
        </label>
        <label>
          Sound contribution
          <select
            aria-label="Sound contribution"
            value={component}
            onChange={(e) => setComponent(e.target.value as typeof component)}
          >
            <option value="total">Combined sound</option>
            <option value="direct">Direct / transmitted</option>
            <option value="reflected">Reflected paths only</option>
            <option value="diffracted">Diffracted paths only</option>
          </select>
        </label>
        <div className="lab-toggles">
          <button
            aria-pressed={reflections}
            onClick={() => setReflections(!reflections)}
          >
            Reflections
          </button>
          <button
            aria-pressed={diffraction}
            onClick={() => setDiffraction(!diffraction)}
          >
            Diffraction
          </button>
        </div>
        <label>
          Wall material · assumed
          <select
            aria-label="Wall material"
            value={wallMaterial}
            onChange={(e) => setWallMaterial(e.target.value)}
          >
            {MATERIALS.filter((m) =>
              ["plasterboard", "concrete"].includes(m.id),
            ).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Floor material · assumed
          <select
            aria-label="Floor material"
            value={floorMaterial}
            onChange={(e) => setFloorMaterial(e.target.value)}
          >
            {MATERIALS.filter((m) => ["floor", "carpet"].includes(m.id)).map(
              (m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Window material · assumed
          <select
            aria-label="Window material"
            value={windowMaterial}
            onChange={(e) => setWindowMaterial(e.target.value)}
          >
            <option value="glass">Single glazing</option>
          </select>
        </label>
        <div className="lab-toggles">
          <button
            aria-pressed={allDoorsOpen}
            onClick={() => {
              setDoorsOpen(!allDoorsOpen);
              setMeasurements((ms) =>
                ms.map((m) =>
                  m.kind === "door"
                    ? { ...m, state: !allDoorsOpen ? "open" : "closed" }
                    : m,
                ),
              );
            }}
          >
            All doors {allDoorsOpen ? "open" : "mixed / closed"}
          </button>
          <button
            aria-pressed={allWindowsOpen}
            disabled={!imported.value?.counts.windows}
            onClick={() => {
              setWindowsOpen(!allWindowsOpen);
              setMeasurements((ms) =>
                ms.map((m) =>
                  m.kind === "window"
                    ? { ...m, state: !allWindowsOpen ? "open" : "closed" }
                    : m,
                ),
              );
            }}
          >
            Windows {allWindowsOpen ? "open" : "mixed / closed"}
          </button>
        </div>
        <label>
          Listening height <output>{receiverHeight.toFixed(1)} m</output>
          <input
            aria-label="Listening height"
            type="range"
            min=".3"
            max="2"
            step=".1"
            value={receiverHeight}
            onChange={(e) => setReceiverHeight(+e.target.value)}
          />
        </label>
        <details className="lab-notes">
          <summary>Walls, doors & windows</summary>
          <p>
            {costar
              ? `${costar.name}: CoStar reports ${costar.stories} building storeys and ${costar.constructionMaterial.toLowerCase()} construction.`
              : "CoStar property context is unavailable in this session."}{" "}
            This does not identify each wall assembly. Surface materials below
            are scenario assumptions.
          </p>
          <label>
            Individual wall
            <select
              aria-label="Individual wall"
              value={selectedWall}
              onChange={(e) => setSelectedWall(e.target.value)}
            >
              <option value="">Choose a wall</option>
              {imported.value?.scene.surfaces
                .filter((s) => s.kind === "wall")
                .map((wall, i) => (
                  <option
                    key={wall.id}
                    value={wall.id}
                  >{`Wall ${i + 1} · ${wall.id.slice(0, 8)}`}</option>
                ))}
            </select>
          </label>
          {selectedWall && (
            <label>
              Wall material override
              <select
                aria-label="Wall material override"
                value={surfaceMaterials[selectedWall] ?? ""}
                onChange={(e) =>
                  setSurfaceMaterials((old) => {
                    const next = { ...old };
                    if (e.target.value) next[selectedWall] = e.target.value;
                    else delete next[selectedWall];
                    return next;
                  })
                }
              >
                <option value="">Use overall wall material</option>
                {MATERIALS.filter((m) =>
                  ["plasterboard", "concrete"].includes(m.id),
                ).map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {measurements.map((o) => (
            <div key={o.id} className="lab-opening-card">
              <strong>
                {o.id === "survey-bedroom-east-window"
                  ? "Bedroom window"
                  : o.doorType === "sliding_glass"
                    ? "Glazed sliding door"
                    : o.id}
              </strong>
              <p>
                {o.widthM.toFixed(2)} × {o.heightM.toFixed(2)} m ·{" "}
                {o.evidence.kind} geometry
              </p>
              <button
                aria-label={`Toggle ${o.id}`}
                aria-pressed={o.state === "open"}
                onClick={() =>
                  setMeasurements((ms) =>
                    ms.map((m) =>
                      m.id === o.id
                        ? {
                            ...m,
                            state: m.state === "open" ? "closed" : "open",
                          }
                        : m,
                    ),
                  )
                }
              >
                {o.state === "open" ? "Open" : "Closed"}
              </button>
              <label>
                Opening material · assumed
                <select
                  aria-label={`Material ${o.id}`}
                  value={
                    o.materialId ??
                    (o.kind === "window" || o.doorType === "sliding_glass"
                      ? windowMaterial
                      : "door")
                  }
                  onChange={(e) =>
                    setMeasurements((ms) =>
                      ms.map((m) =>
                        m.id === o.id
                          ? { ...m, materialId: e.target.value }
                          : m,
                      ),
                    )
                  }
                >
                  {MATERIALS.filter((m) =>
                    ["glass", "door"].includes(m.id),
                  ).map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <small>{o.evidence.note}</small>
            </div>
          ))}
        </details>
        <details className="lab-notes">
          <summary>Measurements & assumptions</summary>
          <p>
            {imported.value?.counts.walls ?? 0} walls ·{" "}
            {imported.value?.counts.doors ?? 0} doors ·{" "}
            {imported.value?.counts.openings ?? 0} openings ·{" "}
            {imported.value?.counts.windows ?? 0} windows.
          </p>
          {!imported.value?.counts.windows && (
            <p>
              No window measurements supplied for this model. Import them to
              include glazing and window apertures.
            </p>
          )}
          <input
            ref={openingFile}
            type="file"
            accept=".json,application/json"
            aria-label="Import opening measurements"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = parseOpeningDataset(await file.text(), modelId);
                setMeasurements(data.openings);
                setError("");
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Import failed",
                );
              }
            }}
          />
          {imported.value?.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <button
            className="lab-reset"
            onClick={() => {
              if (!imported.value) return;
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(imported.value.scene, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "hush-acoustic-scene.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export acoustic scene
          </button>
          <table className="lab-material-table">
            <caption>Wall coefficients · assumed</caption>
            <thead>
              <tr>
                <th>Hz</th>
                <th>Absorption</th>
                <th>TL dB</th>
              </tr>
            </thead>
            <tbody>
              {OCTAVES.map((f, i) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td>
                    {
                      MATERIALS.find((m) => m.id === wallMaterial)?.absorption[
                        i
                      ]
                    }
                  </td>
                  <td>
                    {
                      MATERIALS.find((m) => m.id === wallMaterial)
                        ?.transmissionLossDb[i]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <ModelComparison
          field={spectral}
          regions={imported.value?.scene.regions ?? []}
          block={block}
          freshTargets={pipeline?.result.roomTargets.rooms}
          current={pipeline?.key === pipelineInputKey}
          modified={
            editedSources ||
            sourceMode === "demo" ||
            JSON.stringify(sourceAdapter.data) !==
              JSON.stringify(pipeline?.result.labSources)
          }
        />
        <MeasuredFacadePanel />
        <label>
          Overlay opacity <output>{Math.round(opacity * 100)}%</output>
          <input
            aria-label="Overlay opacity"
            type="range"
            min=".1"
            max="1"
            step=".05"
            value={opacity}
            onChange={(e) => setOpacity(+e.target.value)}
          />
        </label>
        <label>
          Calculation detail
          <select
            value={resolution}
            onChange={(e) => setResolution(+e.target.value)}
          >
            <option value="48">Quick · 48 cells / edge</option>
            <option value="96">Balanced · 96 cells / edge</option>
            <option value="160">Fine · 160 cells / edge</option>
          </select>
        </label>
        <details className="lab-notes">
          <summary>Model scope & limits</summary>
          <p>
            Eight octave bands, 63–8000 Hz. Sound transmission follows the
            material at each intersection, including window glazing and open
            apertures. Reflections use first-order image sources; diffraction
            uses the strongest visible single-edge route and a Maekawa–Tatge
            screen approximation.
          </p>
          <p>
            This is a geometric, incoherent energy model, not a full-wave
            solution or a validated indoor-noise prediction. It excludes
            higher-order diffraction, late reverberation, room resonances,
            scattering, atmospheric refraction and furniture. Source provenance
            is retained; spectral shapes and material properties may be
            assumptions. The colors show a listening-height slice projected onto
            the floor.
          </p>
        </details>
      </aside>
      <section className="lab-viewport" aria-label="Acoustic visualization">
        <div className="lab-viewport-header">
          <div>
            <span className="lab-eyebrow">MATTERPORT × HUSH</span>
            <strong>
              {models.find((m) => m.id === modelId)?.name ??
                "Loading your space…"}
            </strong>
          </div>
          <div className="lab-camera-buttons">
            <button
              aria-pressed={view === "plan"}
              onClick={() => {
                setView("plan");
                setError("");
              }}
            >
              Noise map
            </button>
            <button
              aria-pressed={view === "tour"}
              onClick={() => setView("tour")}
            >
              3D floor overlay
            </button>
          </div>
        </div>
        <div className="lab-tour">
          {view === "plan" ? (
            <SitePlan
              polygons={polygons}
              viewBounds={sourceBounds}
              selectedWall={selectedWall}
              field={field}
              sources={sources}
              onMove={move}
              openingWalls={imported.value?.scene.surfaces.filter(
                (s) => s.kind === "wall",
              )}
              opacity={opacity}
              grid={grid}
              visible={visible}
            />
          ) : (
            <iframe
              ref={iframe}
              title="Matterport tour with floor noise overlay"
              src={`/matterport-bundle/showcase.html?${new URLSearchParams({ m: modelId, applicationKey: sdkKey, play: "1", qs: "1" })}`}
              onLoad={connect}
            />
          )}
          {view === "tour" && (
            <div ref={sourceHandles} className="lab-source-handles" />
          )}
          <div className="lab-status" role="status">
            <span className={error ? "status-dot error" : "status-dot"} />
            {imported.error ||
              error ||
              (polygons.length
                ? `${polygons.length} rooms · ${imported.value?.counts.walls ?? 0} walls · ${imported.value?.counts.windows ?? 0} window · 8 bands`
                : "Loading floor boundaries…")}
          </div>
          {view === "tour" && connected && alignment === null && (
            <div className="lab-error">
              Checking room alignment. Floor overlay waits for matching
              geometry.
            </div>
          )}
          {(view === "plan" || (connected && alignment !== null)) && (
            <div className="lab-drag-hint">
              Drag a colored source to move it · grid = 0.5 m
            </div>
          )}
          <div className="lab-performance">
            <span>
              {field ? `${field.elapsedMs.toFixed(1)} ms` : "Computing…"}
              <small>
                {busy
                  ? quality === "preview"
                    ? `LIVE PREVIEW · refining ${Math.round(progress * 100)}%`
                    : "UPDATING…"
                  : "DETAILED RESULT"}
              </small>
            </span>
            <span>
              {range}
              <small>
                {displayBand === "A" ? "MODEL dBA RANGE" : "MODEL dB RANGE"}
              </small>
            </span>
            <span>
              {field?.cells.toLocaleString() ?? "—"}
              <small>FLOOR SAMPLES</small>
            </span>
          </div>
        </div>
        <footer className="lab-toolbar">
          <div className="lab-legend">
            <span>
              {displayBand === "A"
                ? "Estimated level · dBA"
                : typeof displayBand === "number"
                  ? `${OCTAVES[displayBand]} Hz · band level dB`
                  : "Estimated level · unweighted dB"}
            </span>
            <div className="lab-gradient" />
            <div className="lab-scale">
              <span>20 · Quiet</span>
              <span>80 · Loud</span>
            </div>
          </div>
          <div className="lab-toggles">
            <button aria-pressed={visible} onClick={() => setVisible(!visible)}>
              Heatmap
            </button>
            <button aria-pressed={grid} onClick={() => setGrid(!grid)}>
              Grid
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
