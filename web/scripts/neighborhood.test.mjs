import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { worldToGeographic,VIEWS } from '../src/neighborhood/data.ts';
import { cropStudy,STUDY_BOUNDS } from '../src/neighborhood/study.ts';
import { roofGeometry, terrainGeometries } from '../src/neighborhood/geometry.ts';
import { viewableBuildings } from '../src/neighborhood/viewableBuildings.ts';
import { makeApartments } from '../src/neighborhood/simulation.ts';

const data=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
test('interior coverage groups real layouts and rejects distant, ambiguous and courtyard locations',()=>{
  const building=(id,x=0)=>({id,rings:[[[x,0],[x+20,0],[x+20,20],[x,20]]],center:[x+10,10]});
  const apartment=(id,x,z=10)=>({id,name:id,frame:{origin:{x,y:0,z},x:{x:1,y:0,z:0},z:{x:0,y:0,z:1}},rooms:[{probe:{x:0,y:1.2,z:0}},{probe:{x:1,y:1.2,z:1}}]});
  const roof=building('real'),inside=apartment('inside',10),nearby=apartment('nearby',24);
  const group=viewableBuildings([roof],[inside,nearby]);
  assert.equal(group.length,1);assert.equal(group[0].interiors.length,2);
  assert.equal(group[0].interiors[0].approximate,false);assert.equal(group[0].interiors[1].approximate,true);
  assert.equal(viewableBuildings([roof],[apartment('too-far',31)]).length,0);
  assert.equal(viewableBuildings([roof,building('neighbor',30)],[nearby]).length,0);
  assert.equal(viewableBuildings([roof,building('duplicate')],[inside]).length,0);
  assert.equal(viewableBuildings([roof],[{...inside,rooms:[]}]).length,0);
  const courtyard={...roof,rings:[...roof.rings,[[5,5],[15,5],[15,15],[5,15]]]};
  assert.equal(viewableBuildings([courtyard],[inside]).length,0);
});
test('live Volterra layouts share one highlighted Vexcel building without moving either scan',{skip:!process.env.HUSH_SITE_FIXTURE||!process.env.HUSH_BUILDINGS_FIXTURE},async()=>{
  const units=JSON.parse(await readFile(process.env.HUSH_SITE_FIXTURE,'utf8')).units;
  const live=JSON.parse(await readFile(process.env.HUSH_BUILDINGS_FIXTURE,'utf8'));
  const apartments=makeApartments(units,data.origin,false),before=JSON.stringify(apartments);
  const groups=viewableBuildings(live.buildings,apartments);
  assert.equal(groups.length,1);assert.equal(groups[0].building.id,'vexcel-0cac13374aa01722');
  assert.deepEqual(groups[0].interiors.map(a=>a.id).sort(),['oc9TWrb3VGs','zzvymDx5ty7']);
  assert.equal(groups[0].interiors.find(a=>a.id==='zzvymDx5ty7').approximate,false);
  assert.ok(groups[0].interiors.find(a=>a.id==='oc9TWrb3VGs').maxOffsetM<7.3);
  assert.equal(JSON.stringify(apartments),before);
});
test('all map presets begin 40 degrees above ground and the study excludes outside geometry',()=>{
  for(const v of Object.values(VIEWS))assert.ok(Math.abs(Math.atan2(v.position[1]-v.target[1],Math.hypot(v.position[0]-v.target[0],v.position[2]-v.target[2]))-40*Math.PI/180)<1e-10);
  const cropped=cropStudy(data),[x0,z0,x1,z1]=STUDY_BOUNDS;
  const points=[...cropped.buildings.flatMap(b=>b.rings.flat()),...cropped.roads.flatMap(r=>r.points),...cropped.trees.map(t=>t.position)];
  assert.ok(points.length>0);assert.ok(cropped.roads.some(r=>r.name==='Greenhouse Road'));
  for(const [x,z] of points)assert.ok(x>=x0&&x<=x1&&z>=z0&&z<=z1);
  const geometries=terrainGeometries(data.imagery,STUDY_BOUNDS);
  for(const g of geometries){const p=g.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(p.getX(i)>=x0&&p.getX(i)<=x1&&p.getZ(i)>=z0&&p.getZ(i)<=z1);g.dispose();}
});

