import CloudBoundary from './CloudBoundary';
import VexcelMesh, { type MeshStatus } from './VexcelMesh';
import { AERIAL_ELEVATION, containMapCamera, frameMapCamera } from './camera';
import { STUDY_BOUNDS } from './study';
import { makeVehicleTracks, vehicleAt } from './vehicles';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Line, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { buildingGeometry, merge, ribbon, roofGeometry, shapeOf, terrainGeometries } from './geometry';
import { VIEWS, type Building, type District, type Layers, type ViewName, type Road } from './data';
import FlowPaths from '../acoustics/FlowPaths';
import { DEFAULT_SCENARIO } from './simulation';
import type { NoiseStudy } from './useNoiseStudy';
import type { ViewableBuilding } from './viewableBuildings';
import type { MappedTourProperty } from './tours';

type Pose = {position:[number,number,number]; rotation:number; scale:number};
const ASSETS='/neighborhood/assets/';

function useSurface(name:string, repeat=1){
  const textures=useTexture([ASSETS+name+'_diff.jpg',ASSETS+name+'_nor_gl.jpg']);
  const maps=useMemo(()=>textures.map((t,i)=>{const c=t.clone();c.wrapS=c.wrapT=THREE.RepeatWrapping;c.repeat.set(repeat,repeat);c.anisotropy=8;if(i===0)c.colorSpace=THREE.SRGBColorSpace;return c;}),[textures,repeat]);
  useEffect(()=>()=>maps.forEach(t=>t.dispose()),[maps]);return maps;
}
function Buildings({data,selected,onSelect}:{data:District;selected:Building|null;onSelect:(b:Building)=>void}){
  const [brick,normal]=useSurface('whitewashed_brick');
  const roofMaps=useTexture(data.imagery.slice(0,2).map((im,i)=>im.url??['/neighborhood/district.jpg','/neighborhood/volterra.jpg'][i]));
  const prepared=useMemo(()=>{
    const roofParts:THREE.BufferGeometry[][]=[[],[]], ranges:{end:number;building:Building}[][]=[[],[]];let totals=[0,0];
    data.buildings.forEach(b=>{
      const [x0,z0,x1,z1]=data.imagery[1].bounds;
      const fine=b.rings[0].every(p=>p[0]>x0&&p[0]<x1&&p[1]>z0&&p[1]<z1)?1:0;
      const geo=roofGeometry(b,data.imagery[fine]);roofParts[fine].push(geo);totals[fine]+=geo.getAttribute('position').count/3;ranges[fine].push({end:totals[fine],building:b});
    });
    return {...buildingGeometry(data.buildings),roofs:roofParts.map(merge),ranges};
  },[data]);
  useEffect(()=>()=>{prepared.walls.dispose();prepared.frames.dispose();prepared.windows.dispose();prepared.roofs.forEach(g=>g.dispose());},[prepared]);
  const selectedGeo=useMemo(()=>{
    if(!selected)return null;
    const g=new THREE.ExtrudeGeometry(shapeOf(selected.rings),{depth:selected.height+2.2,bevelEnabled:false});g.rotateX(-Math.PI/2);return g;
  },[selected]);
  useEffect(()=>()=>selectedGeo?.dispose(),[selectedGeo]);
  return <group>
    <mesh geometry={prepared.walls} castShadow receiveShadow>
      <meshStandardMaterial map={brick} normalMap={normal} normalScale={new THREE.Vector2(.3,.3)} color="#ddd9cc" roughness={.85} side={THREE.DoubleSide}/>
    </mesh>
    <mesh geometry={prepared.frames} castShadow><meshStandardMaterial color="#e7e1d5" roughness={.7} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>
    <mesh geometry={prepared.windows}><meshStandardMaterial color="#243c48" metalness={.5} roughness={.19} envMapIntensity={1.2} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>
    {prepared.roofs.map((geometry,index)=><mesh key={index} geometry={geometry} castShadow receiveShadow onClick={e=>{
      e.stopPropagation();const hit=prepared.ranges[index].find(r=>(e.faceIndex??-1)<r.end);if(hit)onSelect(hit.building);
    }} onPointerOver={e=>{e.stopPropagation();document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='auto';}}>
      <meshStandardMaterial map={roofMaps[index]} roughness={.92} side={THREE.DoubleSide}/>
    </mesh>)}
    {selectedGeo&&<mesh geometry={selectedGeo}><meshBasicMaterial color="#bbebc2" transparent opacity={.16} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}/></mesh>}
  </group>;
}

