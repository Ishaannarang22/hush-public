import * as THREE from 'three';
import type { District, Road } from './data.ts';
import type { FleetCounts, MovingEmitter, VehicleData } from './simulation.ts';
export type VehicleTrack={id:string;kind:'car'|'truck';vehicleClass:'auto'|'medium_truck';road:Road;curve:THREE.CurvePath<THREE.Vector3>;length:number;offset:number;speed:number;speedEvidence:string};
function roadSpeed(road:Road,provider:VehicleData|null){
  if(road.name==='Greenhouse Road'){
    const direction=road.points.at(-1)![1]<road.points[0][1]?'northbound':'southbound';
    const live=provider?.google.routes.find(r=>r.direction===direction&&r.status==='live');
    if(live?.speedKmh)return {speed:live.speedKmh/3.6,evidence:'Google traffic-aware route-average speed'};
    if(provider)return {speed:provider.model.archivedRoad.speed_kmh/3.6,evidence:`TxDOT archived posted speed; ${provider.model.archivedRoad.aadt_year} count record, not current traffic speed`};
  }
  const posted=Number.parseFloat(road.maxspeed??'');
  if(posted>0)return {speed:posted*(road.maxspeed?.includes('mph')?1.609344:1)/3.6,evidence:`${road.source??'Road inventory'} posted speed, not current traffic speed`};
  return {speed:road.kind==='motorway'?25:road.kind==='residential'?6:12,evidence:'Assumed animation speed; no observed traffic speed'};
}
export function makeVehicleTracks(data:District,counts:FleetCounts,provider:VehicleData|null):VehicleTrack[]{
  for(const n of Object.values(counts))if(!Number.isInteger(n)||n<0||n>12)throw new Error('Each road group supports 0–12 vehicles.');
  const candidates=data.roads.filter(r=>r.kind==='motorway'||r.kind==='residential'||r.name==='Greenhouse Road').map(road=>{
    const curve=new THREE.CurvePath<THREE.Vector3>();
    for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i];curve.add(new THREE.LineCurve3(new THREE.Vector3(a[0],road.bridge?5.18:.22,a[1]),new THREE.Vector3(b[0],road.bridge?5.18:.22,b[1])));}
    return {road,curve,length:curve.getLength(),...roadSpeed(road,provider)};
  }).filter(t=>t.length>=75&&t.length<=2600);
  const groups={highway:candidates.filter(t=>t.road.kind==='motorway').sort((a,b)=>b.length-a.length).slice(0,2),
    arterial:candidates.filter(t=>t.road.name==='Greenhouse Road').sort((a,b)=>Math.abs(a.curve.getPointAt(.5).z)-Math.abs(b.curve.getPointAt(.5).z)).slice(0,2),
    residential:candidates.filter(t=>t.road.kind==='residential').sort((a,b)=>Math.abs(a.curve.getPointAt(.5).z)-Math.abs(b.curve.getPointAt(.5).z)).slice(0,2)};
  const tracks:VehicleTrack[]=[];
  for(const group of ['highway','arterial','residential'] as const){
    const choices=groups[group];if(!choices.length)continue;
    for(let i=0;i<counts[group];i++){
      const t=choices[i%choices.length],truck=group==='highway'&&i%4===3;
      tracks.push({...t,id:`vehicle-${group}-${i+1}`,kind:truck?'truck':'car',vehicleClass:truck?'medium_truck':'auto',speedEvidence:t.evidence,offset:(Math.floor(i/choices.length)+.37)/Math.ceil(counts[group]/choices.length)});
    }
  }
  return tracks;
}
export function vehicleAt(track:VehicleTrack,time:number,index:number):{emitter:MovingEmitter;rotation:number;position:[number,number,number]}{
  const at=(track.offset+time*track.speed/track.length)%1,p=track.curve.getPointAt(at),dir=track.curve.getTangentAt(at);
  const lane=track.road.oneway?((index%Math.max(1,track.road.lanes))-(track.road.lanes-1)/2)*3.3:1.7;
  const position:[number,number,number]=[p.x+dir.z*lane,p.y,p.z-dir.x*lane];
  const road=track.road.name&&track.road.name!=='Local street'?track.road.name:track.road.kind==='motorway'?'Highway segment':'Residential street';
  return {position,rotation:Math.atan2(dir.x,dir.z),emitter:{id:track.id,kind:track.kind,vehicleClass:track.vehicleClass,road,speedKmh:track.speed*3.6,speedEvidence:track.speedEvidence,
    position:{x:position[0],y:position[1]+.7,z:position[2]}}};
}
