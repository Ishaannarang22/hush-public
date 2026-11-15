import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { PortfolioCatalog } from '../src/neighborhood/portfolioModel.ts';
import type { TourCatalog } from '../src/neighborhood/tours.ts';

export async function enrichTours(catalog:TourCatalog,env:Record<string,string>,request:typeof fetch=fetch):Promise<TourCatalog>{
  const ids=[...new Set(catalog.properties.flatMap(p=>p.tours.map(t=>t.id)))];
  if(ids.some(id=>!(/^[a-zA-Z0-9]{8,20}$/).test(id)))throw new Error('Invalid CoStar model ID.');
  const metadata=new Map<string,{name:string;geolocation?:{lat:string;long:string}|null}>();
  if(env.MATTERPORT_API_KEY&&env.MATTERPORT_API_TOKEN){
    // Bounded batches avoid 53 simultaneous API calls, and one missing model
    // never removes a CoStar tour link or blocks the rest of the catalog.
    for(let start=0;start<ids.length;start+=10){
      const batch=ids.slice(start,start+10);
      try{
        const response=await request('https://api.matterport.com/api/models/graph',{
          method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',
            Authorization:`Basic ${Buffer.from(`${env.MATTERPORT_API_KEY}:${env.MATTERPORT_API_TOKEN}`).toString('base64')}`},
          body:JSON.stringify({query:`query{${batch.map((id,i)=>`t${i}:model(id:"${id}"){id name geolocation{lat long}}`).join(' ')}}`})});
        if(!response.ok)continue;
        const body=await response.json();
        batch.forEach((id,i)=>{const model=body.data?.[`t${i}`];if(model?.id===id)metadata.set(id,model);});
      }catch{/* Keep the original catalog link if the live metadata is unavailable. */}
    }
  }
  return {...catalog,fetchedAt:new Date().toISOString(),
    warning:metadata.size<ids.length?'Some tour details could not be refreshed. Original CoStar tour links are still available.':undefined,
    properties:catalog.properties.map(p=>({...p,tours:p.tours.map(t=>{
      const model=metadata.get(t.id),lat=Number(model?.geolocation?.lat),lon=Number(model?.geolocation?.long);
      return {...t,name:model?.name||t.name,status:model?'live' as const:'unverified' as const,
        location:model?.geolocation&&Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null};
    })}))};
}

// Model/property joins verified against the sponsor's commercial-properties.csv.
const UNITS = [
  {propertyId:9160550,modelId:'zzvymDx5ty7',address:'2219 Greenhouse Rd'},
  {propertyId:4440000,modelId:'4a9K7eimQDB',address:'19606 Park Row',name:'Terra at Park Row'},
  {propertyId:12881048,modelId:'BPtsRg1smtt',address:'1550 Foxlake Dr',name:'Lenox Katy Creek'},
];
export const PROPERTY_GEOMETRY_QUERY=`query($id:ID!){model(id:$id){id name geolocation{lat long} geocoordinates{
  origin:geoLocationOf(modelLocation:{x:0,y:0,z:0}){lat long}
  plusX10m:geoLocationOf(modelLocation:{x:10,y:0,z:0}){lat long}
  plusY10m:geoLocationOf(modelLocation:{x:0,y:10,z:0}){lat long}}
  rooms{id label tags floor{id sequence label} dimensions{height units} dimensionEstimates{height lowerElevation units}
  boundary{edges{id type thickness openings{id type width height lowerElevation relativeCenter} vertices{position{x y}}}}
  holes{edges{id type thickness openings{id type width height lowerElevation relativeCenter} vertices{position{x y}}}}}}}`;