function Terrain({data}:{data:District}){
  const images=useTexture(data.imagery.map((im,i)=>im.url??['/neighborhood/district.jpg','/neighborhood/volterra.jpg','/neighborhood/context.jpg'][i]));
  const geometries=useMemo(()=>terrainGeometries(data.imagery,data.studyBounds),[data.imagery,data.studyBounds]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  images.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;});
  return <group>{data.imagery.map((im,i)=><mesh key={im.name} geometry={geometries[i]} receiveShadow>
    <meshStandardMaterial map={images[i]} roughness={1}/>
  </mesh>)}</group>;
}

function AvailableBuilding({entry,flat,active,onOpen,onTour}:{entry:ViewableBuilding;flat:boolean;active:string|null;onOpen:(b:Building,id:string)=>void;onTour?:()=>void}){
  const {building,interiors}=entry,y=flat?.5:building.height+.6;
  const roof=useMemo(()=>{const g=new THREE.ShapeGeometry(shapeOf(building.rings));g.rotateX(-Math.PI/2);return g;},[building]);
  useEffect(()=>()=>roof.dispose(),[roof]);
  const selected=interiors.some(a=>a.id===active);
  return <group>
    <mesh geometry={roof} position={[0,y,0]} renderOrder={3} onClick={e=>{e.stopPropagation();onOpen(building,interiors.find(a=>a.id===active)?.id??interiors[0].id);}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='auto';}}>
      <meshBasicMaterial color="#35e8ba" transparent opacity={selected?.35:.22} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}/>
    </mesh>
    {building.rings.map((ring,i)=><Line key={i} points={[...ring,ring[0]].map(([x,z])=>[x,y+.1,z] as [number,number,number])} color="#64ffcf" lineWidth={selected?3.5:2.5} depthTest={false} depthWrite={false} renderOrder={4}/>)}
    <Html position={[building.center[0],y+24,building.center[1]]} center zIndexRange={[19,0]}>
      <div className="viewable-building-label" role="group" aria-label={`Available measured interiors: ${interiors.map(i=>i.name).join(", ")}`}>
        <span className="viewable-building-title"><i/>Indoor sound <small>{interiors.length} layouts</small></span>
        <div>{interiors.map(a=><button key={a.id} aria-label={`View inside ${a.name}`} aria-pressed={active===a.id} onClick={()=>onOpen(building,a.id)}>{a.name.split(',')[0]} <span>↗</span></button>)}</div>
        {onTour&&<button className="building-open-tour" onClick={onTour}>Open real interior tours ↗</button>}
      </div>
    </Html>
  </group>;
}

function PropertyTourMarkers({properties,flat,soundBuildings,onOpen}:{properties:MappedTourProperty[];flat:boolean;soundBuildings:Set<string>;onOpen:(propertyId:number)=>void}){
  return <group>{properties.map(property=><group key={property.id}>
    {property.buildings.filter(b=>!soundBuildings.has(b.id)).flatMap(b=>b.rings.map((ring,i)=><Line key={`${b.id}-${i}`} points={[...ring,ring[0]].map(([x,z])=>[x,flat?.6:b.height+.7,z] as [number,number,number])} color="#80ceff" lineWidth={2.5} depthTest={false} depthWrite={false} renderOrder={4} onClick={e=>{e.stopPropagation();onOpen(property.id);}}/>))}
    <Html position={[property.position[0],flat?1:26,property.position[1]]} center zIndexRange={[18,0]}><button className="property-tour-pin" aria-label={`Open tours at ${property.name}, ${property.address}`} title={`${property.name} · ${property.tours.length} tours`} onClick={()=>onOpen(property.id)}><span>360°</span><small>{property.tours.length}</small></button></Html>
  </group>)}</group>;
}

