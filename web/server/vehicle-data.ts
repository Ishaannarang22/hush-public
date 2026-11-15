import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
const execFileAsync=promisify(execFile);
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
type RouteResponse={routes?:{distanceMeters?:number;duration?:string;staticDuration?:string}[]};
export function routeSpeed(body:RouteResponse){
  const route=body.routes?.[0],duration=Number(route?.duration?.replace(/s$/,'')),distance=route?.distanceMeters;
  if(!distance||!Number.isFinite(duration)||duration<=0)throw new Error('Google returned no usable route duration.');
  const speed=distance/duration*3.6;
  if(!Number.isFinite(speed)||speed<1||speed>140)throw new Error('Google route speed is outside the supported model range.');
  return {speedKmh:speed,distanceM:distance,durationSeconds:duration};
}
/** Bounded provider requests, no client-supplied URLs or credentials. */
export async function googleTraffic(env:Record<string,string>,request:typeof fetch=fetch){
  const key=env.GOOGLE_MAPS_API_KEY||env.GOOGLE_ROUTES_API_KEY;
  if(!key)return {status:'not-configured',routes:[],streetView:{status:'not-configured'},note:'No Google API key configured. Vehicle locations/counts remain scenarios.'};
  const north={latitude:29.7967463,longitude:-95.7044927},south={latitude:29.7857023,longitude:-95.7061143};
  const routes=await Promise.all([['northbound',south,north],['southbound',north,south]].map(async([direction,origin,destination])=>{
    try{
      const response=await request('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',signal:AbortSignal.timeout(15000),
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.staticDuration'},
        body:JSON.stringify({origin:{location:{latLng:origin}},destination:{location:{latLng:destination}},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE_OPTIMAL'})});
      if(!response.ok)throw new Error(`Google Routes HTTP ${response.status}`);
      return {direction,road:'Greenhouse Road',status:'live',...routeSpeed(await response.json()),fetchedAt:new Date().toISOString(),source:'Google Routes traffic-aware travel time',note:'Route-average speed estimate, not individual vehicle tracking or a vehicle count.'};
    }catch(error){return {direction,road:'Greenhouse Road',status:'unavailable',error:error instanceof Error?error.message:'Google traffic unavailable'};}
  }));
  let streetView:Record<string,unknown>;
  try{
    const params=new URLSearchParams({location:'29.7955898,-95.7049',radius:'75',source:'outdoor',key:env.GOOGLE_STREET_VIEW_API_KEY||key});
    const response=await request(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`Street View HTTP ${response.status}`);
    const d=await response.json();streetView={status:d.status==='OK'?'available':String(d.status??'unavailable'),date:d.date??null,copyright:d.copyright??null,panoId:d.pano_id??null,
      note:'Dated panorama metadata only; no vehicle observations or counts have been extracted.'};
  }catch{streetView={status:'unavailable',note:'Street View metadata could not be retrieved.'};}
  return {status:routes.some(r=>r.status==='live')?'live':'unavailable',routes,streetView,note:'Google supplies route-average speed estimates. Counts, vehicle classes and individual positions are scenario inputs.'};
}
export function vehicleDataApi(env:Record<string,string>):Plugin{
  let emissions:Promise<unknown>|null=null,traffic:Promise<unknown>|null=null,trafficAt=0;
  const emissionModel=()=>emissions??=(async()=>{try{const r=await execFileAsync(env.HUSH_PYTHON||process.env.HUSH_PYTHON||'python3',['-m','noisemodel.vehicle_emissions'],{cwd:ROOT,timeout:30000,maxBuffer:2*1024*1024});return JSON.parse(r.stdout);}catch{emissions=null;throw new Error('The shared vehicle emission model could not run. Check the server Python environment.');}})();
  return {name:'neighborhood-vehicle-data',configureServer(server){server.middlewares.use('/api/neighborhood/vehicle-data',async(req,res)=>{
    const host=req.headers.host??'';
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin))){res.statusCode=403;res.end('{}');return;}
    if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    try{if(!traffic||Date.now()-trafficAt>5*60_000){trafficAt=Date.now();traffic=googleTraffic(env);}
      const [model,google]=await Promise.all([emissionModel(),traffic]);res.end(JSON.stringify({model,google,fetchedAt:new Date().toISOString()}));
    }catch(error){res.statusCode=502;res.end(JSON.stringify({error:error instanceof Error?error.message:'Vehicle model unavailable'}));}
  });}};
}
