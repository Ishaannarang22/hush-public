import type * as THREE from "three";
import type { Point } from "./field.ts";
export type Vec3 = { x: number; y: number; z: number };
export type RoomInfo = {
  id: string;
  label: string;
  bounds: { min: Vec3; max: Vec3 };
  center: Vec3;
  size: Vec3;
  floorInfo: { id: string; sequence: number };
};
type Subscription = { cancel(): void };
export type SceneObject = {
  addNode(): { addComponent(name: string): unknown };
  start(): void;
  stop(): void;
};
export type SceneComponent = {
  outputs: { objectRoot?: THREE.Object3D };
  context: { three: typeof THREE; camera: THREE.Camera };
  onInit?(): void;
  onTick?(delta: number): void;
  onDestroy?(): void;
};
export type MpSdk = {
  Scene: {
    register(
      name: string,
      factory: () => SceneComponent,
    ): Promise<{ dispose(): void } | null>;
    createObjects(n: number): Promise<SceneObject[]>;
  };
  Room: {
    data: {
      subscribe(observer: {
        onCollectionUpdated(collection: Record<string, RoomInfo>): void;
      }): Subscription;
    };
  };
  Sweep: {
    data: {
      subscribe(observer: {
        onCollectionUpdated(
          collection: Record<
            string,
            {
              puckPosition: Vec3;
              roomInfo: { id?: string };
              floorInfo: { id?: string };
            }
          >,
        ): void;
      }): Subscription;
    };
  };
  Mode: {
    Mode: { DOLLHOUSE: string; INSIDE: string; FLOORPLAN: string };
    moveTo(mode: string): Promise<unknown>;
  };
  App: {
    state: {
      waitUntil(test: (state: { phase: string }) => boolean): Promise<unknown>;
    };
    Phase: { PLAYING: string };
  };
  disconnect(): void;
};
export type BundleWindow = Window & {
  MP_SDK: { connect(target: Window): Promise<MpSdk> };
};
export type ApiOpening = {
  id: string;
  type: string;
  width: number;
  height?: number;
  lowerElevation?: number;
  relativeCenter: number;
};
export type ApiEdge = {
  id?: string;
  type?: string;
  thickness?: number;
  openings?: ApiOpening[];
  vertices: { position: { x: number; y: number } }[];
};
export type ApiRoom = {
  id: string;
  label?: string;
  floor?: { id: string; sequence: number; label?: string };
  dimensions?: { height?: number; units: string };
  dimensionEstimates?: {
    height?: number;
    lowerElevation?: number;
    units: string;
  };
  boundary?: { edges: ApiEdge[] };
  holes?: { edges: ApiEdge[] }[];
};
/** Boundary edges are not ordered. Stitch by endpoint rather than drawing a convex hull. */
export function roomPolygon(room: ApiRoom): Point[] {
  let edges = (room.boundary?.edges ?? [])
    .filter((e) => e.vertices.length >= 2)
    .map((e) => e.vertices.map((v) => ({ x: v.position.x, z: v.position.y })));
  if (!edges.length) return [];
  const same = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z) < 0.015;
  // Live scans can include internal wall stubs in boundary.edges. Peel only
  // dangling edges before walking the outline. The importer retains those walls
  // for acoustics; missing boundary segments are never bridged or invented.
  edges=edges.filter(e=>!same(e[0],e[e.length-1]));
  let changed=true;
  while(changed&&edges.length){
    const retained=edges.filter((edge,i)=>[edge[0],edge[edge.length-1]].every(p=>
      edges.some((other,j)=>i!==j&&(same(p,other[0])||same(p,other[other.length-1])))));
    changed=retained.length!==edges.length;edges=retained;
  }
  if(!edges.length)return [];
  const pending = edges.slice(),
    first = pending.shift()!,
    points = [first[0], first[first.length - 1]];
  while (pending.length) {
    const last = points[points.length - 1];
    const index = pending.findIndex(
      (e) => same(e[0], last) || same(e[e.length - 1], last),
    );
    if (index < 0) break;
    const edge = pending.splice(index, 1)[0];
    points.push(same(edge[0], last) ? edge[edge.length - 1] : edge[0]);
    if (same(points[points.length - 1], points[0])) {
      points.pop();
      return points;
    }
  }
  return []; // incomplete boundaries must not silently produce a false floor
}
export function alignPolygon(poly: Point[], room: RoomInfo): Point[] {
  // GraphQL floor plans use x/y; Showcase uses x/z. Choose the handedness that
  // matches the SDK room bounds, then reject misaligned metadata.
  const options = [poly, poly.map((p) => ({ x: p.x, z: -p.z }))];
  const error = (p: Point[]) =>
    Math.abs(Math.min(...p.map((v) => v.x)) - room.bounds.min.x) +
    Math.abs(Math.max(...p.map((v) => v.x)) - room.bounds.max.x) +
    Math.abs(Math.min(...p.map((v) => v.z)) - room.bounds.min.z) +
    Math.abs(Math.max(...p.map((v) => v.z)) - room.bounds.max.z);
  options.sort((a, b) => error(a) - error(b));
  return error(options[0]) < 1.5 ? options[0] : [];
}
