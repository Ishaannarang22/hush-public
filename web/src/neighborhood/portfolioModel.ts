import type { AcousticPropertyProfile, PropertyDataSummary } from './propertyData.ts';
import { A_WEIGHTING, OCTAVES, decibels, energy, type SourceData } from '../acoustics/engine/domain.ts';
import { MATERIALS } from '../acoustics/engine/materials.ts';
export type PortfolioProperty={id:string;propertyId:number;listingIds:number[];kind:'residential'|'apartments'|'commercial';name:string;address:string;city:string;state:string;lat:number;lon:number;modelIds:string[];floorAreaM2:number|null;stories:number|null;constructionMaterial:string|null;yearBuilt:number|null;preferredModelId?:string;measurementCoverage?:{ready:number;downloaded:number;total:number;plansWithMeasurements:number};dataSummary?:PropertyDataSummary;acousticProfile?:AcousticPropertyProfile};
export type PortfolioCatalog={schemaVersion:1;source:string;properties:PortfolioProperty[];counts:{sourceRecords:number;properties:number;missingCoordinates:number;residential:number;models:number};limitations:string[];enrichment?:Record<string,unknown>};
export type Geo={lat:number;lon:number};
export type EnvironmentSource={id:string;kind:'traffic'|'construction'|'aircraft'|'rail'|'mechanical';lat:number;lon:number;height:number;level:number;enabled:boolean};
export type EnvelopeSettings={wallMaterial:string;windowFraction:number;windowsOpen:boolean;roomAbsorption:number;usePropertyData?:boolean};
export const DEFAULT_ENVELOPE:EnvelopeSettings={wallMaterial:'plasterboard',windowFraction:.2,windowsOpen:false,roomAbsorption:.15,usePropertyData:true};
export const SOURCE_SHAPES:Record<EnvironmentSource['kind'],number[]>={traffic:[-8,-3,0,-1,-4,-9,-16,-23],construction:[-4,0,-1,-2,-3,-5,-8,-14],aircraft:[-3,0,-1,-3,-5,-9,-15,-22],rail:[-10,-5,-1,0,-2,-4,-8,-14],mechanical:[0,-1,-3,-6,-10,-14,-19,-25]};
export const REGIONS:Record<string,{name:string;center:Geo;state:string}>={houston:{name:'Houston',center:{lat:29.7955898,lon:-95.7051799},state:'TX'},losangeles:{name:'Los Angeles',center:{lat:34.05,lon:-118.25},state:'CA'}};
/** Local Mercator coordinates, scaled to metres at the selected regional origin. */
export function project(p:Geo,origin:Geo):[number,number]{const scale=Math.cos(origin.lat*Math.PI/180),r=6378137;return [r*(p.lon-origin.lon)*Math.PI/180*scale,r*(Math.log(Math.tan(Math.PI/4+origin.lat*Math.PI/360))-Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360)))*scale];}
export function unproject(x:number,z:number,origin:Geo):Geo{const r=6378137,scale=Math.cos(origin.lat*Math.PI/180);return {lon:origin.lon+x/scale/r*180/Math.PI,lat:(2*Math.atan(Math.exp(Math.log(Math.tan(Math.PI/4+origin.lat*Math.PI/360))-z/scale/r))-Math.PI/2)*180/Math.PI};}
export function sourceData(s:EnvironmentSource,origin:Geo):SourceData{const [x,z]=project(s,origin),shape=SOURCE_SHAPES[s.kind],normal=decibels(shape.reduce((sum,v,i)=>sum+energy(v+A_WEIGHTING[i]),0));return {id:s.id,position:{x,y:s.height,z},spectrumDbAt1m:shape.map(v=>v+s.level-normal),enabled:s.enabled,evidence:{kind:'assumed',source:'Editable environmental scenario',note:'Illustrative octave shape and dBA at 1 m; not observed traffic or aircraft data.'}};}
export function propertyMassing(p:PortfolioProperty){const stories=p.stories??2;const area=Math.max(9,(p.floorAreaM2??160)/stories);return {width:Math.sqrt(area*1.4),depth:Math.sqrt(area/1.4),height:stories*3,area,stories};}
export type PropertyExposure={id:string;outdoor:number|null;indoor:number|null;reduction:number|null;bands:number[];dominantSource:string|null};
/** Fast portfolio screening, separate from the measured-room geometric solver.
 * Sum source energies by octave, then area-weight facade transmission and use
 * 4*S/A for a diffuse-room receiving estimate. No invented wall plan is used.
 */
