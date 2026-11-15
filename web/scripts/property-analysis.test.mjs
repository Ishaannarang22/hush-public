import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogUnit,loadPropertyUnit} from '../server/neighborhood.ts';
import {activeApartments,makeApartments} from '../src/neighborhood/simulation.ts';
const env={MATTERPORT_API_KEY:'test',MATTERPORT_API_TOKEN:'test'};
test('only sponsor catalog models may be requested',()=>{
 const catalog={properties:[{id:1,name:'Property',address:'Address',tours:[{id:'abcdefghijk'}]}]};
 assert.equal(catalogUnit(catalog,'abcdefghijk').propertyId,1);
 assert.throws(()=>catalogUnit(catalog,'outside-id'));
});
test('missing room boundaries do not become fabricated acoustic rooms',async()=>{
 const u=await loadPropertyUnit({propertyId:1,modelId:'abcdefghijk',address:'Address'},env,[],async()=>new Response(JSON.stringify({data:{model:{id:'abcdefghijk',name:'Tour',rooms:[{id:'r'}]}}})));
 assert.equal(u.geometryAvailable,false);assert.match(u.geometryReason,/no measured room boundaries/);
 assert.ok(!JSON.stringify(u).includes('MATTERPORT_API_TOKEN'));
});
test('the selected apartment always runs, with at most two comparison layouts',()=>{
 const apartments=Array.from({length:15},(_,i)=>({id:String(i)}));
 assert.deepEqual(activeApartments(apartments,'14').map(a=>a.id),['14','0','1']);
 assert.equal(activeApartments([], '14').length,0);
});
test('new measured interiors import with explicit missing-height assumptions',{skip:!process.env.HUSH_GEOMETRY_AUDIT},async()=>{
 const base=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
 for(const id of ['4a9K7eimQDB','BPtsRg1smtt','w8fAZqiUtTq']){
  const model=JSON.parse(await readFile(process.env.HUSH_GEOMETRY_AUDIT+'/'+id+'.json','utf8'));
  const a=makeApartments([{modelId:id,model,geometryAvailable:true}],base.origin,false)[0];
  assert.ok(a.rooms.length>=5);assert.ok(a.scene.regions.every(r=>r.heightM>0));
  if(id==='w8fAZqiUtTq')assert.ok(a.warnings.some(w=>w.includes('height assumed')));
 }
});
test('inconsistent measured opening dimensions remain rejected',{skip:!process.env.HUSH_GEOMETRY_AUDIT},async()=>{
 const base=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
 const id='fHDCqmJJdsT',model=JSON.parse(await readFile(process.env.HUSH_GEOMETRY_AUDIT+'/'+id+'.json','utf8'));
 assert.throws(()=>makeApartments([{modelId:id,model,geometryAvailable:true}],base.origin,false),/does not fit wall/);
});

test('CoStar wood-frame context and construction year survive the model join',async()=>{
 const u=await loadPropertyUnit({propertyId:1,modelId:'abcdefghijk',address:'Address'},env,
 [{id:1,buildingName:'Real property',numStoriesAboveGrade:3,buildingConstructionMaterial:5,constructionEvents:[{eventType:2,year:1983}]}],
 async()=>new Response(JSON.stringify({data:{model:{id:'abcdefghijk',rooms:[]}}})));
 assert.equal(u.constructionMaterial,'Wood frame');assert.equal(u.yearBuilt,1983);assert.equal(u.stories,3);
});

test('measured windows change transmission without changing wall dimensions',{skip:!process.env.HUSH_GEOMETRY_AUDIT},async()=>{
 const {AcousticScene,GeometricAcousticSolver}=await import('../src/acoustics/engine/solver.ts');
 const {wallMeasurements}=await import('../src/neighborhood/measurements.ts');
 const base=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
 const id='4a9K7eimQDB',model=JSON.parse(await readFile(process.env.HUSH_GEOMETRY_AUDIT+'/'+id+'.json','utf8'));
 const unit={modelId:id,model,geometryAvailable:true};
 const closed=makeApartments([unit],base.origin,false)[0],open=makeApartments([unit],base.origin,true)[0];
 assert.equal(closed.geometry.windows,6);
 const a=wallMeasurements(closed.scene),b=wallMeasurements(open.scene);
 assert.deepEqual(a.map(w=>[w.lengthM,w.heightM,w.thicknessM]),b.map(w=>[w.lengthM,w.heightM,w.thicknessM]));
 const w=closed.scene.surfaces.find(w=>w.kind==='wall'&&w.openings.some(o=>o.kind==='window'));
 const o=w.openings.find(o=>o.kind==='window'),length=Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z);
 const dx=(w.b.x-w.a.x)/length,dz=(w.b.z-w.a.z)/length;
 const c={x:w.a.x+dx*o.centerM,y:o.bottomM+o.heightM/2,z:w.a.z+dz*o.centerM};
 const source={id:'window-probe',enabled:true,position:{x:c.x-dz,y:c.y,z:c.z+dx},spectrumDbAt1m:Array(8).fill(60),evidence:{kind:'assumed',source:'Transmission test'}};
 const receiver={x:c.x+dz,y:c.y,z:c.z-dx};
 const evaluate=scene=>new GeometricAcousticSolver(new AcousticScene({...scene,surfaces:scene.surfaces.filter(s=>s.id===w.id)})).evaluate(receiver,[source],{reflections:false,diffraction:false}).total;
 const sealed=evaluate(closed.scene),unsealed=evaluate(open.scene);
 assert.ok(unsealed.every((v,i)=>v>sealed[i]),'opening the measured window increases transmitted energy in every octave');
 const changed=makeApartments([unit],base.origin,false,[],{materials:{[id]:{[w.id]:'concrete'}}})[0];
 assert.equal(changed.scene.surfaces.find(s=>s.id===w.id).materialId,'concrete');
 assert.equal(closed.scene.surfaces.find(s=>s.id===w.id).materialId,'plasterboard');
 assert.equal(changed.geometry.walls,closed.geometry.walls);
});
test('all floors remain selectable and upper-floor elevations are retained',{skip:!process.env.HUSH_GEOMETRY_AUDIT},async()=>{
 const base=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
 const id='4a9K7eimQDB',model=JSON.parse(await readFile(process.env.HUSH_GEOMETRY_AUDIT+'/'+id+'.json','utf8'));
 const original=makeApartments([{modelId:id,model,geometryAvailable:true}],base.origin,false)[0];
 const upper=structuredClone(model.rooms);for(const room of upper){room.floor={id:'upper',sequence:1,label:'Upper floor'};room.dimensionEstimates??={};room.dimensionEstimates.units??='metric';room.dimensionEstimates.lowerElevation=(room.dimensionEstimates.lowerElevation??0)+3/(room.dimensionEstimates.units==='imperial'?.3048:1);for(const edge of [...(room.boundary?.edges??[]),...(room.holes??[]).flatMap(h=>h.edges??[])])for(const opening of edge.openings??[])opening.lowerElevation=(opening.lowerElevation??0)+3;}
 const unit={modelId:id,model:{...model,rooms:[...model.rooms,...upper]},geometryAvailable:true};
 const chosen=makeApartments([unit],base.origin,false,[],{floors:{[id]:'upper'}})[0];
 assert.equal(chosen.rooms.length,original.rooms.length);assert.ok(chosen.scene.regions.every(r=>r.floorId==='upper'));
 assert.ok(Math.abs(chosen.rooms[0].probe.y-original.rooms[0].probe.y-3)<1e-6);assert.equal(chosen.geometry.windows,original.geometry.windows);
});
