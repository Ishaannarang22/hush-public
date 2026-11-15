import test from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioFieldCache } from '../src/neighborhood/portfolioCache.ts';
import { EnvelopeScreeningModel, DEFAULT_ENVELOPE, REGIONS } from '../src/neighborhood/portfolioModel.ts';
const origin=REGIONS.houston.center,settings={...DEFAULT_ENVELOPE};
const homes=Array.from({length:20},(_,i)=>({id:'home-'+i,lat:origin.lat+i*.001,lon:origin.lon+i*.002,floorAreaM2:150,stories:2}));
const sources=[{id:'traffic',kind:'traffic',...origin,height:1,level:85,enabled:true},{id:'rail',kind:'rail',lat:origin.lat+.02,lon:origin.lon+.01,height:2,level:98,enabled:true}];
function equal(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((a,i)=>{const b=expected[i];assert.equal(a.id,b.id);assert.equal(a.dominantSource,b.dominantSource);for(const k of ['outdoor','indoor','reduction'])assert.ok(Math.abs(a[k]-b[k])<1e-9,`${k} mismatch`);a.bands.forEach((v,j)=>assert.ok(Math.abs(v-b.bands[j])<1e-9));});}
test('cached energy fields agree with original screening across volume, mute and source moves',async()=>{
 const cache=new PortfolioFieldCache();
 equal(await cache.calculate(homes,sources,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,sources));assert.equal(cache.stats.computed,2);
 const louder=sources.map(s=>({...s,level:s.level+12}));
 equal(await cache.calculate(homes,louder,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,louder));assert.equal(cache.stats.computed,2);assert.equal(cache.stats.memoryHits,2);
 const moved=[{...sources[0],lon:origin.lon+.01},sources[1]];
 equal(await cache.calculate(homes,moved,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,moved));assert.equal(cache.stats.computed,3);
 const muted=sources.map(s=>({...s,enabled:false}));assert.deepEqual(await cache.calculate(homes,muted,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,muted));
});
test('keys invalidate for changed envelope, receiver profile, height, spectrum and origin; source IDs are not physics',async()=>{
 const cache=new PortfolioFieldCache();await cache.calculate(homes,sources,origin,settings);
 await cache.calculate(homes,sources,origin,{...settings,windowsOpen:true});assert.equal(cache.stats.computed,4);
 await cache.calculate(homes.map(p=>({...p,acousticProfile:{roomAreaM2:12}})),sources,origin,settings);assert.equal(cache.stats.computed,6);
 await cache.calculate(homes,[{...sources[0],height:30}],origin,settings);assert.equal(cache.stats.computed,7);
 await cache.calculate(homes,[{...sources[0],kind:'mechanical'}],origin,settings);assert.equal(cache.stats.computed,8);
 await cache.calculate(homes,[sources[0]],{...origin,lat:origin.lat+.001},settings);assert.equal(cache.stats.computed,9);
 const renamed=[{...sources[0],id:'new-id'}],result=await cache.calculate(homes,renamed,origin,settings);assert.equal(cache.stats.computed,9);assert.equal(result[0].dominantSource,'new-id');
});
test('persistent fields survive a new cache instance; unavailable storage remains functional',async()=>{
 const disk=new Map(),store={get:async key=>disk.get(key),put:async(key,value)=>{disk.set(key,value);}};
 await new PortfolioFieldCache(store).calculate(homes,sources,origin,settings);
 const next=new PortfolioFieldCache(store);equal(await next.calculate(homes,sources,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,sources));assert.equal(next.stats.diskHits,2);assert.equal(next.stats.computed,0);
 const unavailable={get:async()=>{throw Error('offline');},put:async()=>{throw Error('quota');}};equal(await new PortfolioFieldCache(unavailable).calculate(homes,sources,origin,settings),new EnvelopeScreeningModel(origin,settings).calculate(homes,sources));
});
test('bounded cache evicts old fields, validates inputs and computes empty sources correctly',async()=>{
 const cache=new PortfolioFieldCache(undefined,homes.length*256);await cache.calculate(homes,sources,origin,settings);assert.equal(cache.stats.entries,1);
 await assert.rejects(cache.calculate(homes,[],origin,{...settings,windowFraction:2}));
 await assert.rejects(cache.calculate(homes,[{...sources[0],height:NaN}],origin,settings));
});