export type PropertyUnitRequest={propertyId:number;modelId:string;address:string;name?:string};
export function catalogUnit(catalog:TourCatalog,id:string):PropertyUnitRequest{
  const property=catalog.properties.find(p=>p.tours.some(t=>t.id===id));
  if(!property||!(/^[a-zA-Z0-9]{8,20}$/).test(id))throw new Error('Unknown CoStar tour ID.');
  return {propertyId:property.id,modelId:id,address:property.address,name:property.name};
}
export async function loadPropertyUnit(unit:PropertyUnitRequest,env:Record<string,string>,records:any[]=[],request:typeof fetch=fetch){
  if(!env.MATTERPORT_API_KEY||!env.MATTERPORT_API_TOKEN)throw new Error('Live Matterport credentials are not configured.');
  const response=await request('https://api.matterport.com/api/models/graph',{
    method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',
      Authorization:`Basic ${Buffer.from(`${env.MATTERPORT_API_KEY}:${env.MATTERPORT_API_TOKEN}`).toString('base64')}`},
    body:JSON.stringify({query:PROPERTY_GEOMETRY_QUERY,variables:{id:unit.modelId}})});
  if(!response.ok)throw new Error(`Matterport returned HTTP ${response.status}`);
  const body=await response.json(),model=body.data?.model;
  if(!model||model.id!==unit.modelId)throw new Error('Live apartment geometry is unavailable.');
  return propertyUnitFromModel(unit,model,records);
}
export function propertyUnitFromModel(unit:PropertyUnitRequest,model:any,records:any[]=[]){
  model.rooms??=[];
  const hasBoundaries=model.rooms.some((r:{boundary?:{edges?:unknown[]}})=>(r.boundary?.edges?.length??0)>2);
  const registered=['origin','plusX10m','plusY10m'].every(key=>{
    const p=model.geocoordinates?.[key];return p&&p.lat!=null&&p.long!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.long));
  });
  const geometryAvailable=Boolean(hasBoundaries&&registered),record=records.find(r=>r.id===unit.propertyId);
  return {...unit,model,geometryAvailable,geometryReason:geometryAvailable?null:!hasBoundaries?'This tour has no measured room boundaries in the Model API.':'This scan has no usable geographic registration.',
    name:record?.buildingName??unit.name??unit.address,stories:record?.numStoriesAboveGrade??null,
    constructionMaterial:([null,'Masonry','Metal','Reinforced concrete','Steel','Wood frame','Brownstone','Limestone'] as const)[record?.buildingConstructionMaterial??0]??null,
    yearBuilt:record?.constructionEvents?.find((event:{eventType:number})=>event.eventType===2)?.year??null,
    photos:(record?.attachments??[]).filter((a:{attachmentUri?:string;attachmentType?:number})=>a.attachmentType===3&&a.attachmentUri?.startsWith('https://ahprd1cdn.csgpimgs.com/'))
      .slice(0,4).map((a:{attachmentUri:string;caption?:string})=>({url:a.attachmentUri,caption:a.caption??'CoStar property photo'})),
    propertySource:'CoStar sponsor export',geometrySource:'Matterport live Model API'};
}