test('the neighborhood origin agrees with the existing surveyed apartment',()=>{
  const actual=worldToGeographic(0,0,data.origin);
  assert.ok(Math.abs(actual.lat-29.7955898)<1e-9);
  assert.ok(Math.abs(actual.lon+95.7051799)<1e-9);
  const east=worldToGeographic(100,0,data.origin),south=worldToGeographic(0,100,data.origin);
  assert.ok(east.lon>actual.lon);
  assert.ok(south.lat<actual.lat);
  const distance=(a,b)=>6378137*Math.acos(Math.min(1,Math.sin(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos((b.lon-a.lon)*Math.PI/180)));
  assert.ok(Math.abs(distance(actual,east)-100)<.05);
  assert.ok(Math.abs(distance(actual,south)-100)<.05);
});

test('source identifiers and footprint geometry survive scene preparation',()=>{
  assert.equal(data.buildings.length,957);
  assert.equal(new Set(data.buildings.map(b=>b.id)).size,957);
  for(const building of data.buildings){
    assert.ok(building.rings[0].length>=3);
    assert.ok(building.rings.flat().flat().every(Number.isFinite));
    assert.equal(building.source,'ORNL / FEMA USA Structures');
    assert.match(building.heightBasis,/estimated|Estimated/);
  }
  assert.equal(data.buildings.filter(b=>b.reference==='zzvymDx5ty7').length,1);
  assert.equal(data.roads.length,2);
  assert.ok(data.roads.every(r=>r.source==='TxDOT 2020 Roadway Inventory'));
  assert.doesNotMatch(JSON.stringify(data),/openstreetmap|osm-/i);
  assert.ok(data.roads.some(r=>r.name==='Greenhouse Road'));
  assert.deepEqual(data.zones,[]);
  assert.equal(data.acoustics.predictions,null);
  assert.equal(data.acoustics.sourceSpectra,null);
});

test('roof reconstruction preserves courtyard holes and mapped roof UVs',()=>{
  const b={rings:[[[0,0],[10,0],[10,10],[0,10]],[[4,4],[4,6],[6,6],[6,4]]],height:9,type:'Building',name:null};
  const geometry=roofGeometry(b,{bounds:[0,0,10,10]});
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(new THREE.Vector3(2,20,2),new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(mesh).length>0);
  ray.ray.origin.set(5,20,5);
  assert.equal(ray.intersectObject(mesh).length,0);
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(uv.getX(i)-p.getX(i)/10)<1e-6);
    assert.ok(Math.abs(uv.getY(i)-(1-p.getZ(i)/10))<1e-6);
  }
  geometry.dispose();material.dispose();
});

test('imagery has continuous coverage with only one depth surface at every sample',()=>{
  // Exercise both the real nested atlases and partially overlapping tiles in
  // shuffled order, so resolution wins independently of rendering order.
  const partial=[
    {name:'detail',bounds:[3,2,8,7],width:100,height:100},
    {name:'context',bounds:[0,0,10,10],width:10,height:10},
    {name:'district',bounds:[-2,4,6,11],width:40,height:35},
  ];
  for(const imagery of [data.imagery,partial]){
    const geometries=terrainGeometries(imagery);
    const material=new THREE.MeshBasicMaterial();
    const meshes=geometries.map(g=>{const mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();return mesh;});
    const x0=Math.min(...imagery.map(im=>im.bounds[0])),z0=Math.min(...imagery.map(im=>im.bounds[1]));
    const x1=Math.max(...imagery.map(im=>im.bounds[2])),z1=Math.max(...imagery.map(im=>im.bounds[3]));
    const resolution=im=>im.width*im.height/((im.bounds[2]-im.bounds[0])*(im.bounds[3]-im.bounds[1]));
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
    for(let row=0;row<43;row++)for(let col=0;col<41;col++){
      const x=x0+(col+.37)/41*(x1-x0),z=z0+(row+.61)/43*(z1-z0);
      const covering=imagery.filter(im=>x>im.bounds[0]&&x<im.bounds[2]&&z>im.bounds[1]&&z<im.bounds[3]).sort((a,b)=>resolution(b)-resolution(a));
      ray.ray.origin.set(x,20,z);
      const hits=ray.intersectObjects(meshes);
      assert.equal(new Set(hits.map(hit=>hit.object)).size,covering.length?1:0,'no holes or overlapping atlases');
      if(covering.length)assert.equal(meshes.indexOf(hits[0].object),imagery.indexOf(covering[0]),'highest resolution owns the ground');
    }
    geometries.forEach((g,index)=>{
      const p=g.getAttribute('position'),uv=g.getAttribute('uv'),[a,b,c,d]=imagery[index].bounds;
      for(let i=0;i<p.count;i++){
        assert.equal(p.getY(i),0);
        assert.ok(Math.abs(uv.getX(i)-(p.getX(i)-a)/(c-a))<1e-6);
        assert.ok(Math.abs(uv.getY(i)-(1-(p.getZ(i)-b)/(d-b)))<1e-6);
      }
      g.dispose();
    });
    material.dispose();
  }
});
