import { useMemo } from 'react';
import VexcelMesh, { type MeshStatus } from './VexcelMesh';
import type { Geo } from './portfolioModel';
export type VexcelCoverage={selected:null|{collection:string;'first-capture-date'?:string;'last-capture-date'?:string;'min-gsd'?:number};error?:string};
export default function PortfolioImagery({origin,collection,onStatus,onPoint,quality}:{origin:Geo;collection:string;onStatus:(status:MeshStatus)=>void;onPoint:(x:number,z:number)=>void;quality:number}){
  const data=useMemo(()=>({origin:{...origin,mercatorX:6378137*origin.lon*Math.PI/180,mercatorY:6378137*Math.log(Math.tan(Math.PI/4+origin.lat*Math.PI/360)),scale:Math.cos(origin.lat*Math.PI/180)},buildings:[]}),[origin]);
  return <VexcelMesh data={data} portfolio tilesetUrl={'/api/neighborhood/vexcel/3d/tileset?scope=portfolio&collection='+encodeURIComponent(collection)} quality={quality} onStatus={onStatus} onSelect={()=>{}} onPoint={onPoint}/>;
}
