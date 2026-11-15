import type { District, Point2, Road } from './data.ts';
export const STUDY_BOUNDS:[number,number,number,number]=[-970,-160,450,1480];
const inside=([x,z]:Point2)=>x>=STUDY_BOUNDS[0]&&x<=STUDY_BOUNDS[2]&&z>=STUDY_BOUNDS[1]&&z<=STUDY_BOUNDS[3];
export function cropStudy(data:District):District {
  const roads:Road[]=[];
  for(const road of data.roads){
    let points:Point2[]=[];
    const flush=()=>{if(points.length>1)roads.push({...road,id:`${road.id}-${roads.length}`,points});points=[];};
    for(const p of road.points){if(inside(p))points.push(p);else flush();}flush();
  }
  return {...data,studyBounds:STUDY_BOUNDS,buildings:data.buildings.filter(b=>b.rings.flat().every(inside)),roads,
    trees:data.trees.filter(t=>inside(t.position)),zones:data.zones.filter(z=>z.points.every(inside))};
}
