import { A_WEIGHTING, decibels, energy, distance, type RegionData, type Vec } from './engine/domain.ts';
import { pointInPolygon } from './engine/geometry.ts';
import { AcousticScene, type PropagationPath } from './engine/solver.ts';

export const PATH_COLORS = {direct:'#ffbc73',reflected:'#75d9e4',diffracted:'#c4a2ff'};
export const pathLevel = (path: PropagationPath) => decibels(path.bandEnergy.reduce((sum,e,b)=>sum+e*energy(A_WEIGHTING[b]),0));

/** Find a probe that really lies in the measured region, including concave rooms. */
export function roomProbe(region: RegionData, height = 1.2): Vec {
  const inside=(x:number,z:number)=>pointInPolygon(x,z,region.polygon)&&!region.holes.some(h=>pointInPolygon(x,z,h));
  const center={x:region.polygon.reduce((n,p)=>n+p.x,0)/region.polygon.length,
    y:region.polygon[0].y+Math.min(height,region.heightM-.05),
    z:region.polygon.reduce((n,p)=>n+p.z,0)/region.polygon.length};
  if(inside(center.x,center.z))return center;
  const xs=region.polygon.map(p=>p.x),zs=region.polygon.map(p=>p.z);
  for(let row=0;row<40;row++)for(let col=0;col<40;col++){
    const x=Math.min(...xs)+(col+.5)/40*(Math.max(...xs)-Math.min(...xs));
    const z=Math.min(...zs)+(row+.5)/40*(Math.max(...zs)-Math.min(...zs));
    if(inside(x,z))return {...center,x,z};
  }
  throw new Error(`No interior receiver found for ${region.id}`);
}

export type FlowLine = {kind:PropagationPath['kind'];points:Vec[];level:number;lengthM:number;sourceId:string};
/** Show only the portion of each computed route around the interior. The full
 * source-to-receiver route remains available on the neighborhood map. */
export function clipFlowLines(paths:FlowLine[],bounds:[number,number,number,number]):FlowLine[]{
  const result:FlowLine[]=[];
  for(const path of paths){
    let points:Vec[]=[];
    const flush=()=>{if(points.length>1)result.push({...path,points,lengthM:points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)});points=[];};
    for(let i=1;i<path.points.length;i++){
      const a=path.points[i-1],b=path.points[i];let lo=0,hi=1;
      for(const [axis,min,max] of [['x',bounds[0],bounds[2]],['z',bounds[1],bounds[3]]] as const){
        const delta=b[axis]-a[axis];
        if(Math.abs(delta)<1e-10){if(a[axis]<min||a[axis]>max){lo=1;hi=0;}continue;}
        const u=(min-a[axis])/delta,v=(max-a[axis])/delta;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));
      }
      if(lo>hi){flush();continue;}
      const at=(t:number):Vec=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
      const start=at(lo),end=at(hi);
      if(points.length&&distance(points[points.length-1],start)>.001)flush();
      if(!points.length)points.push(start);points.push(end);if(hi<1)flush();
    }
    flush();
  }
  return result;
}
/** Keep the strongest paths, inserting real interface intersections for the
 * renderer. This is an illustration of energy routes, never acoustic phase. */
export function flowLines(scene:AcousticScene, paths:PropagationPath[], limit=24):FlowLine[] {
  return paths.map(path=>({path,level:pathLevel(path)})).filter(p=>p.level>-110)
    .sort((a,b)=>b.level-a.level).slice(0,limit).map(({path,level})=>{
      const points:Vec[]=[path.points[0]];
      for(let i=1;i<path.points.length;i++){
        const a=path.points[i-1],b=path.points[i];
        scene.trace(a,b).forEach(hit=>{if(distance(points[points.length-1],hit.point)>.001)points.push(hit.point);});
        points.push(b);
      }
      return {...path,points,level};
    });
}

export function samplePath(points:Vec[], atM:number):Vec {
  let remaining=Math.max(0,atM);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=distance(a,b);
    if(remaining<=length&&length>0){const t=remaining/length;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};}
    remaining-=length;
  }
  return points[points.length-1];
}
