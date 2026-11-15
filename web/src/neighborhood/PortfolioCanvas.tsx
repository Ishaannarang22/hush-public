import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as Controls } from 'three-stdlib';
import * as THREE from 'three';
import PortfolioImagery from './PortfolioImagery';
import type { MeshStatus } from './VexcelMesh';
import CloudBoundary from './CloudBoundary';
import { containMapCamera, type MapBounds } from './camera';
import { exposureColor, project, propertyMassing, unproject, type EnvironmentSource, type Geo, type PortfolioProperty, type PropertyExposure } from './portfolioModel';
export type PortfolioFocus={x:number;z:number;distance:number;key:number};
type Props={imageryCollection?:string;meshStatus:MeshStatus;onMeshStatus:(status:MeshStatus)=>void;quality:number;properties:PortfolioProperty[];origin:Geo;results:PropertyExposure[];baseline:PropertyExposure[];delta:boolean;sources:EnvironmentSource[];selected:string|null;onSelect:(p:PortfolioProperty)=>void;onPlace:(geo:Geo)=>void;placing:boolean;focus:PortfolioFocus;onSource:(id:string)=>void};
function Models({properties,origin,results,baseline,delta,selected,onSelect,imageryCollection,meshStatus}:Props){
  const mesh=useRef<THREE.InstancedMesh>(null),points=useRef<THREE.Points>(null);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(properties.flatMap(p=>{const [x,z]=project(p,origin);return [x,propertyMassing(p).height+3,z];}),3));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(properties.length*3),3));return g;},[properties,origin]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{const dummy=new THREE.Object3D();properties.forEach((p,i)=>{const [x,z]=project(p,origin),m=propertyMassing(p);dummy.position.set(x,m.height/2,z);dummy.scale.set(m.width,m.height,m.depth);dummy.updateMatrix();mesh.current?.setMatrixAt(i,dummy.matrix);});if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();}},[properties,origin]);
  useEffect(()=>{const current=new Map(results.map(r=>[r.id,r])),before=new Map(baseline.map(r=>[r.id,r])),colors=geometry.getAttribute('color');properties.forEach((p,i)=>{const db=current.get(p.id)?.indoor??null,old=before.get(p.id)?.indoor??null;const color=new THREE.Color(exposureColor(delta?(db===null||old===null?null:db-old):db,delta));mesh.current?.setColorAt(i,color);colors.setXYZ(i,color.r,color.g,color.b);});colors.needsUpdate=true;if(mesh.current?.instanceColor)mesh.current.instanceColor.needsUpdate=true;},[properties,results,baseline,delta,geometry]);
  const chosen=properties.find(p=>p.id===selected),position=chosen?project(chosen,origin):null;
  return <group>
    <instancedMesh visible={!imageryCollection||meshStatus!=='ready'} ref={mesh} args={[undefined,undefined,Math.max(1,properties.length)]} onClick={e=>{if(e.delta>5)return;e.stopPropagation();if(e.instanceId!==undefined)onSelect(properties[e.instanceId]);}}><boxGeometry/><meshStandardMaterial roughness={.9}/></instancedMesh>
    <points ref={points} geometry={geometry} onClick={e=>{if(e.delta>5)return;e.stopPropagation();if(e.index!==undefined)onSelect(properties[e.index]);}}><pointsMaterial size={7} sizeAttenuation={false} vertexColors transparent opacity={.9} depthTest={!imageryCollection} depthWrite={false}/></points>
    {position&&chosen&&<group position={[position[0],propertyMassing(chosen).height+5,position[1]]}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[Math.max(16,propertyMassing(chosen).width*.7),Math.max(19,propertyMassing(chosen).width*.7+3),48]}/><meshBasicMaterial color="#254f46" side={THREE.DoubleSide}/></mesh><Html position={[0,16,0]} center zIndexRange={[8,0]}><div className="portfolio-pin">{chosen.name}</div></Html></group>}
  </group>;
}
function Camera({focus,bounds}:{focus:PortfolioFocus;bounds:MapBounds}){const controls=useRef<Controls>(null),{camera}=useThree();useEffect(()=>{const d=focus.distance;camera.position.set(focus.x+d*.45,d*.643,focus.z+d*.62);controls.current?.target.set(focus.x,0,focus.z);controls.current?.update();},[focus,camera]);useFrame(()=>{if(controls.current)containMapCamera(camera as THREE.PerspectiveCamera,controls.current.target,bounds);});return <OrbitControls ref={controls} makeDefault enableRotate={false} enableDamping zoomToCursor screenSpacePanning={false} minDistance={35} maxDistance={300000} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}}/>;}
function PointPicking(){const {camera,raycaster,size,controls}=useThree();useFrame(()=>{const target=(controls as Controls|null)?.target??new THREE.Vector3();const distance=camera.position.distanceTo(target);raycaster.params.Points.threshold=Math.max(2,distance*Math.tan((camera as THREE.PerspectiveCamera).fov*Math.PI/360)*7/size.height);});return null;}
export default function PortfolioCanvas(props:Props){const bounds=useMemo<MapBounds>(()=>{const points=props.properties.map(p=>project(p,props.origin)),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);return points.length?[Math.min(...xs)-1000,Math.min(...zs)-1000,Math.max(...xs)+1000,Math.max(...zs)+1000]:[-1000,-1000,1000,1000];},[props.properties,props.origin]);return <Canvas dpr={[1,2]} camera={{position:[800,1100,1000],near:1,far:800000,fov:45}} raycaster={{params:{Mesh:{},LOD:{},Sprite:{},Points:{threshold:15},Line:{threshold:1}}}}>
  <color attach="background" args={['#edf1ea']}/><ambientLight intensity={1.8}/><directionalLight position={[-500,1000,400]} intensity={2}/>
  <mesh rotation={[-Math.PI/2,0,0]} position={[(bounds[0]+bounds[2])/2,-.1,(bounds[1]+bounds[3])/2]} onClick={e=>{if(e.delta<5&&props.placing)props.onPlace(unproject(e.point.x,e.point.z,props.origin));}}><planeGeometry args={[bounds[2]-bounds[0],bounds[3]-bounds[1]]}/><meshStandardMaterial color="#edf1ea" roughness={1} transparent opacity={props.imageryCollection&&props.meshStatus==='ready'?0:1} depthWrite={!props.imageryCollection||props.meshStatus!=='ready'}/></mesh>
  {props.imageryCollection&&<PortfolioImagery origin={props.origin} collection={props.imageryCollection} quality={props.quality} onStatus={props.onMeshStatus} onPoint={(x,z)=>{
    if(props.placing){if(x>=bounds[0]&&x<=bounds[2]&&z>=bounds[1]&&z<=bounds[3])props.onPlace(unproject(x,z,props.origin));return;}
    let nearest:PortfolioProperty|undefined,distance=200;
    for(const p of props.properties){const [px,pz]=project(p,props.origin),d=Math.hypot(x-px,z-pz);if(d<distance){distance=d;nearest=p;}}
    if(nearest)props.onSelect(nearest);
  }}/>}
  <CloudBoundary bounds={bounds}/>
  <Models {...props} onSelect={p=>props.placing?props.onPlace({lat:p.lat,lon:p.lon}):props.onSelect(p)}/>
  {props.sources.map(s=>{const [x,z]=project(s,props.origin);return <group key={s.id} position={[x,3,z]}>
    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[70,74,64]}/><meshBasicMaterial color={s.enabled?'#db794c':'#a0aba4'} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0,s.height+10,0]} onClick={e=>{e.stopPropagation();props.onSource(s.id);}}><sphereGeometry args={[14,16,12]}/><meshStandardMaterial color={s.enabled?'#ce6d40':'#a0aba4'}/></mesh>
    <Html position={[0,s.height+45,0]} center zIndexRange={[9,0]}><button className="portfolio-source-pin" onClick={()=>props.onSource(s.id)}>{s.kind} · {s.enabled?`${s.level} dBA`:'off'}</button></Html>
  </group>;})}
  <Camera focus={props.focus} bounds={bounds}/><PointPicking/>
</Canvas>;}