function Roads({data}:{data:District}){
  const map=useTexture(data.imagery[0].url??'/neighborhood/district.jpg');
  const bridges=useMemo(()=>{
    const result=merge(data.roads.filter(r=>r.bridge).map(r=>ribbon(r.points,r.lanes*3.5+3,5)));
    const p=result.getAttribute('position'),uv=result.getAttribute('uv');if(!p||!uv)return result;const [x0,z0,x1,z1]=data.imagery[0].bounds;
    if(!p||!uv)return result;
    for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-x0)/(x1-x0),1-(p.getZ(i)-z0)/(z1-z0));return result;
  },[data]);
  useEffect(()=>()=>bridges.dispose(),[bridges]);
  // Existing lane paint, curbs, driveways and medians come from the aerial map.
  // Only bridges need raised road geometry; replacing all imagery with inferred
  // lane widths would remove real road detail and imply unmeasured dimensions.
  if(!bridges.getAttribute('position'))return null;
  return <mesh geometry={bridges} castShadow receiveShadow><meshStandardMaterial map={map} roughness={.95} side={THREE.DoubleSide}/></mesh>;
}

function AssetInstances({url,poses,unitLength,animate}:{url:string;poses:Pose[];unitLength?:number;animate?:(poses:Pose[],dt:number)=>void}){
  const {scene}=useGLTF(url);
  const refs=useRef<(THREE.InstancedMesh|null)[]>([]);
  const prepared=useMemo(()=>{
    scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
    const scale=unitLength?unitLength/Math.max(size.x,size.z):1;
    const normalization=new THREE.Matrix4().makeScale(scale,scale,scale);
    if(unitLength&&size.x>size.z)normalization.multiply(new THREE.Matrix4().makeRotationY(Math.PI/2));
    normalization.multiply(new THREE.Matrix4().makeTranslation(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2));
    const parts:{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrix:THREE.Matrix4}[]=[];
    scene.traverse(o=>{if(o instanceof THREE.Mesh){
      const materials=(Array.isArray(o.material)?o.material:[o.material]).map((original:THREE.MeshStandardMaterial)=>{
        const m=new THREE.MeshStandardMaterial({map:original.map,normalMap:original.normalMap,roughnessMap:original.roughnessMap,metalnessMap:original.metalnessMap,
          color:original.color,roughness:Math.max(original.roughness,.32),metalness:original.metalness,side:original.side,
          alphaTest:original.transparent?.45:original.alphaTest,transparent:false});return m;
      });
      parts.push({geometry:o.geometry,material:Array.isArray(o.material)?materials:materials[0],matrix:normalization.clone().multiply(o.matrixWorld)});
    }});return parts;
  },[scene,unitLength]);
  useEffect(()=>()=>prepared.forEach(p=>(Array.isArray(p.material)?p.material:[p.material]).forEach(m=>m.dispose())),[prepared]);
  const dummy=useMemo(()=>new THREE.Object3D(),[]),matrix=useMemo(()=>new THREE.Matrix4(),[]);
  function update(){
    poses.forEach((pose,i)=>{
      dummy.position.set(...pose.position);dummy.rotation.set(0,pose.rotation,0);dummy.scale.setScalar(pose.scale);dummy.updateMatrix();
      prepared.forEach((part,k)=>{matrix.multiplyMatrices(dummy.matrix,part.matrix);refs.current[k]?.setMatrixAt(i,matrix);});
    });
    refs.current.forEach(m=>{if(m){m.count=poses.length;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();}});
  }
  useEffect(update,[poses,prepared,dummy,matrix]);
  useFrame((_,dt)=>{if(animate){animate(poses,dt);update();}});
  return <group>{prepared.map((p,i)=><instancedMesh key={i} ref={r=>{refs.current[i]=r;}} args={[p.geometry,p.material,Math.max(1,poses.length)]} castShadow receiveShadow/>)}</group>;
}

function Trees({data}:{data:District}){
  const {camera,controls}=useThree();
  const [near,setNear]=useState(()=>[...data.trees].sort((a,b)=>Math.hypot(...a.position)-Math.hypot(...b.position)).slice(0,170));
  const tick=useRef(0),last=useRef(new THREE.Vector3(Infinity,Infinity,Infinity));
  useFrame(()=>{const focus=(controls as OrbitControlsImpl|null)?.target??camera.position;if(++tick.current%40!==0||focus.distanceToSquared(last.current)<900)return;
    last.current.copy(focus);setNear([...data.trees].sort((a,b)=>
      Math.hypot(a.position[0]-focus.x,a.position[1]-focus.z)-Math.hypot(b.position[0]-focus.x,b.position[1]-focus.z)).slice(0,170));});
  const poses=useMemo(()=>near.map((t,i)=>({position:[t.position[0],.1,t.position[1]] as [number,number,number],rotation:(i*2.399),scale:t.height/3.4})),[near]);
  return <AssetInstances url={ASSETS+'tree.glb'} poses={poses}/>;
}

