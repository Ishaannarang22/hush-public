import { EnvelopeScreeningModel, type EnvelopeSettings, type EnvironmentSource, type Geo, type PortfolioProperty, type PropertyExposure } from './portfolioModel.ts';
import { A_WEIGHTING, decibels, energy } from '../acoustics/engine/domain.ts';

// Bump whenever screening physics, source spectra, or material coefficients change.
export const PORTFOLIO_CACHE_VERSION='envelope-fields-v2';
export type FieldStore={get:(key:string)=>Promise<PropertyExposure[]|undefined>;put:(key:string,value:PropertyExposure[])=>Promise<void>};
export type CacheStats={memoryHits:number;diskHits:number;computed:number;entries:number};
async function digest(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
/** A source field is normalized to 0 dBA. Volume and enable/disable edits only
 * rescale/sum energies. Pose, spectrum, envelope, receiver data and model version
 * are all part of its content key; stale source data cannot reuse a field. */
export class PortfolioFieldCache {
  private fields=new Map<string,PropertyExposure[]>();
  private datasets=new WeakMap<PortfolioProperty[],Promise<string>>();
  private bytes=0;
  readonly store?:FieldStore;
  readonly maxBytes:number;
  stats:CacheStats={memoryHits:0,diskHits:0,computed:0,entries:0};
  constructor(store?:FieldStore,maxBytes=32*1024*1024){this.store=store;this.maxBytes=maxBytes;}
  private remember(key:string,value:PropertyExposure[]){
    const size=value.length*256;
    while(this.bytes+size>this.maxBytes&&this.fields.size){const first=this.fields.keys().next().value!;this.bytes-=this.fields.get(first)!.length*256;this.fields.delete(first);}
    if(size<=this.maxBytes){this.fields.set(key,value);this.bytes+=size;}
    this.stats.entries=this.fields.size;
  }
  async calculate(properties:PortfolioProperty[],sources:EnvironmentSource[],origin:Geo,settings:EnvelopeSettings){
    // Validate settings even when no active sources or a warm cache is used.
    const model=new EnvelopeScreeningModel(origin,settings);
    if(!this.datasets.has(properties))this.datasets.set(properties,digest(properties.map(p=>({id:p.id,lat:p.lat,lon:p.lon,floorAreaM2:p.floorAreaM2,stories:p.stories,acousticProfile:p.acousticProfile}))));
    const dataset=await this.datasets.get(properties)!;
    const active=sources.filter(s=>s.enabled);
    const fields:{source:EnvironmentSource;field:PropertyExposure[]}[]=[];
    for(const source of active){
      if(![source.lat,source.lon,source.height,source.level].every(Number.isFinite))throw new Error('Source values must be finite.');
      const key=await digest({version:PORTFOLIO_CACHE_VERSION,dataset,origin,settings,source:{lat:source.lat,lon:source.lon,height:source.height,kind:source.kind}});
      let field=this.fields.get(key);
      if(field){this.stats.memoryHits++;this.fields.delete(key);this.fields.set(key,field);}
      else {
        try{field=await this.store?.get(key);}catch{/* Browser storage may be disabled or full. */}
        if(field){this.stats.diskHits++;}
        else {// Evaluate at 120 dBA before normalization so the display floor at -120 dB
          // cannot inject energy into quiet, distant octave bands.
          field=model.calculate(properties,[{...source,id:'unit-source',level:120,enabled:true}]).map(f=>({...f,outdoor:f.outdoor!-120,indoor:f.indoor!-120,bands:f.bands.map(db=>db-120)}));this.stats.computed++;try{await this.store?.put(key,field);}catch{/* Memory reuse remains available. */}}
        this.remember(key,field);
      }
      fields.push({source,field});
    }
    return properties.map((p,index):PropertyExposure=>{
      if(!fields.length)return {id:p.id,outdoor:null,indoor:null,reduction:null,bands:[],dominantSource:null};
      let outside=0,max=-Infinity,dominantSource:string|null=null;const bands=A_WEIGHTING.map(()=>0);
      for(const {source,field} of fields){const f=field[index],scale=energy(source.level),out=energy(f.outdoor!)*scale;outside+=out;if(out>max){max=out;dominantSource=source.id;}f.bands.forEach((db,i)=>bands[i]+=energy(db)*scale);}
      const outdoor=decibels(outside),indoor=decibels(bands.reduce((sum,e,i)=>sum+e*energy(A_WEIGHTING[i]),0));
      return {id:p.id,outdoor,indoor,reduction:outdoor-indoor,bands:bands.map(decibels),dominantSource};
    });
  }
}

/** Private local browser cache: 24-hour TTL, <=64 fields / 64 MiB. */
export function browserFieldStore():FieldStore {
  let connection:Promise<IDBDatabase>|undefined;
  const connect=()=>connection??=(new Promise((resolve,reject)=>{
    const request=indexedDB.open('hush-source-fields',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('fields',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }));
  return {
    async get(key){const db=await connect();return new Promise((resolve,reject)=>{const request=db.transaction('fields').objectStore('fields').get(key);request.onsuccess=()=>resolve(request.result?.expires>Date.now()?request.result.value:undefined);request.onerror=()=>reject(request.error);});},
    async put(key,value){const db=await connect();return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('fields','readwrite'),store=tx.objectStore('fields'),now=Date.now();
      store.put({key,value,at:now,expires:now+86400000,bytes:value.length*256});
      const all=store.getAll();all.onsuccess=()=>{let bytes=0,count=0;for(const row of all.result.sort((a,b)=>b.at-a.at)){bytes+=row.bytes;count++;if(row.expires<=now||count>64||bytes>64*1024*1024)store.delete(row.key);}};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}
  };
}
