import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { Group, Matrix4, Mesh, MeshBasicMaterial, Plane, Raycaster, Vector3 } from 'three';
import type { District, Building } from './data';
import { STUDY_BOUNDS } from './study';

export type MeshStatus='loading'|'ready'|'error';

/** ECEF coordinates to east/up/south metres at our existing map origin. */
export function localMeshFrame(latDegrees:number,lonDegrees:number){
  const lat=latDegrees*Math.PI/180,lon=lonDegrees*Math.PI/180;
  const s=Math.sin(lat),c=Math.cos(lat),sl=Math.sin(lon),cl=Math.cos(lon);
  const n=6378137/Math.sqrt(1-0.00669437999014*s*s);
  const origin=new Vector3(n*c*cl,n*c*sl,n*(1-0.00669437999014)*s);
  const east=new Vector3(-sl,cl,0),up=new Vector3(c*cl,c*sl,s),south=new Vector3(s*cl,s*sl,-c);
  return new Matrix4().set(east.x,east.y,east.z,-east.dot(origin),up.x,up.y,up.z,-up.dot(origin),south.x,south.y,south.z,-south.dot(origin),0,0,0,1);
}

export default function VexcelMesh({data,onStatus,onSelect,tilesetUrl='/api/neighborhood/vexcel/3d/tileset',quality=3,portfolio=false,onPoint}:{data:Pick<District,'origin'|'studyBounds'|'buildings'>;onStatus:(s:MeshStatus)=>void;onSelect:(b:Building)=>void;tilesetUrl?:string;quality?:number;portfolio?:boolean;onPoint?:(x:number,z:number)=>void}){
  const {camera,gl}=useThree(),host=useRef<Group>(null),renderer=useRef<TilesRenderer|null>(null);
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  useEffect(()=>{
    const tiles=new TilesRenderer(tilesetUrl);
    const draco=new DRACOLoader().setDecoderPath('/neighborhood/draco/').setWorkerLimit(2);
    const ktx=new KTX2Loader().setTranscoderPath('/neighborhood/basis/').setWorkerLimit(2).detectSupport(gl);
    tiles.registerPlugin(new GLTFExtensionsPlugin({dracoLoader:draco,ktxLoader:ktx}));
    renderer.current=tiles;tiles.errorTarget=quality;
    if(portfolio){tiles.loadSiblings=false;tiles.loadAncestors=false;}tiles.downloadQueue.maxJobsPerOrigin=5;
    tiles.lruCache.maxSize=portfolio?4096:512;tiles.lruCache.minSize=portfolio?3000:300;tiles.lruCache.maxBytesSize=320*1024*1024;
    tiles.setCamera(camera);tiles.group.matrixAutoUpdate=false;
    const frame=localMeshFrame(data.origin.lat,data.origin.lon);tiles.group.matrix.copy(frame);
    const [x0,z0,x1,z1]=data.studyBounds??STUDY_BOUNDS;
    const clippingPlanes=portfolio?[]:[new Plane(new Vector3(1,0,0),-x0),new Plane(new Vector3(-1,0,0),x1),new Plane(new Vector3(0,0,1),-z0),new Plane(new Vector3(0,0,-1),z1)];
    const previousClipping=gl.localClippingEnabled;gl.localClippingEnabled=true;
    let disposed=false,loaded=false,aligned=false;
    const materials=new Set<MeshBasicMaterial>();
    tiles.addEventListener('load-model',({scene})=>{
      scene.traverse(object=>{if(object instanceof Mesh){
        const source=Array.isArray(object.material)?object.material:[object.material];
        const next=source.map(m=>{const material=new MeshBasicMaterial({map:m.map,color:m.color,side:m.side,clippingPlanes});material.toneMapped=false;materials.add(material);return material;});
        object.material=Array.isArray(object.material)?next:next[0];source.forEach(m=>m.dispose());
      }});
    });
    tiles.addEventListener('dispose-model',({scene})=>{
      scene.traverse(object=>{if(object instanceof Mesh){
        for(const m of Array.isArray(object.material)?object.material:[object.material])materials.delete(m);
      }});
    });
    tiles.addEventListener('tiles-load-end',()=>{
      if(disposed)return;
      // Align the photographic road surface with the local acoustic ground.
      // This is a visual datum adjustment, not a new elevation measurement.
      if(!aligned){
        tiles.group.updateMatrixWorld(true);
        const ray=new Raycaster(new Vector3(portfolio?0:5.506,2000,portfolio?0:85.894),new Vector3(0,-1,0));
        const hits=ray.intersectObject(tiles.group,true);
        if(hits.length){tiles.group.matrix.copy(frame);tiles.group.matrix.elements[13]-=hits[0].point.y;tiles.group.updateMatrixWorld(true);aligned=true;}
      }
    });
    tiles.addEventListener('tile-visibility-change',({visible})=>{if(visible&&!loaded&&!disposed){loaded=true;onStatus('ready');}});
    tiles.addEventListener('load-error',()=>{if(!disposed&&!loaded)onStatus('error');});
    host.current?.add(tiles.group);onStatus('loading');
    return ()=>{disposed=true;tiles.group.removeFromParent();tiles.dispose();draco.dispose();ktx.dispose();materials.forEach(m=>m.dispose());renderer.current=null;gl.localClippingEnabled=previousClipping;};
  },[camera,gl,data.origin.lat,data.origin.lon,data.studyBounds,onStatus,tilesetUrl,quality,portfolio]);
  useFrame(()=>{const tiles=renderer.current;if(tiles){camera.updateMatrixWorld();tiles.setResolutionFromRenderer(camera,gl);tiles.group.updateMatrixWorld(true);tiles.update();}});
  return <group ref={host} onClick={event=>{
    if(event.delta>5)return;
    const {x,z}=event.point;
    if(onPoint){event.stopPropagation();onPoint(x,z);return;}
    const inside=(ring:number[][])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
    const hit=data.buildings.find(b=>inside(b.rings[0])&&!b.rings.slice(1).some(inside));
    if(hit){event.stopPropagation();selectRef.current(hit);}
  }}/>;
}
