import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import FlowPaths from '../acoustics/FlowPaths';
import type { SpectralField } from '../acoustics/engine/grid';
import { clipFlowLines, type FlowLine } from '../acoustics/propagation';
import type { Apartment } from './simulation';

const palette=[new THREE.Color('#285681'),new THREE.Color('#44b9aa'),new THREE.Color('#e7bd65'),new THREE.Color('#e46554')];
function levelColor(db:number){const t=Math.max(0,Math.min(2.999,(db-20)/60*3)),i=Math.floor(t);return palette[i].clone().lerp(palette[i+1],t-i);}
function ApartmentMesh({apartment,field,onRoom}:{apartment:Apartment;field:SpectralField|null;onRoom:(id:string)=>void}){
  const minX=field?.minX,minZ=field?.minZ,spanX=field?.spanX,spanZ=field?.spanZ;
  const floors=useMemo(()=>apartment.scene.regions.map(region=>{
    const shape=new THREE.Shape(region.polygon.map(p=>new THREE.Vector2(p.x,-p.z)));
    region.holes.forEach(h=>shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p.x,-p.z)))));
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,region.polygon[0].y+.025,0);
    if(minX!==undefined&&minZ!==undefined&&spanX&&spanZ){const p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-minX)/spanX,(p.getZ(i)-minZ)/spanZ);}
    return g;
  }),[apartment,minX,minZ,spanX,spanZ]);
  const walls=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[];
    apartment.scene.surfaces.forEach(w=>{
      if(w.kind!=='wall')return;const length=Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z),height=Math.min(w.heightM,1.05);
      const edges=[0,length,...w.openings.flatMap(o=>[Math.max(0,o.centerM-o.widthM/2),Math.min(length,o.centerM+o.widthM/2)])].sort((a,b)=>a-b);
      for(let i=1;i<edges.length;i++){
        const a=edges[i-1],b=edges[i];if(b-a<.001)continue;
        const opening=w.openings.find(o=>(a+b)/2>o.centerM-o.widthM/2&&(a+b)/2<o.centerM+o.widthM/2);
        const spans=opening?[[0,Math.min(height,Math.max(0,opening.bottomM-w.a.y))],[Math.min(height,Math.max(0,opening.bottomM-w.a.y+opening.heightM)),height]]:[[0,height]];
        for(const [low,high] of spans){if(high-low<.001)continue;
          const g=new THREE.BoxGeometry(b-a,high-low,Math.max(.06,w.thicknessM));g.rotateY(-Math.atan2(w.b.z-w.a.z,w.b.x-w.a.x));
          g.translate(w.a.x+(w.b.x-w.a.x)*(a+b)/2/length,w.a.y+(high+low)/2,w.a.z+(w.b.z-w.a.z)*(a+b)/2/length);parts.push(g);}
      }
    });
    const merged=parts.length?mergeGeometries(parts):new THREE.BufferGeometry();parts.forEach(p=>p.dispose());return merged;
  },[apartment]);
  const texture=useMemo(()=>{
    if(!field)return null;const pixels=new Uint8Array(field.width*field.height*4);
    for(let i=0;i<field.db.length;i++){const c=levelColor(field.db[i]);pixels.set([c.r*255,c.g*255,c.b*255,field.mask[i]?255:0],i*4);}
    const t=new THREE.DataTexture(pixels,field.width,field.height,THREE.RGBAFormat);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
  },[field]);
  useEffect(()=>()=>{floors.forEach(g=>g.dispose());},[floors]);
  useEffect(()=>()=>walls.dispose(),[walls]);useEffect(()=>()=>texture?.dispose(),[texture]);
  return <group>{floors.map((g,i)=><mesh key={i} geometry={g} onClick={e=>{e.stopPropagation();onRoom(apartment.scene.regions[i].id);}}>
    <meshBasicMaterial key={texture?'field':'base'} map={texture} color={texture?'#ffffff':'#394b4c'} side={THREE.DoubleSide} toneMapped={false}/>
  </mesh>)}<mesh geometry={walls}><meshStandardMaterial color="#d6ded6" roughness={.85}/></mesh>
    {apartment.scene.surfaces.flatMap(w=>w.kind==='wall'?w.openings.filter(o=>o.kind==='window'||o.materialId==='glass').map(o=>{
      const length=Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z),t=o.centerM/length;
      return <mesh key={o.id} position={[w.a.x+(w.b.x-w.a.x)*t,o.bottomM+o.heightM/2,w.a.z+(w.b.z-w.a.z)*t]} rotation={[0,-Math.atan2(w.b.z-w.a.z,w.b.x-w.a.x),0]}>
        <boxGeometry args={[o.widthM,o.heightM,.035]}/><meshBasicMaterial color={o.state==='open'?'#85e3b6':'#79bdd7'} transparent opacity={o.state==='open'?.08:.35} depthWrite={false}/>
      </mesh>;
    }):[])}
  </group>;
}
export default function ApartmentView({apartment,field,paths,levels,roomId,onRoom,wallId}:{apartment:Apartment;field:SpectralField|null;paths:FlowLine[];levels:Record<string,number>;roomId:string;onRoom:(id:string)=>void;wallId?:string}){
  const selectedWall=apartment.scene.surfaces.find(s=>s.kind==='wall'&&s.id===wallId);
  const points=apartment.scene.regions.flatMap(r=>r.polygon),xs=points.map(p=>p.x),zs=points.map(p=>p.z);
  const cy=Math.min(...points.map(p=>p.y));
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
  const extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
  const minX=Math.min(...xs)-2,minZ=Math.min(...zs)-2,maxX=Math.max(...xs)+2,maxZ=Math.max(...zs)+2;
  const indoorPaths=useMemo(()=>clipFlowLines(paths,[minX,minZ,maxX,maxZ]),[paths,minX,minZ,maxX,maxZ]);
  return <Canvas key={apartment.id+apartment.scene.regions[0]?.floorId} dpr={[1,1.5]} camera={{position:[cx+extent*.4,cy+extent*.95,cz+extent*1.2],fov:43,near:.05,far:2500}}>
    <color attach="background" args={['#17282b']}/><ambientLight intensity={.9}/><directionalLight position={[5,15,8]} intensity={1.2}/>
    <ApartmentMesh apartment={apartment} field={field} onRoom={onRoom}/><FlowPaths paths={indoorPaths}/>
    {selectedWall?.kind==='wall'&&<Line points={[[selectedWall.a.x,selectedWall.a.y+1.08,selectedWall.a.z],[selectedWall.b.x,selectedWall.b.y+1.08,selectedWall.b.z]]} color="#ffe18c" lineWidth={5} depthTest={false}/>}
    {apartment.rooms.filter(r=>!r.name.startsWith('Other')&&!r.name.startsWith('Closet')).map(room=><Html key={room.id} position={[room.probe.x,room.probe.y-.95,room.probe.z]} center zIndexRange={[8,0]}>
      <button className={`room-probe ${room.id===roomId?'selected':''}`} onClick={()=>onRoom(room.id)}><span>{room.name}</span><strong>{levels[room.id]>-100?levels[room.id].toFixed(1):'—'}<small> dBA</small></strong></button>
    </Html>)}
    <OrbitControls target={[cx,cy,cz]} maxPolarAngle={Math.PI*.46} minDistance={5} maxDistance={55} enableDamping/>
  </Canvas>;
}
