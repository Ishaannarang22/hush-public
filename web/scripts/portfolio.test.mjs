import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EnvelopeScreeningModel,DEFAULT_ENVELOPE,project,unproject,sourceData,REGIONS,propertyMassing} from '../src/neighborhood/portfolioModel.ts';
import {A_WEIGHTING} from '../src/acoustics/engine/domain.ts';
const origin=REGIONS.houston.center;
const property={id:'residential:1',propertyId:1,listingIds:[1],kind:'residential',name:'Test',address:'Test',city:'Houston',state:'TX',...unproject(100,0,origin),modelIds:[],floorAreaM2:160,stories:2,constructionMaterial:null,yearBuilt:null};
const source={id:'test',kind:'traffic',...origin,height:1.2,level:90,enabled:true};
const model=new EnvelopeScreeningModel(origin,DEFAULT_ENVELOPE);
test('geographic coordinates roundtrip at both city origins',()=>{for(const r of Object.values(REGIONS)){const geo=unproject(8532,-12932,r.center);const [x,z]=project(geo,r.center);assert.ok(Math.abs(x-8532)<1e-6);assert.ok(Math.abs(z+12932)<1e-6);}});
test('source level is normalized in A-weighted energy in every source family',()=>{for(const kind of ['traffic','construction','aircraft','rail','mechanical']){const s=sourceData({...source,kind},origin),total=10*Math.log10(s.spectrumDbAt1m.reduce((sum,db,i)=>sum+10**((db+A_WEIGHTING[i])/10),0));assert.ok(Math.abs(total-90)<1e-9);}});
test('doubling distance changes outdoor and indoor by 6.02 dB',()=>{const [a,b]=model.calculate([property,{...property,...unproject(200,0,origin)}],[source]);assert.ok(Math.abs(a.outdoor-b.outdoor-6.0206)<.0001);assert.ok(Math.abs(a.indoor-b.indoor-6.0206)<.0001);});
test('independent equal sources sum as energies, not dB',()=>{const [a]=model.calculate([property],[source]),[b]=model.calculate([property],[source,{...source,id:'second'}]);assert.ok(Math.abs(b.indoor-a.indoor-3.0103)<.0001);});
test('raising a source by 10 dB raises each octave and total by 10 dB',()=>{const [a]=model.calculate([property],[source]),[b]=model.calculate([property],[{...source,level:100}]);assert.ok(Math.abs(b.indoor-a.indoor-10)<1e-8);a.bands.forEach((v,i)=>assert.ok(Math.abs(b.bands[i]-v-10)<1e-8));});
test('opening assumed glazing increases transmission at every octave',()=>{const [closed]=model.calculate([property],[source]),[open]=new EnvelopeScreeningModel(origin,{...DEFAULT_ENVELOPE,windowsOpen:true}).calculate([property],[source]);open.bands.forEach((v,i)=>assert.ok(v>closed.bands[i]));assert.equal(open.outdoor,closed.outdoor);});
test('no sources means unavailable total rather than invented ambient noise',()=>{const [r]=model.calculate([property],[{...source,enabled:false}]);assert.equal(r.indoor,null);assert.equal(r.outdoor,null);assert.deepEqual(r.bands,[]);});
test('different spectra produce different envelope reductions',()=>{const [a]=model.calculate([property],[source]),[b]=model.calculate([property],[{...source,kind:'mechanical'}]);assert.ok(Math.abs(a.outdoor-b.outdoor)<1e-8);assert.ok(Math.abs(a.reduction-b.reduction)>1);});
test('massing converts total floor area to footprint using stories',()=>{const m=propertyMassing(property);assert.equal(m.area,80);assert.ok(Math.abs(m.width*m.depth-80)<1e-8);});
test('invalid envelope inputs are rejected',()=>{assert.throws(()=>new EnvelopeScreeningModel(origin,{...DEFAULT_ENVELOPE,roomAbsorption:0}));assert.throws(()=>new EnvelopeScreeningModel(origin,{...DEFAULT_ENVELOPE,windowFraction:NaN}));});
test('real catalog contains every geolocated property and computes without a three-home cap',async t=>{let catalog;try{catalog=JSON.parse(await readFile(new URL('../../work/neighborhood/portfolio.json',import.meta.url)));}catch{t.skip('Private sponsor catalog not installed');return;}
 assert.equal(catalog.properties.length,catalog.counts.properties);assert.equal(new Set(catalog.properties.map(p=>p.id)).size,catalog.properties.length);assert.ok(catalog.properties.length>5000);assert.ok(catalog.properties.some(p=>p.kind==='apartments'));assert.equal(catalog.properties.filter(p=>p.kind==='residential').length,catalog.counts.residential);
 const start=performance.now();const results=model.calculate(catalog.properties,[source]);assert.equal(results.length,catalog.properties.length);assert.ok(results.every(r=>Number.isFinite(r.indoor)));t.diagnostic(`${results.length} properties / 8 bands: ${(performance.now()-start).toFixed(1)} ms`);
});
test('floor-plan room size and reported flooring alter indoor estimates, never source exposure',()=>{
 const profile={unitAreaM2:90,areaBasis:'floor-plan area',roomAreaM2:20,roomAreaAssumed:true,beds:2,floorMaterialPrior:null,flooring:[],glazing:[],envelopeFeatures:[],note:'assumed subdivision'};
 const [plain]=model.calculate([{...property,acousticProfile:profile}],[source]);
 const [carpet]=model.calculate([{...property,acousticProfile:{...profile,floorMaterialPrior:'carpet'}}],[source]);
 assert.equal(plain.outdoor,carpet.outdoor);assert.ok(carpet.bands[4]<plain.bands[4]);
 const [small]=model.calculate([{...property,acousticProfile:{...profile,roomAreaM2:9}}],[source]);assert.ok(Math.abs(small.indoor-plain.indoor)>.1);
 const [thermalClaim]=model.calculate([{...property,acousticProfile:{...profile,glazing:['Low Emissivity Windows']}}],[source]);assert.equal(thermalClaim.indoor,plain.indoor);
 const uniform=new EnvelopeScreeningModel(origin,{...DEFAULT_ENVELOPE,usePropertyData:false});assert.equal(uniform.calculate([{...property,acousticProfile:profile}],[source])[0].indoor,uniform.calculate([property],[source])[0].indoor);
});
test('private floor-plan catalog retains exact joins and does not repeat community area as unit size',async t=>{
 let catalog;try{catalog=JSON.parse(await readFile(new URL('../../work/neighborhood/portfolio.json',import.meta.url)));}catch{t.skip('Private catalog not installed');return;}
 if(!catalog.enrichment){t.skip('Enriched catalog not installed');return;}
 assert.equal(catalog.enrichment.matchedPlans,23755);assert.equal(catalog.enrichment.listingOnlyPlans,51);
 const volterra=catalog.properties.find(p=>p.id==='commercial:9160550');assert.ok(volterra.acousticProfile.unitAreaM2<200);assert.ok(volterra.floorAreaM2>30000);assert.equal(volterra.dataSummary.floorPlans,8);
 const detail=JSON.parse(await readFile(new URL('../../work/neighborhood/property-data/commercial-9160550.json',import.meta.url)));
 assert.ok(detail.floorPlans.find(p=>p.name==='Empire').modelIds.includes('zzvymDx5ty7'));assert.equal(detail.units.length,370);
});
