import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { District } from './data';
import { DEFAULT_SCENARIO, activeApartments, emitterSources, makeApartments, toWorld, type MovingEmitter, type PropertyResponse, type VehicleData, type StudyUnit } from './simulation';
import type { SpectralField } from '../acoustics/engine/grid';
import type { FlowLine } from '../acoustics/propagation';
import type { SourceData, Vec } from '../acoustics/engine/domain';
import { measuredOpenings } from '../acoustics/integration/datasets';
import { viewableBuildings } from './viewableBuildings';
export type NoiseResult={id:number;key:string;selected:string;levels:Record<string,Record<string,number>>;referenceLevels:Record<string,Record<string,number>>;contributions:Record<string,Record<string,Record<string,number>>>;sourceIds:string[];detail:{field:SpectralField;paths:FlowLine[];probe:Vec;roomId:string;sources:SourceData[]}|null;error?:string};

export function useNoiseStudy(data:District|null,sourceOverride?:SourceData[],detailEnabled=true){
  const [properties,setProperties]=useState<PropertyResponse|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
  const [selected,setSelected]=useState('zzvymDx5ty7'),[room,setRoom]=useState(''),[scenario,setScenario]=useState(DEFAULT_SCENARIO);
  const [floors,setFloors]=useState<Record<string,string>>({});
  const [wall,setWall]=useState(''),[materials,setMaterials]=useState<Record<string,Record<string,string>>>({});
  const [emitters,setEmitters]=useState<MovingEmitter[]>([]),[result,setResult]=useState<NoiseResult|null>(null),[busy,setBusy]=useState(false),[calculationError,setCalculationError]=useState('');
  const [refresh,setRefresh]=useState(0),[open,setOpen]=useState(true);
  const [vehicleData,setVehicleData]=useState<VehicleData|null>(null),[vehicleError,setVehicleError]=useState('');
  const [extraUnits,setExtraUnits]=useState<StudyUnit[]>([]),[modelLoading,setModelLoading]=useState<string|null>(null),[modelErrors,setModelErrors]=useState<Record<string,string>>({});
  const worker=useRef<Worker|null>(null),sequence=useRef(0),expected=useRef('');
  useEffect(()=>{
    const abort=new AbortController();
    fetch('/api/neighborhood/properties'+(refresh?'?refresh=1':''),{signal:abort.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Live property data unavailable');return body;})
      .then(setProperties).catch(error=>{if(error.name!=='AbortError')setLoadError(error.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[refresh]);
  useEffect(()=>{
    const abort=new AbortController();
    fetch('/api/neighborhood/vehicle-data',{signal:abort.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error??'Vehicle emission model unavailable');return d;})
      .then(d=>{setVehicleData(d);setVehicleError('');}).catch(e=>{if(e.name!=='AbortError')setVehicleError(e.message);});
    return()=>abort.abort();
  },[refresh]);
  const prepared=useMemo(()=>{try{return {apartments:properties&&data?makeApartments([...properties.units.filter(u=>!extraUnits.some(e=>e.modelId===u.modelId)),...extraUnits],data.origin,scenario.windowsOpen,measuredOpenings,{doorsOpen:scenario.doorsOpen,materials,floors}):[],error:''};}
    catch(error){return {apartments:[],error:error instanceof Error?error.message:'Invalid apartment geometry'};}},[properties,data,scenario.windowsOpen,scenario.doorsOpen,materials,extraUnits,floors]);
  const apartments=prepared.apartments;
  const liveApartments=useMemo(()=>sourceOverride?apartments.filter(a=>a.id===selected):activeApartments(apartments,selected),[apartments,selected,sourceOverride]);
  const apartment=apartments.find(a=>a.id===selected)??null;
  const viewable=useMemo(()=>viewableBuildings(data?.buildings??[],apartments),[data,apartments]);
  const sources=useMemo(()=>{
    if(sourceOverride)return sourceOverride;
    const zone=data?.zones[0],points=zone?.points??[];
    const construction:MovingEmitter[]=points.length?[{id:'construction-site',kind:'construction',position:{x:points.reduce((s,p)=>s+p[0],0)/points.length,y:2,z:points.reduce((s,p)=>s+p[1],0)/points.length}}]:[];
    return vehicleData?emitterSources([...emitters,...construction],scenario,vehicleData.model):[];
  },[emitters,scenario,data,vehicleData,sourceOverride]);
  const key=JSON.stringify({selected,room,scenario,materials,floors,models:apartments.map(a=>a.id),geometryRevision:properties?.fetchedAt,sourceIds:sources.map(s=>s.id),externalSources:sourceOverride,providerRevision:vehicleData?.fetchedAt});
  useEffect(()=>{expected.current=key;},[key]);
  useEffect(()=>{
    const w=new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=event=>{const r=event.data as NoiseResult;if(r.key!==expected.current)return;
      setBusy(false);if(r.error){setCalculationError(r.error);return;}setCalculationError('');setResult(r);};
    w.onerror=()=>{setBusy(false);setCalculationError('Noise worker failed. Refresh the page to retry.');};
    return()=>{w.terminate();worker.current=null;};
  },[]);
  useEffect(()=>{
    if(!detailEnabled||!apartments.length||(!sourceOverride&&!vehicleData))return;
    // This state tracks an asynchronous worker request, not derived render data.
    // eslint-disable-next-line react/set-state-in-effect
    setBusy(true);worker.current?.postMessage({id:++sequence.current,key,apartments:liveApartments,sources,selected,room});
  },[liveApartments,sources,selected,room,key,vehicleData,sourceOverride,detailEnabled]);
  const current=result?.key===key?result:null;
  const mapPaths=useMemo(()=>apartment&&current?.detail?current.detail.paths.slice(0,12).map(p=>({...p,points:p.points.map(point=>toWorld(point,apartment.frame))})):[],[apartment,current]);
  const onEmitters=useCallback((next:MovingEmitter[])=>setEmitters(next),[]);
  async function loadModel(id:string):Promise<boolean>{
    if(apartments.some(a=>a.id===id))return true;
    if(!data)return false;
    setModelLoading(id);setModelErrors(e=>({...e,[id]:''}));
    try{
      const response=await fetch('/api/neighborhood/properties?modelId='+encodeURIComponent(id));
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not load this scan.');
      const unit=body.unit as StudyUnit;
      if(!unit.geometryAvailable)throw new Error(unit.geometryReason??'Measured interior geometry is unavailable.');
      const candidates=[...new Set([unit.analysisFloorId,...unit.model.rooms.map(r=>r.floor?.id??'default')].filter((f):f is string=>Boolean(f)))];
      let accepted:StudyUnit|null=null,lastError='This scan has no usable closed room boundaries.';
      for(const floorId of candidates){try{
        const candidate=makeApartments([unit],data.origin,scenario.windowsOpen,measuredOpenings,{doorsOpen:scenario.doorsOpen,materials,floors:{[id]:floorId}})[0];
        if(!candidate?.rooms.length)continue;
        toWorld(candidate.rooms[0].probe,candidate.frame);
        accepted={...unit,analysisFloorId:floorId};break;
      }catch(e){lastError=e instanceof Error?e.message:lastError;}}
      if(!accepted)throw new Error(lastError);
      setExtraUnits(units=>[...units.filter(u=>u.modelId!==id),accepted!]);return true;
    }catch(error){setModelErrors(e=>({...e,[id]:error instanceof Error?error.message:'Sound analysis unavailable.'}));return false;}
    finally{setModelLoading(current=>current===id?null:current);}
  }
  function select(id:string){setSelected(id);setRoom('');setWall('');setOpen(true);}
  const selectedUnit=[...extraUnits,...(properties?.units??[])].find(u=>u.modelId===selected);
  const floorOptions=selectedUnit?.geometryFloors??[...new Map((selectedUnit?.model.rooms??[]).map(r=>[r.floor?.id??'default',{id:r.floor?.id??'default',label:r.floor?.label??`Floor ${(r.floor?.sequence??0)+1}`,status:'unverified'}])).values()];
  const floorId=floors[selected]??selectedUnit?.analysisFloorId??selectedUnit?.model.rooms[0]?.floor?.id??'default';
  function setFloor(id:string){setFloors(all=>({...all,[selected]:id}));setRoom('');setWall('');}
  function setWallMaterial(id:string,material:string){setMaterials(all=>({...all,[selected]:{...all[selected],[id]:material}}));}
  return {floorOptions,floorId,setFloor,properties,loading,loadModel,modelLoading,modelErrors,liveApartments,error:loadError||vehicleError||prepared.error||calculationError,vehicleData,emitters,refresh:()=>{setLoading(true);setLoadError('');setRefresh(n=>n+1);},apartments,apartment,viewable,selected,select,room,setRoom,wall,setWall,setWallMaterial,scenario,setScenario,sources,
    availableRoadGroups:{highway:Boolean(data?.roads.some(r=>r.kind==='motorway')),arterial:Boolean(data?.roads.some(r=>r.name==='Greenhouse Road')),residential:Boolean(data?.roads.some(r=>r.kind==='residential'))},constructionAvailable:Boolean(data?.zones.length),result:current,busy,mapPaths,onEmitters,open,setOpen};
}
export type NoiseStudy=ReturnType<typeof useNoiseStudy>;
