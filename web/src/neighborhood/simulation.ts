import type { ApiRoom } from '../acoustics/matterport.ts';
import { MatterportSceneImporter, type OpeningMeasurement } from '../acoustics/engine/importer.ts';
import { A_WEIGHTING, OctaveSpectrum, decibels, energy, type SceneData, type SourceData, type Vec } from '../acoustics/engine/domain.ts';
import { roomProbe } from '../acoustics/propagation.ts';
import type { District } from './data.ts';

type Geo={lat:string;long:string};
export type StudyUnit={propertyId:number;modelId:string;address:string;name:string;stories:number|null;constructionMaterial:string|null;yearBuilt?:number|null;
  analysisFloorId?:string;geometryFloors?:{id:string;label:string;status:string;reason?:string|null}[];geometryAvailable:boolean;geometryReason?:string|null;photos:{url:string;caption:string}[];model:{id:string;name:string;rooms:(ApiRoom&{tags?:string[]})[];
    geocoordinates?:{origin:Geo;plusX10m:Geo;plusY10m:Geo}}};
export type PropertyResponse={units:StudyUnit[];fetchedAt:string;providers:{costar:{mode:'snapshot';fileDate:string};matterport:{mode:'live'|'cache'}}};
export type UnitFrame={origin:Vec;x:Vec;z:Vec};
export type Apartment={id:string;name:string;propertyName?:string;address?:string;warnings?:string[];geometry?:{walls:number;windows:number;doors:number;openings:number;assumedHeights:number};propertyContext?:{constructionMaterial:string|null;stories:number|null;yearBuilt:number|null};scene:SceneData;frame:UnitFrame;rooms:{id:string;name:string;probe:Vec}[]};
export type VehicleClass='auto'|'medium_truck'|'heavy_truck';
export type MovingEmitter={id:string;position:Vec;kind:'car'|'truck'|'construction';road?:string;speedKmh?:number;vehicleClass?:VehicleClass;speedEvidence?:string};
export type FleetCounts={highway:number;arterial:number;residential:number};
export type VehicleModel={model:string;referenceDistanceM:number;speedMinKmh:number;speedMaxKmh:number;spectra:Record<VehicleClass,number[][]>;spectrumNote:string;methodNote:string;
  archivedRoad:{name:string;aadt:number;aadt_year:number;speed_kmh:number;source:string};hourlyVolumes:Record<string,Record<VehicleClass,number>>};
