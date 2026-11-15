import { MatterportSceneImporter } from "../src/acoustics/engine/importer.ts";
import { RoomEnergyModel } from "../server/room-energy.ts";
import { displayField } from "../src/acoustics/engine/grid.ts";
import { pointInPolygon } from "../src/acoustics/engine/geometry.ts";
import {
  energy,
  A_WEIGHTING,
  OCTAVES,
} from "../src/acoustics/engine/domain.ts";
const $ = (id) => document.getElementById(id);
const payload = JSON.parse($("model-data").textContent);
const modes = ["road", "construction", "rail", "aircraft", "mechanical"];
const names = {
  road: "Traffic",
  construction: "Construction",
  rail: "Rail",
  aircraft: "Aircraft",
  mechanical: "Equipment",
};
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const text = (id, s) => {
  $(id).textContent = s;
};
let selected = "",
  step = 0,
  view = "balance",
  scene,
  results,
  reference,
  activeData,
  field = null,
  sequence = 0,
  timer,
  transform;
let enabled = new Set(modes),
  gridSources = [];
const canvas = $("map"),
  ctx = canvas.getContext("2d");
const workerUrl = URL.createObjectURL(
  new Blob([$("worker-code").textContent], { type: "text/javascript" }),
);
let worker = null;
try {
  worker = new Worker(workerUrl);
  worker.onmessage = ({ data }) => {
    if (data.id !== sequence) return;
    if (data.error) {
      text("status", "Path calculation unavailable: " + data.error);
      return;
    }
    field = data.field;
    render();
    text(
      "status",
      `Room balance ready · path grid ${Math.round(field.elapsedMs)} ms · 24 × 24 samples`,
    );
  };
  worker.onerror = () =>
    text(
      "status",
      "Room balance is ready. This browser blocked the offline path worker.",
    );
} catch {
  text(
    "status",
    "Room balance is ready; path worker is unavailable in this viewer.",
  );
}
URL.revokeObjectURL(workerUrl);
const amount = (r, band = $("frequency").value) =>
  band === "A" ? r.dba : r.bandDb[+band];
