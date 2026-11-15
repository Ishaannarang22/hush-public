import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {enrichTours} from '../server/neighborhood.ts';
import {mapTourProperties} from '../src/neighborhood/tours.ts';
import {cropStudy} from '../src/neighborhood/study.ts';

const catalog={source:'CoStar',properties:[{id:1,name:'Fixture property',address:'Fixture',location:{lat:0,lon:0},tours:[{id:'abcdefghijk',name:'Existing tour',url:'https://my.matterport.com/show/?m=abcdefghijk'},{id:'lmnopqrstuv',name:'Other tour',url:'https://my.matterport.com/show/?m=lmnopqrstuv'}]}]};
test('missing credentials or partial Model API data never hide original CoStar tours',async()=>{
  const absent=await enrichTours(catalog,{},()=>{throw Error('must not call API');});
  assert.equal(absent.properties[0].tours.length,2);assert.equal(absent.properties[0].tours[0].status,'unverified');
  const live=await enrichTours(catalog,{MATTERPORT_API_KEY:'test-key',MATTERPORT_API_TOKEN:'test-token'},async()=>new Response(JSON.stringify({data:{t0:{id:'abcdefghijk',name:'Live interior',geolocation:{lat:'29.8',long:'-95.7'}},t1:null},errors:[{message:'model unavailable'}]})));
  assert.equal(live.properties[0].tours[0].status,'live');assert.equal(live.properties[0].tours[0].name,'Live interior');
  assert.equal(live.properties[0].tours[1].url,catalog.properties[0].tours[1].url);
  assert.equal(live.properties[0].tours[1].status,'unverified');
  assert.ok(!JSON.stringify(live).includes('test-key'));assert.ok(!JSON.stringify(live).includes('test-token'));
});
test('property locations create tour pins but never imply a scanned building or acoustic geometry',()=>{
  const data={origin:{mercatorX:0,mercatorY:0,scale:1},studyBounds:[-100,-100,100,100],buildings:[{id:'roof',rings:[[[-10,-10],[10,-10],[10,10],[-10,10]]]}]};
  const pins=mapTourProperties(catalog,data);
  assert.equal(pins.length,1);assert.equal(pins[0].tours.length,2);assert.equal(pins[0].buildings.length,0);
  const located={...catalog,properties:catalog.properties.map(p=>({...p,tours:p.tours.map(t=>({...t,status:'live',location:{lat:0,lon:0}}))}))};
  assert.equal(mapTourProperties(located,data)[0].buildings.length,1);
  assert.equal(mapTourProperties(catalog,{...data,studyBounds:[100,100,200,200]}).length,0);
});
test('the real crop includes all seven CoStar properties and 53 original tours',{skip:!process.env.HUSH_TOURS_FIXTURE||!process.env.HUSH_BUILDINGS_FIXTURE},async()=>{
  const tours=JSON.parse(await readFile(process.env.HUSH_TOURS_FIXTURE,'utf8'));
  const base=JSON.parse(await readFile(new URL('../public/neighborhood/scene.json',import.meta.url),'utf8'));
  const live=JSON.parse(await readFile(process.env.HUSH_BUILDINGS_FIXTURE,'utf8'));
  const mapped=mapTourProperties(tours,cropStudy({...base,buildings:live.buildings}));
  assert.equal(mapped.length,7);assert.equal(mapped.reduce((n,p)=>n+p.tours.length,0),53);
  assert.equal(mapped.find(p=>p.id===9874409).tours.length,18);
  assert.equal(mapped.find(p=>p.id===9642014).tours.length,4);
  for(const property of mapped)for(const tour of property.tours){assert.equal(new URL(tour.url).hostname,'my.matterport.com');assert.equal(new URL(tour.url).searchParams.get('m'),tour.id);}
  assert.ok(mapped.filter(p=>p.buildings.length>0).length>=6);
});
