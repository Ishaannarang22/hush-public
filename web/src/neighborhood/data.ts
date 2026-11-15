import { AERIAL_ELEVATION } from './camera.ts';
export type Point2 = [number, number];
export type Building = {
  id: string; rings: Point2[][]; center: Point2; area: number; height: number;
  heightBasis: string; type: string; address: string | null; name: string | null;
  reference: string | null; sourceId: number|string; source: string; imageDate: number | null;
  heightMeasured?:boolean;roofShape?:string|null;roofMaterial?:string|null;
};
export type Road = {
  id: string; points: Point2[]; kind: string; name: string; lanes: number;
  lanesKnown: boolean; oneway: boolean; bridge: boolean; maxspeed: string | null; source?: string; geometryEvidence?: string;
};
export type Imagery = {name: string; bounds: [number, number, number, number]; width: number; height: number;url?:string};
export type District = {
  schemaVersion: number; name: string; retrieved: string;
  origin: {lat: number; lon: number; mercatorX: number; mercatorY: number; scale: number};
  buildings: Building[]; roads: Road[];
  trees: {id: string; position: Point2; height: number; evidence: string}[];
  zones: {id: string; name: string; kind: string; points: Point2[]; source: string}[];
  imagery: Imagery[]; sources: {name: string; url: string; license: string}[];
  limitations: string[];
  studyBounds?: [number,number,number,number];
};
export type ViewName = 'apartments' | 'highway' | 'homes' | 'district' | 'construction';
export const VIEWS: Record<ViewName, {label: string; target: [number, number, number]; position: [number, number, number]}> = {
  apartments: {label: 'Apartment community', target: [-50, 0, 75], position: [-330, 220, -245]},
  highway: {label: 'I-10 interchange', target: [40, 0, 1290], position: [530, 390, 1740]},
  homes: {label: 'Residential streets', target: [-430, 0, -30], position: [-190, 240, 300]},
  district: {label: 'Highway + homes study', target: [-260, 0, 660], position: [700, 1000, 1840]},
  construction: {label: 'Mapped construction', target: [-830, 0, 560], position: [-530, 340, 930]},
};
// Camera presets all start 40 degrees above the ground; orbit remains available.
Object.values(VIEWS).forEach(view=>{
  view.position[1]=view.target[1]+Math.hypot(view.position[0]-view.target[0],view.position[2]-view.target[2])*Math.tan(AERIAL_ELEVATION);
});
export type Layers = {buildings: boolean; trees: boolean; traffic: boolean; sources: boolean};

export function worldToGeographic(x: number, z: number, origin: District['origin']) {
  const mx = origin.mercatorX + x / origin.scale;
  const my = origin.mercatorY - z / origin.scale;
  return {lon: mx / 6378137 * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(my / 6378137)) - Math.PI / 2) * 180 / Math.PI};
}
