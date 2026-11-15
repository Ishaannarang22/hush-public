import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {makeVehicleTracks,vehicleAt} from '../src/neighborhood/vehicles.ts';
import {cropStudy} from '../src/neighborhood/study.ts';
import {emitterSources,DEFAULT_SCENARIO,makeApartments,toLocal} from '../src/neighborhood/simulation.ts';
import {receiverContributions} from '../src/neighborhood/receivers.ts';
import {AcousticScene,GeometricAcousticSolver} from '../src/acoustics/engine/solver.ts';
import {googleTraffic,routeSpeed} from '../server/vehicle-data.ts';
const model=JSON.parse(execFileSync(process.env.HUSH_PYTHON??'python3',['-m','noisemodel.vehicle_emissions'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
const provider={model,fetchedAt:'test',google:{status:'not-configured',routes:[],streetView:{status:'not-configured'}}};
const district=cropStudy(JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8')));

test('every rendered vehicle has one stable matching acoustic source, including 0 and 36 vehicles',()=>{
  const complete={...district,roads:[...district.roads,{...district.roads[0],id:'test-highway',name:'Test highway',kind:'motorway'},{...district.roads[0],id:'test-residential',name:'Test residential',kind:'residential'}]};
  for(const fleet of [{highway:0,arterial:0,residential:0},DEFAULT_SCENARIO.fleet,{highway:12,arterial:12,residential:12}]){
    const tracks=makeVehicleTracks(complete,fleet,provider),poses=tracks.map((t,i)=>vehicleAt(t,12,i));
    const sources=emitterSources(poses.map(p=>p.emitter),{...DEFAULT_SCENARIO,fleet},model);
    assert.equal(sources.length,Object.values(fleet).reduce((a,b)=>a+b,0));
    assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
    poses.forEach((p,i)=>{assert.equal(p.emitter.id,sources[i].id);assert.equal(p.position[0],sources[i].position.x);assert.equal(p.position[2],sources[i].position.z);assert.equal(p.position[1]+.7,sources[i].position.y);});
  }
  assert.throws(()=>makeVehicleTracks(district,{highway:99,arterial:0,residential:0},provider));
});
test('muting, isolating and moving a car change only the intended source contract',()=>{
  const tracks=makeVehicleTracks(district,DEFAULT_SCENARIO.fleet,provider),emitters=tracks.map((t,i)=>vehicleAt(t,0,i).emitter),id=emitters[0].id;
  assert.equal(emitterSources(emitters,{...DEFAULT_SCENARIO,mutedVehicles:[id]},model).length,emitters.length-1);
  assert.deepEqual(emitterSources(emitters,{...DEFAULT_SCENARIO,soloVehicle:id},model).map(s=>s.id),[id]);
  const moved=vehicleAt(tracks[0],1,0).emitter;
  assert.ok(Math.hypot(moved.position.x-emitters[0].position.x,moved.position.z-emitters[0].position.z)>1);
  assert.equal(moved.id,id);
  assert.throws(()=>emitterSources([...emitters,emitters[0]],DEFAULT_SCENARIO,model));
});
test('Google traffic estimates affect speed and emissions, without becoming observed cars or counts',async()=>{
  let calls=0;
  const absent=await googleTraffic({},async()=>{calls++;throw new Error('Must not call network');});
  assert.equal(absent.status,'not-configured');assert.equal(calls,0);
  const response=await googleTraffic({GOOGLE_MAPS_API_KEY:'test-only'},async(url,options)=>{
    calls++;
    if(String(url).includes('streetview'))return new Response(JSON.stringify({status:'OK',date:'2024-07',pano_id:'test-pano',copyright:'Test fixture'}));
    assert.equal(options.headers['X-Goog-Api-Key'],'test-only');
    return new Response(JSON.stringify({routes:[{distanceMeters:1200,duration:'120s'}]}));
  });
  assert.equal(calls,3);assert.equal(response.status,'live');assert.equal(response.streetView.date,'2024-07');
  assert.ok(!JSON.stringify(response).includes('test-only'));
  const tracks=makeVehicleTracks(district,DEFAULT_SCENARIO.fleet,{...provider,google:response});
  for(const track of tracks.filter(t=>t.road.name==='Greenhouse Road')){assert.equal(track.speed,10);assert.match(track.speedEvidence,/Google/);}
  assert.equal(tracks.length,4);
  assert.throws(()=>routeSpeed({routes:[{distanceMeters:100,duration:'0s'}]}));
});
test('each rendered vehicle contributes to both real interiors; per-car energy sums match the combined solver',{skip:!process.env.HUSH_SITE_FIXTURE},async()=>{
  const units=JSON.parse(await readFile(process.env.HUSH_SITE_FIXTURE,'utf8')).units;
  const apartments=makeApartments(units,district.origin,false);
  const tracks=makeVehicleTracks(district,DEFAULT_SCENARIO.fleet,provider),emitters=tracks.map((t,i)=>vehicleAt(t,0,i).emitter);
  const sources=emitterSources(emitters,DEFAULT_SCENARIO,model);
  for(const apartment of apartments){
    const solver=new GeometricAcousticSolver(new AcousticScene(apartment.scene)),local=sources.map(s=>({...s,position:toLocal(s.position,apartment.frame)}));
    const totals=Object.fromEntries(local.map(s=>[s.id,0]));
    for(const room of apartment.rooms){
      const split=receiverContributions(solver,room.probe,local),combined=solver.evaluate(room.probe,local);
      assert.deepEqual(Object.keys(split.bySource),local.map(s=>s.id));
      split.total.forEach((e,b)=>assert.ok(Math.abs(e-combined.total[b])<=Math.max(1e-10,e*1e-10)));
      for(const s of local)totals[s.id]+=solver.evaluate(room.probe,[s]).total.reduce((a,b)=>a+b,0);
    }
    for(const [id,energy] of Object.entries(totals))assert.ok(energy>0,`${id} must affect ${apartment.id}`);
    const room=apartment.rooms.find(r=>r.name==='Bedroom'),all=receiverContributions(solver,room.probe,local),one=receiverContributions(solver,room.probe,[local[0]]);
    assert.ok(all.db>one.db);assert.equal(receiverContributions(solver,room.probe,[]).db,-120);
    const doubled=receiverContributions(solver,room.probe,[local[0],{...local[0],id:'identical-second-car'}]);
    assert.ok(Math.abs(doubled.db-one.db-10*Math.log10(2))<1e-8);
  }
});


test('the shipped scene runs only independently sourced TxDOT routes',()=>{
  const tracks=makeVehicleTracks(district,{highway:12,arterial:4,residential:12},provider);
  assert.equal(tracks.length,4);
  assert.ok(tracks.every(t=>t.road.source==='TxDOT 2020 Roadway Inventory'));
  assert.ok(tracks.some(t=>t.road.id.includes('northbound')));
  assert.ok(tracks.some(t=>t.road.id.includes('southbound')));
  assert.deepEqual(district.zones,[]);
});
