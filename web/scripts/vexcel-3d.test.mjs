import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteVexcelTiles, vexcel3dHandler } from '../server/vexcel-3d.ts';
const base='https://api.vexcelgroup.com/v2/3d/tileset?collection=us-tx-houstonr2-2023';
test('keeps local tiles, removes distant children, strips credentials and identifies formats',()=>{
 const root={children:[{boundingVolume:{region:[-1.671,0.519,-1.670,0.521,0,100]},content:{uri:'./tile?zoom=17&token=private&api_key=private'}},{boundingVolume:{region:[0,0,.1,.1,0,100]},content:{uri:'./tile?zoom=17'}}]};
 rewriteVexcelTiles(root,base);
 assert.equal(root.children.length,1);
 assert.equal(root.children[0].content.uri,'/api/neighborhood/vexcel/3d/tile.glb?zoom=17');
});
test('rejects child URLs outside the Vexcel 3D service',()=>{
 assert.throws(()=>rewriteVexcelTiles({content:{uri:'https://example.org/tile'}},base));
});
test('rejects requests for other collections and arbitrary URL parameters before fetching',async()=>{
 const handler=vexcel3dHandler({VEXCEL_API_KEY:'test'});
 for(const query of ['collection=another-city','url=https://example.org','zoom=-1']){
  await assert.rejects(handler({}, {}, new URL('http://localhost/3d/tileset?'+query)));
 }
});
test('portfolio scope keeps distant coverage and follows child tiles without exposing credentials',()=>{
 const root={children:[{boundingVolume:{region:[0,0,.1,.1,0,100]},content:{uri:'./tile?collection=us-tx-houstonr2-2023&zoom=17&token=private'}}]};
 rewriteVexcelTiles(root,base,true);
 assert.equal(root.children.length,1);
 assert.equal(root.children[0].content.uri,'/api/neighborhood/vexcel/3d/tile.glb?collection=us-tx-houstonr2-2023&zoom=17&scope=portfolio');
});
test('coverage rejects unbounded locations before contacting provider',async()=>{
 const handler=vexcel3dHandler({VEXCEL_API_KEY:'test'});
 for(const query of ['lat=0&lon=0','lat=NaN&lon=-95','lon=-95'])await assert.rejects(handler({}, {}, new URL('http://localhost/3d/coverage?'+query)));
});