function Traffic({data,paused,study}:{data:District;paused:boolean;study?:NoiseStudy}){
  const counts=study?.scenario.fleet??DEFAULT_SCENARIO.fleet;
  const tracks=useMemo(()=>makeVehicleTracks(data,counts,study?.vehicleData??null),[data,counts,study?.vehicleData]);
  const time=useRef(0),published=useRef(-Infinity);
  const poses=useMemo(()=>tracks.map((t,i)=>({...vehicleAt(t,0,i),scale:1})),[tracks]);
  const cars=useMemo(()=>poses.filter((_,i)=>tracks[i].kind==='car'),[poses,tracks]);
  const trucks=useMemo(()=>poses.filter((_,i)=>tracks[i].kind==='truck'),[poses,tracks]);
  useEffect(()=>{published.current=-Infinity;},[tracks,paused]);
  useFrame((_,dt)=>{
    if(!paused)time.current+=Math.min(dt,.05);
    tracks.forEach((t,i)=>{const next=vehicleAt(t,time.current,i);poses[i].position=next.position;poses[i].rotation=next.rotation;poses[i].emitter=next.emitter;});
    if(study?.onEmitters&&time.current-published.current>=1){published.current=time.current;study.onEmitters(poses.map(p=>p.emitter));}
  });
  return <><AssetInstances url={ASSETS+'car.glb'} poses={cars} unitLength={4.5} animate={()=>{}}/><AssetInstances url={ASSETS+'CesiumMilkTruck.glb'} poses={trucks} unitLength={6.5} animate={()=>{}}/></>;
}

function Markers({data,onView,sources,hasInteriors}:{data:District;onView:(v:ViewName)=>void;sources:boolean;hasInteriors:boolean}){
  const sourcePoints=useMemo(()=>{
    const nearest=(roads:Road[],target:[number,number])=>{
      let best: [number,number]|null=null,dist=Infinity;
      roads.forEach(r=>r.points.slice(1).forEach((b,i)=>{const a=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dz)/(dx*dx+dz*dz||1)));const p:[number,number]=[a[0]+t*dx,a[1]+t*dz];const d=Math.hypot(p[0]-target[0],p[1]-target[1]);if(d<dist){dist=d;best=p;}}));return best;
    };
    const road=nearest(data.roads.filter(r=>r.name==='Greenhouse Road'),[0,0]);
    const highway=nearest(data.roads.filter(r=>r.kind==='motorway'),[0,1290]);
    const zone=data.zones[0],construction=zone?.points.reduce((a,p)=>[a[0]+p[0]/zone.points.length,a[1]+p[1]/zone.points.length],[0,0]);
    return [...(road?[{point:road,label:'Road source'}]:[]),...(highway?[{point:highway,label:'Highway source'}]:[]),...(construction?[{point:construction,label:'Construction source'}]:[])];
  },[data]);
  return <group>
    {!hasInteriors&&<Html position={[-40,23,30]} center zIndexRange={[15,0]}><button className="map-label property-label" onClick={()=>onView('apartments')}><span>AP</span>Volterra at Westlake</button></Html>}
    <Html position={[55,8,1250]} center zIndexRange={[14,0]}><button className="map-label road-label" onClick={()=>onView('highway')}><span>I‑10</span>Katy Freeway</button></Html>
    <Html position={[115,5,280]} center zIndexRange={[13,0]}><span className="map-road-name">Greenhouse Road</span></Html>
    <Html position={[-440,17,-70]} center zIndexRange={[12,0]}><button className="map-label" onClick={()=>onView('homes')}>Residential streets</button></Html>
    {data.zones.map(z=>{const c=z.points.reduce((a,p)=>[a[0]+p[0]/z.points.length,a[1]+p[1]/z.points.length],[0,0]);return <Html key={z.id} position={[c[0],9,c[1]]} center zIndexRange={[11,0]}><button className="map-label construction-label" onClick={()=>onView('construction')}><span>C</span>Mapped construction</button></Html>;})}
    {sources&&sourcePoints.map(({point,label},i)=><group key={i} position={[point[0],3,point[1]]}>
      <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[5,6,48]}/><meshBasicMaterial color="#eaaa65" side={THREE.DoubleSide}/></mesh>
      <Html position={[0,9,0]} center zIndexRange={[16,0]}><span className="source-label">{label} · level unassigned</span></Html>
    </group>)}
  </group>;
}
function Construction({data}:{data:District}){
  const shapes=useMemo(()=>data.zones.map(z=>{const g=new THREE.ShapeGeometry(shapeOf([z.points]));g.rotateX(-Math.PI/2).translate(0,.2,0);return g;}),[data]);
  useEffect(()=>()=>shapes.forEach(g=>g.dispose()),[shapes]);
  return <group>{shapes.map((g,i)=><mesh key={i} geometry={g}><meshBasicMaterial color="#dcb271" transparent opacity={.16} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>)}</group>;
}