const value = (v) => (v == null ? "—" : v.toFixed(1));
const levelToColor = (v) => {
  if (v == null) return "#273f35";
  const stops = [
      [58, 86, 142],
      [63, 154, 155],
      [184, 201, 135],
      [239, 184, 101],
      [223, 120, 94],
    ],
    f = Math.max(0, Math.min(3.999, ((v - 20) / 60) * 4)),
    i = Math.floor(f),
    t = f - i;
  return `rgb(${stops[i].map((v, j) => Math.round(v * (1 - t) + stops[i + 1][j] * t)).join(",")})`;
};
function prepareSources() {
  const data = payload[$("scenario").value];
  const available = new Set(
    data.outdoor.flatMap((w) =>
      Object.values(w.blocks).flatMap((b) => Object.keys(b.by_source)),
    ),
  );
  $("source-list").innerHTML = modes
    .filter((m) => available.has(m))
    .map(
      (m) =>
        `<label class="check"><input type="checkbox" data-mode="${m}" ${enabled.has(m) ? "checked" : ""}>${names[m]}${m === "aircraft" ? "<small>room estimate only</small>" : ""}</label>`,
    )
    .join("");
  $("source-list")
    .querySelectorAll("input")
    .forEach((el) =>
      el.addEventListener("change", () => {
        const m = el.dataset.mode;
        el.checked ? enabled.add(m) : enabled.delete(m);
        update();
      }),
    );
}
function makeScene(data, original = false) {
  const openings = structuredClone(data.openings);
  if (!original)
    for (const o of openings) {
      if (o.kind === "window") {
        o.state = $("window").checked ? "open" : "closed";
        o.widthM = +$("width").value;
      }
      if (o.doorType === "sliding_glass")
        o.state = $("glassdoor").checked ? "open" : "closed";
    }
  return new MatterportSceneImporter().import(
    data.modelId,
    data.rooms,
    {
      wallMaterial: original ? "plasterboard" : $("walls").value,
      floorMaterial: !original && $("carpet").checked ? "carpet" : "floor",
      windowMaterial: "glass",
      doorsOpen: original ? true : $("doors").checked,
      windowsOpen: false,
      assumedHeightM: 2.7,
      floorId: data.rooms[0].floor.id,
    },
    openings,
  ).scene;
}
function update() {
  try {
    activeData = payload[$("scenario").value];
    scene = makeScene(activeData);
    const gain = +$("gain").value,
      block = $("period").value;
    const outside = structuredClone(activeData.outdoor);
    for (const w of outside)
      for (const b of Object.values(w.blocks))
        for (const m of Object.keys(b.by_source)) {
          b.by_source[m] =
            enabled.has(m) && b.by_source[m] != null
              ? b.by_source[m] + gain
              : null;
        }
    results = new RoomEnergyModel(scene).run(
      activeData.property,
      activeData.rooms,
      outside,
      [block],
      activeData.incidenceDb,
      activeData.sourceShapes,
    );
    reference = new RoomEnergyModel(makeScene(activeData, true)).run(
      activeData.property,
      activeData.rooms,
      activeData.outdoor,
      [block],
      activeData.incidenceDb,
      activeData.sourceShapes,
    );
    if (!selected)
      selected =
        scene.regions.find((r) => results.rooms[r.id].name === "Bedroom")?.id ??
        scene.regions[0].id;
    $("room").innerHTML = scene.regions
      .map(
        (r) =>
          `<option value="${escape(r.id)}" ${r.id === selected ? "selected" : ""}>${escape(results.rooms[r.id].name)}</option>`,
      )
      .join("");
    text("gain-value", `${gain >= 0 ? "+" : ""}${gain} dB`);
    text("width-value", `${(+$("width").value).toFixed(2)} m`);
    gridSources = structuredClone(activeData.labSources.blocks[block]).filter(
      (s) => enabled.has(activeData.labSources.derivation[s.id].mode),
    );
    for (const s of gridSources)
      s.spectrumDbAt1m = s.spectrumDbAt1m.map((v) => v + gain);
    field = null;
    sequence++;
    clearTimeout(timer);
    render();
    text("status", "Room balance updated · refining sound paths…");
    const points = scene.regions.flatMap((r) => r.polygon),
      xs = points.map((p) => p.x),
      zs = points.map((p) => p.z);
    const bounds = {
      minX: Math.min(...xs),
      minZ: Math.min(...zs),
      spanX: Math.max(...xs) - Math.min(...xs),
      spanZ: Math.max(...zs) - Math.min(...zs),
    };
    timer = setTimeout(() => {
      if (worker)
        worker.postMessage({
          id: sequence,
          scene,
          request: {
            bounds,
            width: 24,
            height: 24,
            receiverHeightM: 1.2,
            floorId: scene.regions[0].floorId,
            sources: gridSources,
            options: {
              reflections: $("reflections").checked,
              diffraction: $("diffraction").checked,
            },
          },
        });
    }, 100);
  } catch (e) {
    text("status", `Could not calculate this scenario: ${String(e)}`);
  }
}
function explain() {
  const b = $("period").value,
    room = results.rooms[selected],
    band = $("frequency").value === "A" ? 4 : +$("frequency").value;
  const window = scene.surfaces
    .flatMap((s) => (s.kind === "wall" ? s.openings : []))
    .find((o) => o.kind === "window");
  const glass = scene.materials.find((m) => m.id === window.materialId),
    tau =
      window.state === "open"
        ? 1
        : 10 ** (-glass.transmissionLossDb[band] / 10);
  const texts = [
    [
      "Start outside the building.",
      `${$("scenario").value === "traffic" ? "The saved traffic estimate" : "The illustrative five-source scenario"} supplies outdoor wall levels for this time period. Switching a source off removes its energy. The strength control applies a relative dB change; it does not fetch new traffic counts.`,
      `${enabled.size ? "+3 dB ≈ twice the sound energy" : "No enabled sources"} · independent sources combine in energy, not by adding dB`,
    ],
    [
      "A small opening can change a whole room.",
      `The bedroom window is ${(+$("width").value).toFixed(2)} × 1.59 m. ${window.state === "open" ? "Open area transmits freely in this model." : "Closed glass uses its own frequency-dependent transmission."} The remaining wall area uses the selected wall assembly.`,
      `${(+$("width").value * 1.59).toFixed(2)} m² glazing × ${(tau * 100).toFixed(window.state === "open" ? 0 : 3)}% energy transmission at ${OCTAVES[band]} Hz`,
    ],
    [
      "Rooms exchange sound in both directions.",
      `Sound entering one room can pass into another. Each room also absorbs energy at its walls, floor and ceiling, and can transmit it back outdoors. The solver balances these flows for every frequency band. ${room.name} currently averages ${value(room.blocks[b].dba)} dBA.`,
      `incoming + neighboring energy = absorbed + outgoing energy`,
    ],
    [
      "The route matters, and so does frequency.",
      `The grid traces direct/transmitted sound, a first reflection, and sound bending around an edge. Toggle the path contributions and choose a frequency. These are approximate energy paths, not animated pressure waves. Aircraft are omitted from this grid.`,
      `grid: 1.2 m listening height · 8 bands · independent path energies summed`,
    ],
  ];
  text("stage-title", texts[step][0]);
  text("stage-text", texts[step][1]);
  text("stage-equation", texts[step][2]);
}
function render() {
  if (!results) return;
  const b = $("period").value,
    f = $("frequency").value,
    current = results.rooms[selected].blocks[b],
    base = reference.rooms[selected].blocks[b],
    v = amount(current),
    bv = amount(base);
  text("level", value(v));
  text("unit", f === "A" ? "dBA" : "dB");
  text(
    "delta",
    v == null
      ? "No modeled source energy"
      : bv == null
        ? "No baseline source energy"
        : `${v - bv >= 0 ? "+" : ""}${(v - bv).toFixed(1)} dB vs original conditions for this scenario / time`,
  );
  $("room-list").innerHTML = scene.regions
    .map(
      (r) =>
        `<div class="room-row"><span>${escape(results.rooms[r.id].name)}</span><b>${value(amount(results.rooms[r.id].blocks[b]))} ${f === "A" ? "dBA" : "dB"}</b></div>`,
    )
    .join("");
  $("spectrum").innerHTML =
    [20, 40, 60, 80]
      .map(
        (n) =>
          `<line x1="0" y1="${104 - n}" x2="225" y2="${104 - n}" stroke="#e1e7db"/>`,
      )
      .join("") +
    current.bandDb
      .map((v, i) => {
        const h = v == null ? 0 : Math.max(0, Math.min(90, v));
        return `<rect x="${i * 28 + 3}" y="${104 - h}" width="19" height="${h}" rx="3" fill="${i === +f && f !== "A" ? "#ba763c" : "#56876a"}"/><text x="${i * 28 + 12}" y="120" text-anchor="middle" fill="#6b7c6e" font-size="9">${OCTAVES[i] < 1000 ? OCTAVES[i] : OCTAVES[i] / 1000 + "k"}</text>`;
      })
      .join("");
  $("spectrum").setAttribute(
    "aria-label",
    "Unweighted octave levels: " +
      current.bandDb
        .map((v, i) => `${OCTAVES[i]} Hz ${value(v)} dB`)
        .join(", "),
  );
  text(
    "map-description",
    view === "balance"
      ? "diffuse room estimates"
      : `listening-height path grid${!field ? " · updating" : ""}`,
  );
  for (const id of ["balance", "paths"])
    $(id).setAttribute("aria-pressed", String(id === view));
  document
    .querySelectorAll("[data-step]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(+el.dataset.step === step)),
    );
  explain();
  draw();
  pathContributions();
}
function pathContributions() {
  if (!field || !gridSources.length) {
    $("path-bars").innerHTML =
      '<p class="small">' +
      (field
        ? "No active sources in the path grid."
        : "Calculating path contributions…") +
      "</p>";
    return;
  }
  const region = scene.regions.find((r) => r.id === selected),
    band = $("frequency").value,
    totals = [0, 0, 0];
  for (let row = 0; row < field.height; row++)
    for (let col = 0; col < field.width; col++) {
      const i = row * field.width + col,
        x = field.minX + ((col + 0.5) / field.width) * field.spanX,
        z = field.minZ + ((row + 0.5) / field.height) * field.spanZ;
      if (
        !field.mask[i] ||
        !pointInPolygon(x, z, region.polygon) ||
        region.holes.some((h) => pointInPolygon(x, z, h))
      )
        continue;
      ["directDb", "reflectedDb", "diffractedDb"].forEach((key, k) => {
        for (let j = 0; j < 8; j++)
          if (band === "A" || j === +band)
            totals[k] += energy(
              field[key][i * 8 + j] + (band === "A" ? A_WEIGHTING[j] : 0),
            );
      });
    }
  const total = totals.reduce((a, b) => a + b, 0);
  $("path-bars").innerHTML = ["Transmitted", "Reflected", "Diffracted"]
    .map((name, i) => {
      const pct = total ? (totals[i] / total) * 100 : 0;
      return `<div><span>${name}</span><i style="width:${pct}%"></i><span>${pct.toFixed(0)}%</span></div>`;
    })
    .join("");
}
function draw() {
  if (!scene) return;
  const box = canvas.getBoundingClientRect(),
    w = box.width,
    h = box.height,
    dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const pts = scene.regions.flatMap((r) => r.polygon),
    minX = Math.min(...pts.map((p) => p.x)),
    minZ = Math.min(...pts.map((p) => p.z)),
    sx = Math.max(...pts.map((p) => p.x)) - minX,
    sz = Math.max(...pts.map((p) => p.z)) - minZ;
  const scale = Math.min((w - 60) / sx, (h - 50) / sz),
    ox = (w - sx * scale) / 2,
    oz = (h - sz * scale) / 2;
  transform = { minX, minZ, scale, ox, oz };
  const point = (p) => [ox + (p.x - minX) * scale, oz + (p.z - minZ) * scale];
  const path = (p) => {
    p.forEach((v, i) => {
      const [x, y] = point(v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  const block = $("period").value,
    band = $("frequency").value;
  for (const region of scene.regions) {
    ctx.beginPath();
    path(region.polygon);
    for (const hole of region.holes) path(hole);
    ctx.fillStyle =
      view === "balance"
        ? levelToColor(amount(results.rooms[region.id].blocks[block]))
        : "#273f35";
    ctx.fill("evenodd");
  }
  if (view === "paths" && field && gridSources.length) {
    const shown = displayField(field, band === "A" ? "A" : +band);
    for (let row = 0; row < field.height; row++)
      for (let col = 0; col < field.width; col++) {
        const i = row * field.width + col;
        if (!field.mask[i]) continue;
        const [x, y] = point({
          x: field.minX + (col / field.width) * field.spanX,
          z: field.minZ + (row / field.height) * field.spanZ,
        });
        ctx.fillStyle = levelToColor(shown.db[i]);
        ctx.fillRect(
          x,
          y,
          (field.spanX / field.width) * scale + 0.15,
          (field.spanZ / field.height) * scale + 0.15,
        );
      }
  }
  for (const wall of scene.surfaces.filter((s) => s.kind === "wall")) {
    const a = point(wall.a),
      b = point(wall.b);
    ctx.strokeStyle = "#d3e0cd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    for (const o of wall.openings) {
      const start = (o.centerM - o.widthM / 2) / length,
        end = (o.centerM + o.widthM / 2) / length;
      ctx.strokeStyle =
        o.kind === "window" || o.materialId === "glass"
          ? "#6de0d0"
          : o.state === "open"
            ? "#58776a"
            : "#c4b591";
      ctx.lineWidth = o.kind === "window" || o.materialId === "glass" ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start);
      ctx.lineTo(a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end);
      ctx.stroke();
    }
  }
  const selectedRegion = scene.regions.find((r) => r.id === selected);
  ctx.strokeStyle = "#fff8dc";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  path(selectedRegion.polygon);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const r of scene.regions) {
    const centroid = {
        x: r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length,
        z: r.polygon.reduce((s, p) => s + p.z, 0) / r.polygon.length,
      },
      [x, y] = point(centroid),
      name = results.rooms[r.id].name
        .replace("Kitchen and living", "Living / kitchen")
        .replace(/Untagged room .*/, "Entry");
    ctx.font = "600 11px system-ui";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#162d27";
    ctx.strokeText(name, x, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(name, x, y);
    if (view === "balance" && !["Entry", "Closet"].includes(name)) {
      ctx.font = "11px system-ui";
      const label =
        value(amount(results.rooms[r.id].blocks[block])) +
        " " +
        (band === "A" ? "dBA" : "dB");
      ctx.strokeText(label, x, y + 16);
      ctx.fillText(label, x, y + 16);
    }
  }
}
canvas.addEventListener("click", (event) => {
  if (!transform) return;
  const r = canvas.getBoundingClientRect(),
    t = transform,
    x = (event.clientX - r.left - t.ox) / t.scale + t.minX,
    z = (event.clientY - r.top - t.oz) / t.scale + t.minZ;
  const room = scene.regions.find(
    (r) =>
      pointInPolygon(x, z, r.polygon) &&
      !r.holes.some((h) => pointInPolygon(x, z, h)),
  );
  if (room) {
    selected = room.id;
    $("room").value = selected;
    render();
  }
});
for (const id of ["gain", "width"]) $(id).addEventListener("input", update);
for (const id of [
  "period",
  "walls",
  "window",
  "glassdoor",
  "doors",
  "carpet",
  "reflections",
  "diffraction",
])
  $(id).addEventListener("change", update);
$("scenario").addEventListener("change", () => {
  enabled = new Set(modes);
  prepareSources();
  update();
});
$("room").addEventListener("change", () => {
  selected = $("room").value;
  render();
});
$("frequency").addEventListener("change", render);
for (const id of ["balance", "paths"])
  $(id).addEventListener("click", () => {
    view = id;
    if (id === "paths") step = 3;
    render();
  });
document.querySelectorAll("[data-step]").forEach((el) =>
  el.addEventListener("click", () => {
    step = +el.dataset.step;
    view = step === 3 ? "paths" : "balance";
    render();
  }),
);
$("reset").addEventListener("click", () => {
  $("scenario").value = "traffic";
  $("period").value = "midday";
  $("gain").value = "0";
  $("width").value = "1.6";
  $("walls").value = "plasterboard";
  for (const id of ["window", "glassdoor", "carpet"]) $(id).checked = false;
  for (const id of ["doors", "reflections", "diffraction"])
    $(id).checked = true;
  $("frequency").value = "A";
  enabled = new Set(modes);
  step = 0;
  view = "balance";
  prepareSources();
  update();
});
new ResizeObserver(draw).observe(canvas.parentElement);
text(
  "build-date",
  new Date(payload.builtAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
);
prepareSources();
update();
