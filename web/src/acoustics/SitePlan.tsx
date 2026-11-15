import { useEffect, useRef } from "react";
import type { FieldResult, Point } from "./field";
import type { DemoSource } from "./demo";
import type { WallData } from "./engine/domain";
type Props = {
  openingWalls?: WallData[];
  selectedWall?: string;
  viewBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  polygons: Point[][];
  field: FieldResult | null;
  sources: DemoSource[];
  onMove: (id: string, p: Point) => void;
  opacity: number;
  grid: boolean;
  visible: boolean;
};
const stops = [
  [18, 56, 165],
  [2, 184, 166],
  [255, 176, 36],
  [245, 46, 36],
];
function color(db: number) {
  const t = Math.max(0, Math.min(0.9999, (db - 20) / 60)) * 3,
    i = Math.floor(t),
    f = t - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}
export default function SitePlan({
  openingWalls,
  selectedWall,
  viewBounds,
  polygons,
  field,
  sources,
  onMove,
  opacity,
  grid,
  visible,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    transform = useRef({ scale: 1, ox: 0, oz: 0 }),
    drag = useRef<string | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const draw = () => {
      const { width: w, height: h } = el.getBoundingClientRect(),
        ratio = window.devicePixelRatio || 1;
      el.width = w * ratio;
      el.height = h * ratio;
      const c = el.getContext("2d")!;
      c.scale(ratio, ratio);
      c.clearRect(0, 0, w, h);
      const pts = polygons.flat();
      if (!pts.length) return;
      const minX = viewBounds?.minX ?? Math.min(...pts.map((p) => p.x)) - 7,
        maxX = viewBounds?.maxX ?? Math.max(...pts.map((p) => p.x)) + 7,
        minZ = viewBounds?.minZ ?? Math.min(...pts.map((p) => p.z)) - 7,
        maxZ = viewBounds?.maxZ ?? Math.max(...pts.map((p) => p.z)) + 7;
      const scale = Math.min(w / (maxX - minX), h / (maxZ - minZ)) * 0.9,
        ox = (w - (maxX + minX) * scale) / 2,
        oz = (h - (maxZ + minZ) * scale) / 2;
      transform.current = { scale, ox, oz };
      const x = (v: number) => ox + v * scale,
        y = (v: number) => oz + v * scale;
      c.strokeStyle = "#ffffff07";
      c.lineWidth = 1;
      for (let a = Math.floor(minX); a <= maxX; a++) {
        c.beginPath();
        c.moveTo(x(a), y(minZ));
        c.lineTo(x(a), y(maxZ));
        c.stroke();
      }
      for (let a = Math.floor(minZ); a <= maxZ; a++) {
        c.beginPath();
        c.moveTo(x(minX), y(a));
        c.lineTo(x(maxX), y(a));
        c.stroke();
      }
      const path = () => {
        c.beginPath();
        for (const poly of polygons) {
          poly.forEach((p, i) =>
            i ? c.lineTo(x(p.x), y(p.z)) : c.moveTo(x(p.x), y(p.z)),
          );
          c.closePath();
        }
      };
      path();
      c.fillStyle = "#29363c";
      c.fill();
      if (field && visible) {
        const tile = document.createElement("canvas");
        tile.width = field.width;
        tile.height = field.height;
        const tc = tile.getContext("2d")!,
          im = tc.createImageData(field.width, field.height);
        for (let i = 0; i < field.db.length; i++) {
          if (!field.mask[i]) continue;
          const rgb = color(field.db[i]);
          im.data.set([...rgb, Math.round(opacity * 255)], i * 4);
        }
        tc.putImageData(im, 0, 0);
        c.save();
        path();
        c.clip();
        c.imageSmoothingEnabled = false;
        c.drawImage(
          tile,
          x(field.minX),
          y(field.minZ),
          field.spanX * scale,
          field.spanZ * scale,
        );
        if (grid) {
          c.strokeStyle = "#eaffff40";
          c.lineWidth = 0.6;
          for (let a = field.minX; a <= field.minX + field.spanX; a += 0.5) {
            c.beginPath();
            c.moveTo(x(a), y(field.minZ));
            c.lineTo(x(a), y(field.minZ + field.spanZ));
            c.stroke();
          }
          for (let a = field.minZ; a <= field.minZ + field.spanZ; a += 0.5) {
            c.beginPath();
            c.moveTo(x(field.minX), y(a));
            c.lineTo(x(field.minX + field.spanX), y(a));
            c.stroke();
          }
        }
        c.restore();
      }
      path();
      c.strokeStyle = "#c6d7d3";
      c.lineWidth = 2;
      c.stroke();
      for (const wall of openingWalls ?? []) {
        if (wall.id === selectedWall) {
          c.strokeStyle = "#ffe68c";
          c.lineWidth = 7;
          c.beginPath();
          c.moveTo(x(wall.a.x), y(wall.a.z));
          c.lineTo(x(wall.b.x), y(wall.b.z));
          c.stroke();
        }
        const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
        for (const o of wall.openings) {
          const a = (o.centerM - o.widthM / 2) / len,
            b = (o.centerM + o.widthM / 2) / len;
          c.strokeStyle =
            o.kind === "window"
              ? "#83d9ff"
              : o.state === "open"
                ? "#82e6b4"
                : "#e8b780";
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(
            x(wall.a.x + (wall.b.x - wall.a.x) * a),
            y(wall.a.z + (wall.b.z - wall.a.z) * a),
          );
          c.lineTo(
            x(wall.a.x + (wall.b.x - wall.a.x) * b),
            y(wall.a.z + (wall.b.z - wall.a.z) * b),
          );
          c.stroke();
        }
      }
      sources.forEach((s) => {
        c.globalAlpha = s.enabled ? 1 : 0.3;
        c.strokeStyle = s.color;
        c.fillStyle = s.color;
        if (s.enabled) {
          for (const radius of [1.2, 2.4, 3.6]) {
            c.globalAlpha = 0.16;
            c.beginPath();
            c.arc(x(s.x), y(s.z), radius * scale, 0, Math.PI * 2);
            c.stroke();
          }
        }
        c.globalAlpha = s.enabled ? 1 : 0.3;
        c.beginPath();
        c.arc(x(s.x), y(s.z), 8, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#101719";
        c.lineWidth = 3;
        c.stroke();
        c.lineWidth = 1;
        c.font = "600 12px system-ui";
        c.textAlign = "center";
        c.fillText(s.name, x(s.x), y(s.z) - 21);
        c.font = "10px system-ui";
        c.fillStyle = "#c5cecc";
        c.fillText(
          s.enabled ? `${s.level.toFixed(1)} dB at 1 m` : "Muted",
          x(s.x),
          y(s.z) + 26,
        );
      });
      c.globalAlpha = 1;
      c.fillStyle = "#829894";
      c.textAlign = "left";
      c.font = "10px system-ui";
      c.fillText("REAL FLOOR OUTLINES · SCENARIO SOURCE POSITIONS", 22, h - 23);
      c.strokeStyle = "#839793";
      c.beginPath();
      c.moveTo(w - 110, h - 27);
      c.lineTo(w - 110 + 2 * scale, h - 27);
      c.stroke();
      c.fillText("2 m", w - 110, h - 35);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    polygons,
    field,
    sources,
    opacity,
    grid,
    visible,
    openingWalls,
    viewBounds,
    selectedWall,
  ]);
  return (
    <canvas
      ref={canvas}
      className="lab-site-plan"
      aria-label="Floor noise map with draggable demo sources"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect(),
          t = transform.current,
          p = {
            x: (e.clientX - r.left - t.ox) / t.scale,
            z: (e.clientY - r.top - t.oz) / t.scale,
          };
        const s = sources.find(
          (s) => Math.hypot(s.x - p.x, s.z - p.z) * t.scale < 35,
        );
        if (s) {
          drag.current = s.id;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const r = e.currentTarget.getBoundingClientRect(),
          t = transform.current;
        onMove(drag.current, {
          x: (e.clientX - r.left - t.ox) / t.scale,
          z: (e.clientY - r.top - t.oz) / t.scale,
        });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}