function CameraRig({view,topDown,zoomRequest,resetKey,focus,compassRef}:{view:ViewName;topDown:boolean;zoomRequest:{key:number;direction:number};resetKey:number;focus:Building|null;compassRef:RefObject<HTMLSpanElement|null>}){
  const ref=useRef<OrbitControlsImpl>(null),{camera}=useThree();
  const destination=useRef<{position:THREE.Vector3;target:THREE.Vector3}|null>(null);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  useEffect(()=>{
    const v=VIEWS[view],target=new THREE.Vector3(...v.target),position=new THREE.Vector3(...v.position);
    if(topDown)position.copy(target).add(new THREE.Vector3(0,view==='district'?2200:600,.01));
    const preview=(camera as THREE.PerspectiveCamera).clone();
    preview.position.copy(position);frameMapCamera(preview,target,STUDY_BOUNDS);position.copy(preview.position);
    destination.current={target,position};
    if(reduced){camera.position.copy(position);ref.current?.target.copy(target);ref.current?.update();destination.current=null;}
  },[view,topDown,resetKey,reduced,camera]);
  useEffect(()=>{if(!focus)return;const target=new THREE.Vector3(focus.center[0],0,focus.center[1]);const size=Math.max(120,Math.sqrt(focus.area)*2.2);const position=target.clone().add(new THREE.Vector3(size,Math.hypot(size,size*1.3)*Math.tan(AERIAL_ELEVATION),size*1.3));const preview=(camera as THREE.PerspectiveCamera).clone();preview.position.copy(position);frameMapCamera(preview,target,STUDY_BOUNDS);position.copy(preview.position);destination.current={target,position};if(reduced){camera.position.copy(position);ref.current?.target.copy(target);ref.current?.update();destination.current=null;}},[focus,reduced,camera]);
  useEffect(()=>{if(!ref.current||!zoomRequest.key)return;const offset=camera.position.clone().sub(ref.current.target).multiplyScalar(zoomRequest.direction>0?.78:1.28);camera.position.copy(ref.current.target).add(offset);ref.current.update();destination.current=null;},[zoomRequest,camera]);
  const north=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((_,dt)=>{if(destination.current&&ref.current){const f=1-Math.exp(-dt*5);camera.position.lerp(destination.current.position,f);ref.current.target.lerp(destination.current.target,f);ref.current.update();if(camera.position.distanceTo(destination.current.position)<.2)destination.current=null;}
    if(ref.current)containMapCamera(camera as THREE.PerspectiveCamera,ref.current.target,STUDY_BOUNDS);
    if(compassRef.current){north.set(0,0,-1).transformDirection(camera.matrixWorldInverse);compassRef.current.style.transform=`rotate(${Math.atan2(north.x,north.y)}rad)`;}
  });
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={.12} enableRotate={false} zoomToCursor screenSpacePanning={false} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}} maxPolarAngle={Math.PI/2-35*Math.PI/180} minDistance={25} maxDistance={6000} onStart={()=>{destination.current=null;}}/>;
}