export class EnvelopeScreeningModel{
  readonly origin:Geo;readonly settings:EnvelopeSettings;
  constructor(origin:Geo,settings:EnvelopeSettings){
    if(!MATERIALS.some(m=>m.id===settings.wallMaterial)||!Number.isFinite(settings.windowFraction)||settings.windowFraction<0||settings.windowFraction>.8||!Number.isFinite(settings.roomAbsorption)||settings.roomAbsorption<=0||settings.roomAbsorption>1)throw new Error('Invalid envelope assumptions');
    this.origin=origin;this.settings=settings;
  }
  calculate(properties:PortfolioProperty[],sources:EnvironmentSource[]):PropertyExposure[]{
    const active=sources.filter(s=>s.enabled).map(s=>sourceData(s,this.origin)),wall=MATERIALS.find(m=>m.id===this.settings.wallMaterial)!,glass=MATERIALS.find(m=>m.id==='glass')!;
    const fraction=this.settings.windowFraction,transmission=OCTAVES.map((_,i)=>(1-fraction)*energy(-wall.transmissionLossDb[i])+fraction*(this.settings.windowsOpen?1:energy(-glass.transmissionLossDb[i])));
    return properties.map(p=>{
      if(!active.length)return {id:p.id,outdoor:null,indoor:null,reduction:null,bands:[],dominantSource:null};
      const [x,z]=project(p,this.origin),box=propertyMassing(p),bands=OCTAVES.map(()=>0);let dominantSource:string|null=null,max=-Infinity;
      for(const source of active){
        // Property-centre receiver at 1.2 m. Floor area is NOT a measured facade.
        const d=Math.max(1,Math.hypot(x-source.position.x,z-source.position.z,1.2-source.position.y)),spread=20*Math.log10(d);let total=0;
        source.spectrumDbAt1m.forEach((level,i)=>{const value=energy(level-spread);bands[i]+=value;total+=value*energy(A_WEIGHTING[i]);});
        if(total>max){max=total;dominantSource=source.id;}
      }
      const profile=this.settings.usePropertyData?p.acousticProfile:undefined;
      // Plan sizes describe units, not one gigantic room spanning a community.
      const roomArea=profile?.roomAreaM2??box.area,roomWidth=Math.sqrt(roomArea*1.4),roomDepth=Math.sqrt(roomArea/1.4);
      const facade=roomWidth*3,receivingArea=2*roomArea+2*(roomWidth+roomDepth)*3;
      const floor=profile?.floorMaterialPrior?MATERIALS.find(m=>m.id===profile.floorMaterialPrior):undefined;
      const indoorBands=bands.map((e,i)=>{
        const absorption=floor?roomArea*floor.absorption[i]+(receivingArea-roomArea)*this.settings.roomAbsorption:receivingArea*this.settings.roomAbsorption;
        return decibels(e*transmission[i]*4*facade/absorption);
      });
      const outdoor=decibels(bands.reduce((sum,e,i)=>sum+e*energy(A_WEIGHTING[i]),0));
      const indoor=decibels(indoorBands.reduce((sum,db,i)=>sum+energy(db+A_WEIGHTING[i]),0));
      return {id:p.id,outdoor,indoor,reduction:outdoor-indoor,bands:indoorBands,dominantSource};
    });
  }
}
export function exposureColor(db:number|null,delta=false):string{
  if(db===null)return '#a8b5b1';
  const stops=delta?[[ -10,56,153,160],[0,227,232,221],[10,210,75,58]]:[[0,75,147,140],[25,129,181,149],[40,228,202,120],[55,229,139,86],[70,184,64,69]];
  const hi=stops.findIndex(s=>db<=s[0]);if(hi===0)return `rgb(${stops[0].slice(1).join(',')})`;if(hi<0)return `rgb(${stops.at(-1)!.slice(1).join(',')})`;
  const a=stops[hi-1],b=stops[hi],t=(db-a[0])/(b[0]-a[0]);return `rgb(${a.slice(1).map((v,i)=>Math.round(v+(b[i+1]-v)*t)).join(',')})`;
}
