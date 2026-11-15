import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { vexcel3dHandler } from './vexcel-3d.ts';
import type { Plugin } from 'vite';
import { STUDY_BOUNDS } from '../src/neighborhood/study.ts';
import { worldToGeographic, type Building, type District, type Imagery, type Point2 } from '../src/neighborhood/data.ts';
const API='https://api.vexcelgroup.com/v2';
const DETAIL:[number,number,number,number]=[-240,-120,120,190];
export function vexcelNeighborhoodApi(env:Record<string,string>):Plugin {
  const serve3d=vexcel3dHandler(env);
  const cache=resolve(process.cwd(),'../work/neighborhood/vexcel-live');
  const pending=new Map<string,Promise<Buffer>>();
  async function seed(){return JSON.parse(await readFile(resolve(process.cwd(),'public/neighborhood/scene.json'),'utf8')) as District;}
  async function load(name:string,request:()=>Promise<Buffer>,refresh=false){
    if(!refresh){try{const info=await stat(resolve(cache,name));if(Date.now()-info.mtimeMs<24*3600000)return await readFile(resolve(cache,name));}catch{/* no cache yet */}}
    if(!pending.has(name))pending.set(name,(async()=>{const body=await request();await mkdir(cache,{recursive:true});await writeFile(resolve(cache,name),body);return body;})().finally(()=>pending.delete(name)));
    return pending.get(name)!;
  }
  function headers(){if(!env.VEXCEL_API_KEY)throw new Error('Vexcel API key is not configured.');return {'X-API-KEY':env.VEXCEL_API_KEY,'Content-Type':'application/json'};}
  function geographicWkt(bounds:number[],data:District){const [x0,z0,x1,z1]=bounds;const points=[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]].map(([x,z])=>{const g=worldToGeographic(x,z,data.origin);return `${g.lon} ${g.lat}`;});return `POLYGON((${points.join(',')}))`;}
  async function structures(refresh:boolean){return load('scene-v3.json',async()=>{
    const data=await seed(),params=new URLSearchParams({wkt:geographicWkt(STUDY_BOUNDS,data),srid:'4326',layer:'urban',latest:'true',include:'precomputed','unit-system':'metric','page-size':'500','total-records':'1500'});
    const response=await fetch(`${API}/structure/extract?${params}`,{headers:headers(),signal:AbortSignal.timeout(55000)});
    if(!response.ok)throw new Error(`Vexcel structures returned HTTP ${response.status}`);
    const raw=await response.json();if(!Array.isArray(raw.features)||!raw.features.length)throw new Error('Vexcel returned no structures for this study area.');
    let pageCount=raw.features.length;
    for(let page=2;page<=3&&pageCount===500;page++){
      params.set('page',String(page));
      const next=await fetch(`${API}/structure/extract?${params}`,{headers:headers(),signal:AbortSignal.timeout(45000)});
      if(!next.ok)throw new Error(`Vexcel structure page returned HTTP ${next.status}`);
      const body=await next.json();pageCount=body.features?.length??0;raw.features.push(...(body.features??[]));
    }
    // Derived height queries are expensive. Measure the apartment cluster in a
    // bounded request; keep other missing heights explicitly estimated.
    const heightParams=new URLSearchParams({wkt:'POINT(-95.7051799 29.7955898)',srid:'4326','buffer-meter':'80',layer:'urban',latest:'true',include:'precomputed,calculated','unit-system':'metric','page-size':'10','total-records':'10'});
    const heightResponse=await fetch(`${API}/structure/extract?${heightParams}`,{headers:headers(),signal:AbortSignal.timeout(45000)});
    if(!heightResponse.ok)throw new Error(`Vexcel apartment heights returned HTTP ${heightResponse.status}`);
    const heightData=await heightResponse.json();
    const heights=new Map<string,number>((heightData.features??[]).map((f:{properties:Record<string,unknown>})=>[String(f.properties['footprint.wkt']),Number(f.properties['roof-characteristics.height'])]));
    const project=([lon,lat]:number[]):Point2=>[(6378137*lon*Math.PI/180-data.origin.mercatorX)*data.origin.scale,(data.origin.mercatorY-6378137*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)))*data.origin.scale];
    const buildings:Building[]=[],seen=new Set<string>();
    for(const feature of raw.features){
      const p=feature.properties??{},geometry=feature.geometry,polygons=geometry?.type==='MultiPolygon'?geometry.coordinates:geometry?.type==='Polygon'?[geometry.coordinates]:[];
      for(const polygon of polygons){
        const rings:Point2[][]=polygon.map((ring:number[][])=>ring.map(project));if(!rings[0]?.length)continue;
        const hash=createHash('sha1').update(JSON.stringify(polygon)).digest('hex').slice(0,16);
        if(seen.has(hash))continue;seen.add(hash);
        const known=Number(p['roof-characteristics.height']??heights.get(p['footprint.wkt'])??p['roof-characteristics.eave-height']),valid=Number.isFinite(known)&&known>1;
        const center:Point2=[rings[0].reduce((sum,v)=>sum+v[0],0)/rings[0].length,rings[0].reduce((sum,v)=>sum+v[1],0)/rings[0].length];
        buildings.push({id:`vexcel-${hash}`,sourceId:hash,rings,center,area:Number(p['footprint.area'])||0,height:valid?known:6,
          heightBasis:valid?'Vexcel calculated roof height above ground':'Estimated display height; Vexcel height unavailable',heightMeasured:valid,
          type:String(p['building-type.class']??'Building'),address:null,name:null,reference:null,source:'Vexcel live API',imageDate:null,
          roofShape:p['roof-characteristics.shape.value']??null,roofMaterial:p['roof-characteristics.material.class']??null});
      }
    }
    const imagery:Imagery[]=[{name:'Vexcel district',bounds:STUDY_BOUNDS,width:3072,height:3548,url:'/api/neighborhood/vexcel/imagery?detail=district'},
      {name:'Vexcel apartments',bounds:DETAIL,width:3072,height:2645,url:'/api/neighborhood/vexcel/imagery?detail=apartments'}];
    return Buffer.from(JSON.stringify({buildings,imagery,fetchedAt:new Date().toISOString(),source:'Vexcel live API',captureDate:raw.features[0].properties?.['metadata.ortho-date-estimate'],
      collection:raw.features[0].properties?.['metadata.collection'],limit:1500,truncated:pageCount===500}));
  },refresh);}
  async function imagery(detail:string){const fine=detail==='apartments';return load(fine?'apartments.jpg':'district.jpg',async()=>{
    const data=await seed(),bounds=fine?DETAIL:STUDY_BOUNDS;
    const response=await fetch(`${API}/ortho/extract`,{method:'POST',headers:headers(),signal:AbortSignal.timeout(55000),body:JSON.stringify({wkt:geographicWkt(bounds,data),srid:4326,layer:'urban',crop:'bounding_box','buffer-meter':0,'image-format':'jpeg','destination-dimensions':fine?'3072,2645':'3072,3548'})});
    if(!response.ok)throw new Error(`Vexcel imagery returned HTTP ${response.status}`);
    const body=Buffer.from(await response.arrayBuffer());if(body[0]!==0xff||body[1]!==0xd8)throw new Error('Vexcel did not return a JPEG image.');return body;
  });}
  return {name:'vexcel-neighborhood-live',configureServer(server){server.middlewares.use('/api/neighborhood/vexcel',async(req,res)=>{
    const host=req.headers.host??'';
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin))){res.statusCode=403;res.end('{}');return;}
    if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
    const url=new URL(req.url??'/','http://localhost');res.setHeader('Cache-Control','no-store');
    try{if(url.pathname.startsWith('/3d/')){await serve3d(req,res,url);}
      else if(url.pathname==='/scene'){res.setHeader('Content-Type','application/json');res.end(await structures(url.searchParams.get('refresh')==='1'));}
      else if(url.pathname==='/imagery'){res.setHeader('Content-Type','image/jpeg');res.end(await imagery(url.searchParams.get('detail')??'district'));}
      else{res.statusCode=404;res.end('{}');}
    }catch(error){res.statusCode=502;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error instanceof Error?error.message:'Vexcel unavailable'}));}
  });}};
}
