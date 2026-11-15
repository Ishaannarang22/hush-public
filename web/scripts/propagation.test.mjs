import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {AcousticScene,GeometricAcousticSolver} from '../src/acoustics/engine/solver.ts';
import {OctaveSpectrum} from '../src/acoustics/engine/domain.ts';
import {pointInPolygon} from '../src/acoustics/engine/geometry.ts';
import {roomProbe,samplePath,clipFlowLines} from '../src/acoustics/propagation.ts';
import {roomPolygon} from '../src/acoustics/matterport.ts';
import {DEFAULT_SCENARIO,emitterSources,toLocal,toWorld,makeApartments} from '../src/neighborhood/simulation.ts';
const evidence={kind:'assumed',source:'test fixture'};
const vehicleModel=JSON.parse(execFileSync(process.env.HUSH_PYTHON??'python3',['-m','noisemodel.vehicle_emissions'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
const material={id:'wall',name:'Wall',absorption:Array(8).fill(.1),transmissionLossDb:Array(8).fill(25),evidence};
const scene={schemaVersion:1,id:'paths',coordinateSystem:'local-meters-y-up',materials:[material],regions:[],assumptions:[],surfaces:[
  {kind:'wall',id:'barrier',a:{x:0,y:0,z:-1},b:{x:0,y:0,z:1},heightM:2,thicknessM:.1,materialId:'wall',openings:[],evidence},
  {kind:'floor',id:'floor',polygon:[{x:-10,y:0,z:-10},{x:10,y:0,z:-10},{x:10,y:0,z:10},{x:-10,y:0,z:10}],materialId:'wall',evidence},
]};
test('displayed propagation paths conserve every component of solver energy',()=>{
  const solver=new GeometricAcousticSolver(new AcousticScene(scene));
  const source={id:'car',position:{x:-3,y:1,z:0},spectrumDbAt1m:Array(8).fill(75),enabled:true,evidence};
  const receiver={x:3,y:1,z:0},traced=solver.tracePaths(receiver,[source]),plain=solver.evaluate(receiver,[source]);
  assert.ok(traced.paths.some(p=>p.kind==='reflected'));assert.ok(traced.paths.some(p=>p.kind==='diffracted'));
  for(const kind of ['direct','reflected','diffracted'])for(let band=0;band<8;band++){
    const total=traced.paths.filter(p=>p.kind===kind).reduce((sum,p)=>sum+p.bandEnergy[band],0);
    assert.ok(Math.abs(total-plain[kind][band])<1e-7);
  }
  assert.equal(solver.tracePaths(receiver,[{...source,enabled:false}]).paths.length,0);
});
test('emission adjustments preserve the shared model spectrum and toggles remove sources',()=>{
  const emitters=[{id:'car',kind:'car',vehicleClass:'auto',speedKmh:90,position:{x:0,y:1,z:0}},{id:'site',kind:'construction',position:{x:20,y:2,z:0}}];
  const sources=emitterSources(emitters,{...DEFAULT_SCENARIO,construction:true,trafficOffsetDb:3},vehicleModel);
  assert.deepEqual(sources[0].spectrumDbAt1m,vehicleModel.spectra.auto[89].map(v=>v+3));
  assert.ok(Math.abs(new OctaveSpectrum(sources[1].spectrumDbAt1m).totalDb(true)-92)<1e-9);
  assert.equal(emitterSources(emitters,{...DEFAULT_SCENARIO,traffic:false,construction:false},vehicleModel).length,0);
});
test('apartment transforms preserve physical source positions and do not relocate homes',()=>{
  const frame={origin:{x:100,y:0,z:250},x:{x:.5,y:0,z:Math.sqrt(3)/2},z:{x:-Math.sqrt(3)/2,y:0,z:.5}};
  const p={x:12,y:1.4,z:-23},roundtrip=toLocal(toWorld(p,frame),frame);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(roundtrip[axis]-p[axis])<1e-10);
});
test('room probes stay inside concave floor plans and path animation follows metres',()=>{
  const polygon=[[0,0],[6,0],[6,1],[1,1],[1,6],[0,6]].map(([x,z])=>({x,y:0,z}));
  const p=roomProbe({polygon,holes:[],heightM:2.7,id:'L'});
  assert.ok(pointInPolygon(p.x,p.z,polygon));
  assert.deepEqual(samplePath([{x:0,y:0,z:0},{x:3,y:0,z:0},{x:3,y:0,z:4}],5),{x:3,y:0,z:2});
});
test('interior display clips actual routes and preserves height and wall intersections',()=>{
  const p=(x,y=1)=>({x,y,z:0});
  const path={sourceId:'car',kind:'direct',level:40,lengthM:1008,points:[p(-1000,3),p(0),p(4),p(8)]};
  const [clipped]=clipFlowLines([path],[-2,-2,6,2]);
  assert.equal(clipped.points[0].x,-2);assert.equal(clipped.points.at(-1).x,6);
  assert.ok(clipped.points.some(p=>p.x===0));assert.ok(clipped.points.some(p=>p.x===4));
  assert.ok(clipped.points[0].y>1);assert.ok(clipped.lengthM>=8&&clipped.lengthM<8.01);
  assert.equal(path.points[0].x,-1000,'full map route remains untouched');
  assert.equal(clipFlowLines([{...path,points:[{x:0,y:1,z:5},{x:8,y:1,z:5}]}],[-2,-2,6,2]).length,0);
});
test('live room perimeter tolerates internal wall stubs but never fills an open boundary',()=>{
  const edge=(a,b)=>({vertices:[a,b].map(([x,y])=>({position:{x,y}}))});
  const perimeter=[edge([0,0],[4,0]),edge([4,4],[0,4]),edge([4,0],[4,4]),edge([0,4],[0,0])];
  const stub=[edge([4,0],[3,1]),edge([3,1],[2,1])];
  assert.equal(roomPolygon({id:'room',boundary:{edges:[...stub,...perimeter]}}).length,4);
  assert.deepEqual(roomPolygon({id:'room',boundary:{edges:perimeter.slice(0,3)}}),[]);
});
test('live sponsor-linked interiors import without fabricating unavailable geometry',{skip:!process.env.HUSH_SITE_FIXTURE},async()=>{
  const response=JSON.parse(await readFile(process.env.HUSH_SITE_FIXTURE,'utf8'));
  const data=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
  const apartments=makeApartments(response.units,data.origin,false);
  assert.deepEqual(apartments.map(a=>a.id),['oc9TWrb3VGs','zzvymDx5ty7']);
  assert.ok(apartments[0].rooms.filter(r=>r.name.startsWith('Bedroom')).length===2);
  assert.ok(apartments[0].rooms.some(r=>r.name==='Kitchen / living'));
  assert.equal(apartments[0].scene.regions.length,9);
  for(const apartment of apartments){
    const solver=new GeometricAcousticSolver(new AcousticScene(apartment.scene));
    const source=emitterSources([{id:'site',kind:'construction',position:{x:-800,y:2,z:550}}],{...DEFAULT_SCENARIO,construction:true})
      .map(s=>({...s,position:toLocal(s.position,apartment.frame)}));
    const probe=apartment.rooms.find(r=>r.name.startsWith('Bedroom')).probe;
    const baseline=solver.evaluate(probe,[]),active=solver.evaluate(probe,source);
    assert.ok(active.total.every((e,i)=>e>=baseline.total[i]));assert.ok(active.total.some(e=>e>0));
  }
});