export default function DistrictCanvas({data,layers,view,onView,selected,onSelect,onOpenInterior,tourProperties,onOpenTours,paused,topDown,zoomRequest,resetKey,focus,onReady,compassRef,study,onMeshStatus}:{
  data:District;layers:Layers;view:ViewName;onView:(v:ViewName)=>void;selected:Building|null;onSelect:(b:Building)=>void;onOpenInterior:(b:Building,id:string)=>void;tourProperties:MappedTourProperty[];onOpenTours:(propertyId:number)=>void;paused:boolean;topDown:boolean;zoomRequest:{key:number;direction:number};resetKey:number;focus:Building|null;onReady:()=>void;compassRef:RefObject<HTMLSpanElement|null>;study?:NoiseStudy;onMeshStatus:(s:MeshStatus)=>void;
}){
  const [meshStatus,setMeshStatus]=useState<MeshStatus>('loading');
  useEffect(()=>onMeshStatus(meshStatus),[meshStatus,onMeshStatus]);
  const useMesh=layers.buildings&&!topDown;
  const meshReady=useMesh&&meshStatus==='ready';
  return <Canvas shadows dpr={[1,1.6]} camera={{position:VIEWS[view].position,fov:43,near:5,far:15000}} gl={{antialias:true,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.05;}}>
    <color attach="background" args={['#ffffff']}/>
    <ambientLight intensity={.6}/><hemisphereLight args={['#e0edf5','#a6a087',1.25]}/>
    <directionalLight position={[-350,700,-260]} intensity={2.3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-650} shadow-camera-right={650} shadow-camera-top={650} shadow-camera-bottom={-650} shadow-camera-far={2200} shadow-bias={-.00015} shadow-normalBias={.4}/>
    <Suspense fallback={null}>
      <Environment files={ASSETS+'daylight.hdr'} environmentIntensity={.45}/>
      {useMesh&&<VexcelMesh data={data} onStatus={setMeshStatus} onSelect={onSelect}/>}
      {!meshReady&&<><Terrain data={data}/><Roads data={data}/></>}
      <CloudBoundary bounds={data.studyBounds??STUDY_BOUNDS}/><Construction data={data}/>
      {useMesh&&!meshReady&&<Buildings data={data} selected={selected} onSelect={onSelect}/>}
      {layers.trees&&!topDown&&!meshReady&&<Trees data={data}/>}
      {(layers.traffic||study)&&<group visible={layers.traffic}><Traffic data={data} paused={paused} study={study}/></group>}
      <Markers data={data} onView={onView} sources={layers.sources} hasInteriors={Boolean(study?.viewable.length)}/>
      <PropertyTourMarkers properties={tourProperties} flat={topDown||!layers.buildings} soundBuildings={new Set(study?.viewable.map(v=>v.building.id))} onOpen={onOpenTours}/>
      {study?.viewable.map(entry=>{const property=tourProperties.find(p=>p.tours.some(t=>entry.interiors.some(a=>a.id===t.id)));return <AvailableBuilding key={entry.building.id} entry={entry} flat={topDown||!layers.buildings} active={study.open?study.selected:null} onOpen={onOpenInterior} onTour={property?()=>onOpenTours(property.id):undefined}/>;})}
      {study&&<><FlowPaths paths={study.mapPaths} scale={45}/>
        {study.sources.filter(s=>s.id==='construction-site').map(s=><group key={s.id} position={[s.position.x,12,s.position.z]}>
          <mesh><sphereGeometry args={[8,16,8]}/><meshBasicMaterial color="#ed9961"/></mesh>
          <Html center position={[0,20,0]} zIndexRange={[16,0]}><span className="source-label">Construction · scenario active</span></Html>
        </group>)}
      </>}
      <Ready onReady={onReady}/>
    </Suspense>
    <EffectComposer multisampling={0}><N8AO aoRadius={3} intensity={1.4} distanceFalloff={1} quality="low" halfRes/></EffectComposer>
    <CameraRig view={view} topDown={topDown} zoomRequest={zoomRequest} resetKey={resetKey} focus={focus} compassRef={compassRef}/>
  </Canvas>;
}
function Ready({onReady}:{onReady:()=>void}){useEffect(onReady,[onReady]);return null;}
