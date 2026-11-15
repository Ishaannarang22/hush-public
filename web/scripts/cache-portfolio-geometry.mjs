/** Download all sponsor-linked Model API measurements, not bulky MatterPaks.
 * Resumable: node web/scripts/cache-portfolio-geometry.mjs [--limit N] [--retry-errors]
 * Credentials: MATTERPORT_API_KEY / MATTERPORT_API_TOKEN, or the existing local
 * Vite process on port 5175. No credentials are written to disk or logs.
 */
import {readFile,writeFile,mkdir,rename,open,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PROPERTY_GEOMETRY_QUERY,propertyUnitFromModel} from '../server/neighborhood.ts';
import {makeApartments,toLocal} from '../src/neighborhood/simulation.ts';
const root=resolve(import.meta.dirname,'../..'),directory=resolve(root,'work/neighborhood/measurements');
await mkdir(directory,{recursive:true});
let lock;try{lock=await open(resolve(directory,'.lock'),'wx');await lock.writeFile(String(process.pid));}catch{throw new Error('A measurement download is already active; inspect work/neighborhood/measurements/.lock before resuming.');}
try{
 const env={...process.env};
 if(!env.MATTERPORT_API_KEY||!env.MATTERPORT_API_TOKEN){
  const pid=execFileSync('lsof',['-tiTCP:5175','-sTCP:LISTEN'],{encoding:'utf8'}).trim().split('\n')[0];
  const command=execFileSync('ps',['eww','-p',pid,'-o','command='],{encoding:'utf8'});
  for(const name of ['MATTERPORT_API_KEY','MATTERPORT_API_TOKEN'])env[name]??=command.match(new RegExp('(?:^|\\s)'+name+'=([^\\s]+)'))?.[1];
 }
 if(!env.MATTERPORT_API_KEY||!env.MATTERPORT_API_TOKEN)throw new Error('Matterport credentials are unavailable.');
 const catalog=JSON.parse(await readFile(resolve(root,'work/neighborhood/portfolio.json'),'utf8'));
 const origin=JSON.parse(await readFile(resolve(root,'web/public/neighborhood/scene.json'),'utf8')).origin;
 const all=[...new Set(catalog.properties.flatMap(p=>p.modelIds))].filter(id=>/^[a-zA-Z0-9]{8,20}$/.test(id)).sort();
 const limitIndex=process.argv.indexOf('--limit'),limit=limitIndex<0?Infinity:Number(process.argv[limitIndex+1]);
 if(!(limit>0))throw new Error('Limit must be positive');
 const manifestPath=resolve(directory,'manifest.json');let previous={models:{}};
 try{previous=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
 const manifest={schemaVersion:1,source:'Matterport Model API',startedAt:previous.startedAt??new Date().toISOString(),updatedAt:'',status:'running',total:all.length,models:previous.models??{},counts:{}};
 const retry=process.argv.includes('--retry-errors');
 const ids=all.filter(id=>!manifest.models[id]||(retry&&manifest.models[id].status==='error')).slice(0,limit);
 async function atomic(path,value){const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(value));await rename(tmp,path);}
 let checkpointQueue=Promise.resolve();
 function checkpoint(status='running'){checkpointQueue=checkpointQueue.then(()=>saveCheckpoint(status));return checkpointQueue;}
 async function saveCheckpoint(status='running'){
  manifest.status=status;manifest.updatedAt=new Date().toISOString();manifest.counts={downloaded:0,ready:0,missing:0,invalid:0,error:0};
  for(const id of all){const m=manifest.models[id];if(!m)continue;if(m.status!=='error')manifest.counts.downloaded++;manifest.counts[m.status]++;}
  await atomic(manifestPath,manifest);
 }
 await checkpoint();
 const body=PROPERTY_GEOMETRY_QUERY.slice('query($id:ID!){'.length,-1);
 let cursor=0,finished=0;
 async function batch(){
  while(cursor<ids.length){const group=ids.slice(cursor,cursor+=10);let payload,error;
   for(let attempt=0;attempt<3;attempt++){
    try{
     const response=await fetch('https://api.matterport.com/api/models/graph',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',Authorization:`Basic ${Buffer.from(`${env.MATTERPORT_API_KEY}:${env.MATTERPORT_API_TOKEN}`).toString('base64')}`},body:JSON.stringify({query:'query{'+group.map((id,i)=>`m${i}:`+body.replace('model(id:$id)',`model(id:"${id}")`)).join(' ')+'}'})});
     if(response.status===429){await new Promise(r=>setTimeout(r,Math.min(60000,Math.max(1000,Number(response.headers.get('retry-after')??2)*1000))));throw new Error('Rate limited');}
     if(!response.ok)throw new Error(`HTTP ${response.status}`);
     payload=await response.json();if(!payload.data)throw new Error(payload.errors?.[0]?.message??'No model data');break;
    }catch(e){error=e.message;if(attempt<2)await new Promise(r=>setTimeout(r,1000*2**attempt));}
   }
   for(let i=0;i<group.length;i++){
    const id=group[i],model=payload?.data?.[`m${i}`];
    if(!model||model.id!==id){manifest.models[id]={status:'error',reason:error??'Model unavailable in account',fetchedAt:new Date().toISOString()};continue;}
    let summary={status:'missing',rooms:model.rooms?.length??0,walls:0,windows:0,doors:0,floors:0,reason:null,fetchedAt:new Date().toISOString()};
    try{
     const unit=propertyUnitFromModel({propertyId:0,modelId:id,address:''},model,[]);
     if(!unit.geometryAvailable)summary.reason=unit.geometryReason;
     else {const a=makeApartments([unit],origin,false)[0];if(!a?.rooms.length)throw new Error('No closed room regions');toLocal(a.frame.origin,a.frame);
      summary={...summary,status:'ready',...a.geometry,rooms:a.rooms.length,floors:new Set(model.rooms.map(r=>r.floor?.id??'default')).size,assumedHeights:a.geometry.assumedHeights};}
    }catch(e){summary.status='invalid';summary.reason=e.message;}
    await atomic(resolve(directory,id+'.json'),{model,summary});manifest.models[id]=summary;
   }
   finished+=group.length;
   // Three bounded request queues share serialized atomic checkpoints.
   await checkpoint();if(finished%100===0||finished===ids.length)console.log(JSON.stringify({processed:finished,requested:ids.length,...manifest.counts}));
   await new Promise(r=>setTimeout(r,100));
  }
 }
 await Promise.all([batch(),batch(),batch()]);await checkpoint(all.every(id=>manifest.models[id])?'complete':'partial');console.log(JSON.stringify({status:manifest.status,total:manifest.total,...manifest.counts}));
}finally{await lock.close();await unlink(resolve(directory,'.lock'));}