export type VehicleData={model:VehicleModel;fetchedAt:string;google:{status:string;note:string;routes:{road:string;direction:string;status:string;speedKmh?:number;source?:string;error?:string}[];streetView:{status:string;date?:string;note?:string;copyright?:string}}};
export type NoiseScenario={traffic:boolean;construction:boolean;trafficOffsetDb:number;constructionDb:number;windowsOpen:boolean;doorsOpen:boolean;fleet:FleetCounts;mutedVehicles:string[];soloVehicle:string|null};
export const DEFAULT_SCENARIO:NoiseScenario={traffic:true,construction:false,trafficOffsetDb:0,constructionDb:92,windowsOpen:false,doorsOpen:false,fleet:{highway:0,arterial:4,residential:0},mutedVehicles:[],soloVehicle:null};
export function geoToWorld(point:Geo,origin:District['origin']):Vec {
  const x=6378137*Number(point.long)*Math.PI/180;
  const y=6378137*Math.log(Math.tan(Math.PI/4+Number(point.lat)*Math.PI/360));
  return {x:(x-origin.mercatorX)*origin.scale,y:0,z:(origin.mercatorY-y)*origin.scale};
}
export function unitFrame(unit:StudyUnit,origin:District['origin']):UnitFrame {
  const g=unit.model.geocoordinates;if(!g)throw new Error('The scan has no geographic registration.');
  const p=geoToWorld(g.origin,origin),x=geoToWorld(g.plusX10m,origin),z=geoToWorld(g.plusY10m,origin);
  return {origin:p,x:{x:(x.x-p.x)/10,y:0,z:(x.z-p.z)/10},z:{x:(z.x-p.x)/10,y:0,z:(z.z-p.z)/10}};
}
export function toWorld(p:Vec,f:UnitFrame):Vec{return {x:f.origin.x+p.x*f.x.x+p.z*f.z.x,y:p.y,z:f.origin.z+p.x*f.x.z+p.z*f.z.z};}
export function toLocal(p:Vec,f:UnitFrame):Vec{
  const dx=p.x-f.origin.x,dz=p.z-f.origin.z,det=f.x.x*f.z.z-f.x.z*f.z.x;
  if(Math.abs(det)<.1)throw new Error('Invalid geographic registration.');
  return {x:(dx*f.z.z-dz*f.z.x)/det,y:p.y,z:(dz*f.x.x-dx*f.x.z)/det};
}
export function makeApartments(units:StudyUnit[],origin:District['origin'],windowsOpen:boolean,referenceOpenings:OpeningMeasurement[]=[],settings:{doorsOpen?:boolean;materials?:Record<string,Record<string,string>>;floors?:Record<string,string>}={}):Apartment[]{
  return units.filter(u=>u.geometryAvailable).map(unit=>{
    const floorId=settings.floors?.[unit.modelId]??unit.analysisFloorId??unit.model.rooms[0]?.floor?.id??'default';
    const survey=unit.modelId==='zzvymDx5ty7'?referenceOpenings.map(o=>({...o,state:windowsOpen?'open' as const:'closed' as const})):[];
    const {scene,warnings,counts:geometry}=new MatterportSceneImporter().import(unit.modelId,unit.model.rooms,{wallMaterial:'plasterboard',floorMaterial:'floor',windowMaterial:'glass',doorsOpen:settings.doorsOpen??false,windowsOpen,assumedHeightM:2.7,floorId,surfaceMaterials:settings.materials?.[unit.modelId]},survey);
    const otherFloors=unit.model.rooms.filter(r=>(r.floor?.id??'default')!==floorId).length;
    if(otherFloors)warnings.push(`${otherFloors} rooms on other floors are outside this floor's analysis.`);
    const counts:Record<string,number>={};
    return {id:unit.modelId,name:unit.model.name,propertyName:unit.name,address:unit.address,warnings,geometry,propertyContext:{constructionMaterial:unit.constructionMaterial??null,stories:unit.stories??null,yearBuilt:unit.yearBuilt??null},scene,frame:unitFrame(unit,origin),rooms:scene.regions.map(r=>{
      const raw=unit.model.rooms.find(room=>room.id===r.id),tags=raw?.tags??[];
      const label=tags.includes('bedroom')?'Bedroom':tags.includes('kitchen')?'Kitchen / living':tags.includes('bathroom')?'Bathroom':tags.includes('closet')?'Closet':'Other space';
      counts[label]=(counts[label]??0)+1;
      return {id:r.id,name:label+(counts[label]>1?` ${counts[label]}`:''),probe:roomProbe(r)};
    })};
  });
}
export function emitterSources(emitters:MovingEmitter[],scenario:NoiseScenario,model?:VehicleModel):SourceData[]{
  const ids=new Set<string>();
  for(const e of emitters){if(ids.has(e.id))throw new Error('Duplicate vehicle/source ID');ids.add(e.id);}
  return emitters.filter(e=>e.kind==='construction'?scenario.construction&&!scenario.soloVehicle:scenario.traffic&&!scenario.mutedVehicles.includes(e.id)&&(!scenario.soloVehicle||scenario.soloVehicle===e.id)).map(e=>{
    if(e.kind!=='construction'){
      if(!model||!Number.isFinite(e.speedKmh)||!e.vehicleClass)throw new Error('Vehicle emission model, class and speed are required.');
      const speed=Math.round(Math.max(model.speedMinKmh,Math.min(model.speedMaxKmh,e.speedKmh!)));
      const spectrum=model.spectra[e.vehicleClass]?.[speed-model.speedMinKmh];
      if(spectrum?.length!==8||!spectrum.every(Number.isFinite))throw new Error('Invalid model vehicle spectrum.');
      return {id:e.id,position:e.position,spectrumDbAt1m:spectrum.map(v=>v+scenario.trafficOffsetDb),enabled:true,
        evidence:{kind:'derived' as const,source:model.model,note:`${e.vehicleClass}, ${e.speedKmh!.toFixed(1)} km/h (${e.speedEvidence}); position/count are scenarios. Pass-by normalization from ${model.referenceDistanceM} m; spectrum shape assumed; adjustment ${scenario.trafficOffsetDb} dB.`}};
    }
    const db=scenario.constructionDb;
    const shape=[-5,-3,0,0,-2,-5,-8,-12];
    const offset=db-new OctaveSpectrum(shape).totalDb(true);
    return {id:e.id,position:e.position,spectrumDbAt1m:shape.map(v=>v+offset),enabled:true,
      evidence:{kind:'assumed',source:'Editable neighborhood emission scenario',note:`${e.kind}: ${db} dBA at 1 m; representative spectrum, not live traffic or a measured vehicle.`}};
  });
}
export const weightedEnergy=(bands:ArrayLike<number>)=>decibels(Array.from(bands).reduce((sum,e,b)=>sum+e*energy(A_WEIGHTING[b]),0));

/** Only the selected layout and two reference layouts run in the live worker. */
export function activeApartments(apartments:Apartment[],selected:string):Apartment[]{
  const current=apartments.find(a=>a.id===selected);
  const others=apartments.filter(a=>a.id!==selected);
  return [...(current?[current]:[]),...others].slice(0,3);
}
