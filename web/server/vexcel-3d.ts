import type { IncomingMessage, ServerResponse } from 'node:http';

export const VEXCEL_COLLECTION='us-tx-houstonr2-2023';
const API='https://api.vexcelgroup.com/v2/3d/';
const PREFIX='/api/neighborhood/vexcel/3d/';
// A small envelope around the existing Greenhouse Road study, in radians.
const AREA=[-95.716,29.781,-95.700,29.798].map(v=>v*Math.PI/180);
type Tile={boundingVolume?:{region?:number[]};content?:{uri?:string;url?:string};contents?:{uri?:string;url?:string}[];children?:Tile[]};
export function rewriteVexcelTiles(tile:Tile,base:string,portfolio=false):void {
  if(tile.children&&!portfolio)tile.children=tile.children.filter(child=>{
    const r=child.boundingVolume?.region;
    return !r||!(r[2]<AREA[0]||r[0]>AREA[2]||r[3]<AREA[1]||r[1]>AREA[3]);
  });
  for(const content of [tile.content,...(tile.contents??[])]){
    if(!content)continue;
    const source=content.uri??content.url;if(!source)continue;
    const remote=new URL(source,base);
    if(remote.origin!=='https://api.vexcelgroup.com'||!/^\/v2\/3d\/(tileset|tile)$/.test(remote.pathname))throw new Error('Unexpected Vexcel tile address.');
    // Never deliver a provider token to the browser.
    remote.searchParams.delete('token');remote.searchParams.delete('api_key');
    const endpoint=remote.pathname.split('/').pop();
    if(portfolio)remote.searchParams.set('scope','portfolio');
    content.uri=PREFIX+endpoint+(endpoint==='tileset'?'.json':'.glb')+remote.search;delete content.url;
  }
  tile.children?.forEach(child=>rewriteVexcelTiles(child,base,portfolio));
}
export function vexcel3dHandler(env:Record<string,string>){
  const cache=new Map<string,{body:Buffer;type:string}>();
  const pending=new Map<string,Promise<{body:Buffer;type:string}>>();
  let bytes=0;
  const allowedCollections=new Set([VEXCEL_COLLECTION]);
  const coverage=new Map<string,{at:number;body:string}>();
  async function discover(url:URL){
    const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon'));
    if(!url.searchParams.has('lat')||!url.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||!((lat>=28&&lat<=31&&lon>=-97&&lon<=-94)||(lat>=32&&lat<=35.5&&lon>=-120&&lon<=-116)))throw new Error('Location is outside the CoStar study regions.');
    const key=`${lat.toFixed(4)},${lon.toFixed(4)}`,cached=coverage.get(key);
    if(cached&&Date.now()-cached.at<86400000)return cached.body;
    if(!env.VEXCEL_API_KEY)throw new Error('Vexcel API key is not configured.');
    const query=new URLSearchParams({wkt:`POINT(${lon} ${lat})`,srid:'4326',include:'collection,first-capture-date,last-capture-date,min-gsd,max-gsd','page-size':'20','total-records':'20'});
    const response=await fetch(API+'collections?'+query,{headers:{'X-API-KEY':env.VEXCEL_API_KEY},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Vexcel coverage returned HTTP ${response.status}.`);
    const json=await response.json();
    const collections=(json.features??[]).map((f:{properties:Record<string,unknown>})=>f.properties).filter((p:Record<string,unknown>)=>typeof p.collection==='string').sort((a:Record<string,string>,b:Record<string,string>)=>(b['last-capture-date']??'').localeCompare(a['last-capture-date']??''));
    for(const c of collections)allowedCollections.add(c.collection);
    const body=JSON.stringify({collections,selected:collections[0]??null,checkedAt:new Date().toISOString()});
    if(coverage.size>=256)coverage.delete(coverage.keys().next().value!);
    coverage.set(key,{at:Date.now(),body});return body;
  }
  return async(_req:IncomingMessage,res:ServerResponse,url:URL)=>{
    if(url.pathname==='/3d/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({cached:cache.size,bytes,pending:pending.size,meshes:[...cache.values()].filter(v=>v.type==='model/gltf-binary').length}));return;}
    if(url.pathname==='/3d/coverage'){res.setHeader('Content-Type','application/json');res.end(await discover(url));return;}
    const portfolio=url.searchParams.get('scope')==='portfolio';
    url.searchParams.delete('scope');
    url.pathname=url.pathname.replace(/\.(json|glb)$/,'');
    if(!['/3d/tileset','/3d/tile'].includes(url.pathname)){res.statusCode=404;res.end('{}');return;}
    const query=new URLSearchParams();
    for(const [key,value] of url.searchParams){
      if(['collection','childAOI'].includes(key)){
        if(!allowedCollections.has(value))throw new Error('This collection is outside the study.');
      }else if(key==='layer'){
        if(value!=='3d-cities')throw new Error('Invalid 3D layer.');
      }else if(key==='latest'){
        if(value!=='true')throw new Error('Invalid capture selection.');
      }else if(!['zoom','tile-x','tile-y'].includes(key)||!/^\d{1,10}$/.test(value))throw new Error('Invalid tile parameter.');
      query.set(key,value);
    }
    if(!query.has('childAOI')&&!query.has('collection'))query.set('collection',VEXCEL_COLLECTION);
    const remote=API+url.pathname.split('/').pop()+'?'+query;
    if(!env.VEXCEL_API_KEY)throw new Error('Vexcel API key is not configured.');
    const cacheKey=remote+(portfolio?'#portfolio':'#district');
    if(!cache.has(cacheKey)&&!pending.has(cacheKey))pending.set(cacheKey,(async()=>{
      const response=await fetch(remote,{headers:{'X-API-KEY':env.VEXCEL_API_KEY},redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`Vexcel 3D returned HTTP ${response.status}.`);
      let body=Buffer.from(await response.arrayBuffer());
      const type=url.pathname.endsWith('tileset')?'application/json':'model/gltf-binary';
      if(type==='application/json'){
        const json=JSON.parse(body.toString());rewriteVexcelTiles(json.root,remote,portfolio);body=Buffer.from(JSON.stringify(json));
      }
      // Memory-only bounded cache: no long-lived copies of sponsor meshes.
      while(bytes+body.length>128*1024*1024&&cache.size){const first=cache.keys().next().value!;bytes-=cache.get(first)!.body.length;cache.delete(first);}
      if(body.length<128*1024*1024){cache.set(cacheKey,{body,type});bytes+=body.length;}
      return {body,type};
    })().finally(()=>pending.delete(cacheKey)));
    const result=cache.get(cacheKey)??await pending.get(cacheKey)!;
    res.setHeader('Cache-Control','private, max-age=3600');
    res.setHeader('Content-Type',result.type);res.end(result.body);
  };
}
