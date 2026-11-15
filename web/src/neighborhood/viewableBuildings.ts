import type { Building, Point2 } from './data.ts';
import { toWorld, type Apartment } from './simulation.ts';

export type ViewableBuilding = {building:Building; interiors:{id:string;name:string;approximate:boolean;maxOffsetM:number}[]};

function inRing([x,z]:Point2,ring:Point2[]):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function distanceToBuilding(p:Point2,b:Building):number {
  // Courtyards are not indoor coverage, even if the enclosing roof is nearby.
  if(b.rings.slice(1).some(r=>inRing(p,r)))return Infinity;
  if(inRing(p,b.rings[0]))return 0;
  return Math.min(...b.rings[0].map((a,i,ring)=>{
    const next=ring[(i+1)%ring.length],dx=next[0]-a[0],dz=next[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
  }));
}

export function matchBuilding(buildings:Building[],points:Point2[],maxOffsetM=10){
  if(!points.length||points.some(p=>!p.every(Number.isFinite)))return null;
  const candidates=buildings.filter(b=>b.rings[0]?.length>=3).map(building=>{
    const distances=points.map(p=>distanceToBuilding(p,building));
    return {building,mean:distances.reduce((s,d)=>s+d,0)/distances.length,max:Math.max(...distances)};
  }).sort((a,b)=>a.mean-b.mean);
  const best=candidates[0],runnerUp=candidates[1];
  return !best||best.max>maxOffsetM||(runnerUp&&runnerUp.mean-best.mean<5)?null:best;
}

/** Associate usable scans with roofs, never claim every property footprint has a tour.
 * A nearby match is explicitly approximate, bounded to 10 m for every room probe,
 * and rejected if another building is within 5 m of its mean distance.
 * This is a navigation association only; it does not relocate acoustic geometry.
 */
export function viewableBuildings(buildings:Building[],apartments:Apartment[]):ViewableBuilding[]{
  const matches=new Map<string,ViewableBuilding>();
  for(const apartment of apartments){
    const points=apartment.rooms.map(r=>{const p=toWorld(r.probe,apartment.frame);return [p.x,p.z] as Point2;});
    const best=matchBuilding(buildings,points);
    if(!best)continue;
    const group=matches.get(best.building.id)??{building:best.building,interiors:[]};
    group.interiors.push({id:apartment.id,name:apartment.name,approximate:best.max>.01,maxOffsetM:best.max});
    matches.set(best.building.id,group);
  }
  return [...matches.values()];
}