export function neighborhoodApi(env:Record<string,string>):Plugin {
  const portfolioPath=resolve(process.cwd(),'../work/neighborhood/portfolio.json');
  let portfolioCache:PortfolioCatalog|null=null,portfolioStamp=0;
  async function portfolio(){const info=await stat(portfolioPath);if(!portfolioCache||portfolioStamp!==info.mtimeMs){portfolioCache=JSON.parse(await readFile(portfolioPath,'utf8')) as PortfolioCatalog;portfolioStamp=info.mtimeMs;}return portfolioCache;}
  async function propertyRecords(){
    const selected=(await readFile(resolve(process.cwd(),'../work/costar-kit/selected-commercial-property.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    try{const all=await portfolio();return [...selected,...all.properties.filter(p=>!selected.some(r=>r.id===p.propertyId)).map(p=>({id:p.propertyId,buildingName:p.name,numStoriesAboveGrade:p.stories,buildingConstructionMaterial:[null,'Masonry','Metal','Reinforced concrete','Steel','Wood frame','Brownstone','Limestone'].indexOf(p.constructionMaterial),constructionEvents:p.yearBuilt?[{eventType:2,year:p.yearBuilt}]:[]}))];}catch{return selected;}
  }
  async function measurementManifest(){try{return JSON.parse(await readFile(resolve(process.cwd(),'../work/neighborhood/measurements/manifest.json'),'utf8'));}catch{return {status:'not-started',total:0,counts:{},models:{}};}}
  async function cachedPropertyUnit(unit:PropertyUnitRequest,records:any[],refresh=false){
    if(!refresh){try{
      const saved=JSON.parse(await readFile(resolve(process.cwd(),'../work/neighborhood/measurements',unit.modelId+'.json'),'utf8'));
      if(saved.model?.id!==unit.modelId)throw new Error('Mismatched cached model');
      const described=propertyUnitFromModel(unit,saved.model,records);
      return {...described,analysisFloorId:saved.summary.preferredFloorId,geometryFloors:saved.summary.floorResults,geometryAvailable:saved.summary.status==='ready'&&described.geometryAvailable,geometryReason:saved.summary.status==='ready'?described.geometryReason:saved.summary.reason,geometrySource:'Matterport Model API · local measurement cache',measurementFetchedAt:saved.summary.fetchedAt};
    }catch{/* A cache miss falls through to the authorized live API. */}}
    return loadPropertyUnit(unit,env,records);
  }
  const unitCache=new Map<string,{at:number;value:Awaited<ReturnType<typeof loadPropertyUnit>>}>();
  const unitPending=new Map<string,Promise<Awaited<ReturnType<typeof loadPropertyUnit>>>>();
  let cached:{at:number;value:unknown}|null=null;
  let pending:Promise<unknown>|null=null;
  let tourCache:{at:number;value:TourCatalog}|null=null,tourPending:Promise<TourCatalog>|null=null;
  async function load(){
    const directory=resolve(process.cwd(),'../work/costar-kit');
    const [csv,raw,info]=await Promise.all([readFile(resolve(directory,'commercial-properties.csv'),'utf8'),
      readFile(resolve(directory,'selected-commercial-property.jsonl'),'utf8'),stat(resolve(directory,'commercial-properties.csv'))]);
    const records=raw.trim().split('\n').map(line=>JSON.parse(line));
    const units=await Promise.all(UNITS.map(async unit=>{
      if(!csv.split('\n').some(line=>line.startsWith(`${unit.propertyId},${unit.modelId},`)))throw new Error('CoStar model/property join is missing.');
      return cachedPropertyUnit(unit,records);
    }));
    return {units,fetchedAt:new Date().toISOString(),providers:{costar:{mode:'snapshot',fileDate:info.mtime.toISOString()},matterport:{mode:units.every(u=>u.geometrySource.includes('cache'))?'cache':'live'}}};
  }
  return {name:'neighborhood-live-apartments',configureServer(server){
    server.middlewares.use('/api/neighborhood/portfolio',async(req,res)=>{
      const host=req.headers.host??'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin))){res.statusCode=403;res.end('{}');return;}
      if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      try{
        const query=new URL(req.url??'/','http://localhost').searchParams;
        if(query.get('status')==='1'){const {models,...status}=await measurementManifest();res.end(JSON.stringify(status));return;}
        const key=query.get('property');
        if(key){const property=(await portfolio()).properties.find(p=>p.id===key);if(!property){res.statusCode=404;res.end(JSON.stringify({error:'Unknown property.'}));return;}
          const detail=JSON.parse(await readFile(resolve(process.cwd(),'../work/neighborhood/property-data',property.id.replace(':','-')+'.json'),'utf8'));
          const manifest=await measurementManifest();res.end(JSON.stringify({...detail,measurements:Object.fromEntries(property.modelIds.map(id=>[id,manifest.models[id]??{status:'pending'}]))}));return;
        }
        res.end(JSON.stringify(await portfolio()));
      }catch{res.statusCode=503;res.end(JSON.stringify({error:'Prepare the private CoStar portfolio catalog first. See docs/PORTFOLIO-SOUND-MAP.md.'}));}
    });
    server.middlewares.use('/api/neighborhood/tours',async(req,res)=>{
      const host=req.headers.host??'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin))){res.statusCode=403;res.end('{}');return;}
      if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      try{
        if(!tourCache||Date.now()-tourCache.at>300000){
          tourPending??=readFile(resolve(process.cwd(),'../work/neighborhood/costar-tours.json'),'utf8')
            .then(raw=>enrichTours(JSON.parse(raw),env)).then(value=>{tourCache={at:Date.now(),value};return value;}).finally(()=>{tourPending=null;});
          await tourPending;
        }
        res.end(JSON.stringify(tourCache!.value));
      }catch{res.statusCode=502;res.end(JSON.stringify({error:'CoStar tour catalog unavailable. Prepare the local catalog from the sponsor export.'}));}
    });
    server.middlewares.use('/api/neighborhood/properties',async(req,res)=>{
      const host=req.headers.host??'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin))){res.statusCode=403;res.end('{}');return;}
      if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      try{
        const refresh=new URL(req.url??'/','http://localhost').searchParams.get('refresh')==='1';
        const modelId=new URL(req.url??'/','http://localhost').searchParams.get('modelId');
        if(modelId){
          const catalog:TourCatalog=JSON.parse(await readFile(resolve(process.cwd(),'../work/neighborhood/costar-tours.json'),'utf8'));
          let unit:PropertyUnitRequest;
          try{unit=catalogUnit(catalog,modelId);}catch{
            const property=(await portfolio()).properties.find(p=>p.modelIds.includes(modelId));
            if(!property||!(/^[a-zA-Z0-9]{8,20}$/).test(modelId)){res.statusCode=404;res.end(JSON.stringify({error:'Unknown CoStar tour ID.'}));return;}
            unit={propertyId:property.propertyId,modelId,address:property.address,name:property.name};
          }
          let entry=unitCache.get(modelId);
          if(!entry||Date.now()-entry.at>300000||refresh){
            if(!unitPending.has(modelId))unitPending.set(modelId,propertyRecords().then(records=>cachedPropertyUnit(unit,records,refresh)).then(value=>{unitCache.set(modelId,{at:Date.now(),value});return value;}).finally(()=>unitPending.delete(modelId)));
            await unitPending.get(modelId);entry=unitCache.get(modelId);
          }
          res.end(JSON.stringify({unit:entry!.value,fetchedAt:new Date(entry!.at).toISOString()}));return;
        }

        if(!cached||Date.now()-cached.at>300000||refresh){
          pending??=load().then(value=>{cached={at:Date.now(),value};return value;}).finally(()=>{pending=null;});
          await pending;
        }
        res.end(JSON.stringify(cached!.value));
      }catch(error){res.statusCode=502;res.end(JSON.stringify({error:error instanceof Error?error.message:'Apartment data unavailable'}));}
    });
  }};
}
