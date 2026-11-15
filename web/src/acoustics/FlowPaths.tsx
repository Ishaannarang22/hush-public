import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PATH_COLORS, type FlowLine } from './propagation';

export default function FlowPaths({paths,scale=1}:{paths:FlowLine[];scale?:number}){
  const prepared=useMemo(()=>paths.map(path=>{
    const geometry=new THREE.BufferGeometry().setFromPoints(path.points.map(p=>new THREE.Vector3(p.x,p.y,p.z)));
    const alpha=scale>1?Math.max(.35,Math.min(.8,(path.level+20)/90)):Math.max(.16,Math.min(.65,(path.level+5)/90));
    const material=new THREE.LineBasicMaterial({color:PATH_COLORS[path.kind],transparent:true,opacity:alpha,depthWrite:false,toneMapped:false});
    const line=new THREE.Line(geometry,material);line.renderOrder=3;
    return line;
  }),[paths,scale]);
  useEffect(()=>()=>prepared.forEach(line=>{line.geometry.dispose();line.material.dispose();}),[prepared]);
  return <group>{prepared.map((line,i)=><primitive key={i} object={line}/>)}</group>;
}
