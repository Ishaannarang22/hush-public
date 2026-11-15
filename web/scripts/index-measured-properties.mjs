/** Offline pass: validate every cached floor and join measured areas to properties
 * only through residential property IDs or explicit floor-plan/scan links. */
import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeApartments,toLocal} from '../src/neighborhood/simulation.ts';
import {propertyUnitFromModel} from '../server/neighborhood.ts';
const root=resolve(import.meta.dirname,'../..'),dir=resolve(root,'work/neighborhood'),cache=resolve(dir,'measurements');
const manifest=JSON.parse(await readFile(resolve(cache,'manifest.json'),'utf8'));
if(manifest.status==='running')throw new Error('Wait for the measurement download to finish before indexing.');
const catalog=JSON.parse(await readFile(resolve(dir,'portfolio.json'),'utf8')),origin=JSON.parse(await readFile(resolve(root,'web/public/neighborhood/scene.json'),'utf8')).origin;
const polygonArea=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.z-q.x*p.z;},0))/2;
const regionArea=r=>Math.max(0,polygonArea(r.polygon)-r.holes.reduce((sum,h)=>sum+polygonArea(h),0));
async function atomic(path,value){await writeFile(path+'.tmp',JSON.stringify(value));await rename(path+'.tmp',path);}
let done=0;const totals={readyFloors:0,invalidFloors:0,missingFloors:0,walls:0,rooms:0,windows:0,doors:0,assumedHeights:0,measuredProperties:0,measuredPlans:0};
for(const [id,entry] of Object.entries(manifest.models)){
 if(entry.status==='error')continue;
 const path=resolve(cache,id+'.json'),saved=JSON.parse(await readFile(path,'utf8')),model=saved.model,unit=propertyUnitFromModel({propertyId:0,modelId:id,address:''},model,[]);
 const floors=[...new Map((model.rooms??[]).map(r=>[r.floor?.id??'default',{id:r.floor?.id??'default',label:r.floor?.label??`Floor ${(r.floor?.sequence??0)+1}`}])).values()],results=[];
 for(const floor of floors){
  if(!unit.geometryAvailable){results.push({...floor,status:'missing',reason:unit.geometryReason});totals.missingFloors++;continue;}
  try{
   const a=makeApartments([unit],origin,false,[],{floors:{[id]:floor.id}})[0];if(!a?.rooms.length)throw new Error('No closed room boundaries on this floor');toLocal(a.frame.origin,a.frame);
   const bedrooms=a.scene.regions.filter(r=>model.rooms.find(raw=>raw.id===r.id)?.tags?.includes('bedroom'));
   const candidates=bedrooms.length?bedrooms:[...a.scene.regions].sort((a,b)=>regionArea(b)-regionArea(a)).slice(0,1);
   const roomAreaM2=candidates.reduce((sum,r)=>sum+regionArea(r),0)/candidates.length;
   const summary={...floor,status:'ready',...a.geometry,rooms:a.rooms.length,roomAreaM2,roomAreaBasis:bedrooms.length?'mean measured bedroom area':'largest measured room area',floorAreaM2:a.scene.regions.reduce((sum,r)=>sum+regionArea(r),0)};
   results.push(summary);totals.readyFloors++;for(const k of ['walls','rooms','windows','doors','assumedHeights'])totals[k]+=summary[k]??0;
  }catch(e){results.push({...floor,status:'invalid',reason:e.message});totals.invalidFloors++;}
 }
 const valid=results.filter(r=>r.status==='ready'),preferred=valid[0],status=preferred?'ready':results.some(r=>r.status==='invalid')?'invalid':'missing';
 const summary={...entry,...(preferred??{}),status,reason:preferred?null:results[0]?.reason??entry.reason,preferredFloorId:preferred?.id,floors:results.length,floorResults:results};
 // Keep the scan ID in the manifest key; floor IDs live in floorResults only.
 delete summary.id;delete summary.label;
 saved.summary=summary;await atomic(path,saved);manifest.models[id]=summary;done++;
 if(done%2000===0)console.log(`Indexed ${done} scans`);
}
function fromModels(ids){const measurements=ids.map(id=>manifest.models[id]).filter(m=>m?.status==='ready'&&Number.isFinite(m.roomAreaM2)&&m.roomAreaM2>0);return measurements.length?{area:measurements.reduce((s,m)=>s+m.roomAreaM2,0)/measurements.length,models:ids.filter(id=>manifest.models[id]?.status==='ready')}:null;}
for(const property of catalog.properties){
 const path=resolve(dir,'property-data',property.id.replace(':','-')+'.json'),detail=JSON.parse(await readFile(path,'utf8'));
 for(const plan of detail.floorPlans){const m=fromModels(plan.modelIds??[]);if(m){plan.measuredRoomAreaM2=m.area;plan.measurementModelIds=m.models;totals.measuredPlans++;}}
 const residential=property.kind==='residential'?fromModels(property.modelIds):null;
 const usable=detail.floorPlans.filter(p=>p.measuredRoomAreaM2>0);
 // A partial plan sample is not presented as the entire community's plan mix.
 if(residential){property.acousticProfile={...property.acousticProfile,roomAreaM2:residential.area,roomAreaAssumed:false,roomAreaBasis:'measured rooms from linked home scans',measurementModelIds:residential.models};totals.measuredProperties++;}
 property.preferredModelId=property.modelIds.find(id=>manifest.models[id]?.status==='ready')??property.modelIds[0];
 property.measurementCoverage={ready:property.modelIds.filter(id=>manifest.models[id]?.status==='ready').length,downloaded:property.modelIds.filter(id=>manifest.models[id]&&manifest.models[id].status!=='error').length,total:property.modelIds.length,plansWithMeasurements:usable.length};
 detail.profile=property.acousticProfile;await atomic(path,detail);
}
manifest.counts={downloaded:0,ready:0,missing:0,invalid:0,error:0};for(const m of Object.values(manifest.models)){if(m.status!=='error')manifest.counts.downloaded++;manifest.counts[m.status]++;}
manifest.indexedAt=new Date().toISOString();manifest.floorTotals=totals;
catalog.measurementInventory={total:manifest.total,counts:manifest.counts,indexedAt:manifest.indexedAt,...totals};
await atomic(resolve(cache,'manifest.json'),manifest);await atomic(resolve(dir,'portfolio.json'),catalog);
console.log(JSON.stringify({counts:manifest.counts,...totals}));
