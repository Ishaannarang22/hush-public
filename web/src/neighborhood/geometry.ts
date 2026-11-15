import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building, Imagery, Point2 } from './data';

export function shapeOf(rings: Point2[][]) {
  const shape = new THREE.Shape(rings[0].map(([x,z]) => new THREE.Vector2(x,-z)));
  rings.slice(1).forEach(r => shape.holes.push(new THREE.Path(r.map(([x,z]) => new THREE.Vector2(x,-z)))));
  return shape;
}
export function merge(parts: THREE.BufferGeometry[]) {
  if (!parts.length) return new THREE.BufferGeometry();
  const result = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g), false)!;
  parts.forEach(g => g.dispose());
  return result;
}

type Bounds = Imagery['bounds'];

function subtractRectangle(bounds: Bounds, cut: Bounds): Bounds[] {
  const [x0,z0,x1,z1]=bounds;
  const left=Math.max(x0,cut[0]),top=Math.max(z0,cut[1]);
  const right=Math.min(x1,cut[2]),bottom=Math.min(z1,cut[3]);
  if(left>=right||top>=bottom)return [bounds];
  return [
    [x0,z0,x1,top], [x0,bottom,x1,z1],
    [x0,top,left,bottom], [right,top,x1,bottom],
  ].filter(([a,b,c,d])=>c>a&&d>b) as Bounds[];
}

// Each ground location belongs to exactly one imagery mesh. Stacking entire
// atlases a few centimetres apart loses depth precision at district distances.
export function terrainGeometries(imagery: Imagery[], clip?:Bounds) {
  const resolution=(im:Imagery)=>im.width*im.height/((im.bounds[2]-im.bounds[0])*(im.bounds[3]-im.bounds[1]));
  return imagery.map((im,index)=>{
    const bounds:Bounds=clip?[Math.max(im.bounds[0],clip[0]),Math.max(im.bounds[1],clip[1]),Math.min(im.bounds[2],clip[2]),Math.min(im.bounds[3],clip[3])]:im.bounds;
    let patches:Bounds[]=bounds[2]>bounds[0]&&bounds[3]>bounds[1]?[bounds]:[];
    imagery.forEach((other,j)=>{
      if(resolution(other)>resolution(im)||(resolution(other)===resolution(im)&&j>index)){
        patches=patches.flatMap(p=>subtractRectangle(p,other.bounds));
      }
    });
    const positions:number[]=[],uvs:number[]=[];
    const [x0,z0,x1,z1]=im.bounds;
    for(const [left,top,right,bottom] of patches){
      for(const [x,z] of [[left,top],[left,bottom],[right,top],[right,top],[left,bottom],[right,bottom]]){
        positions.push(x,0,z);uvs.push((x-x0)/(x1-x0),1-(z-z0)/(z1-z0));
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    return geometry;
  });
}
export function roofGeometry(building: Building, imagery: Imagery) {
  const shape = shapeOf(building.rings);
  const pitched = building.type.includes('Single') || Boolean(building.name);
  // Roof silhouette is a visual estimate, separate from the mapped footprint.
  const roof = new THREE.ExtrudeGeometry(shape, {depth: .05, bevelEnabled: pitched,
    bevelThickness: pitched ? 1.8 : 0, bevelSize: 2.4, bevelOffset: -2.4, bevelSegments: 1, steps: 1});
  roof.rotateX(-Math.PI/2).translate(0,building.height,0);
  const pos=roof.getAttribute('position'), uv=roof.getAttribute('uv');
  const [x0,z0,x1,z1]=imagery.bounds;
  for(let i=0;i<pos.count;i++) uv.setXY(i,(pos.getX(i)-x0)/(x1-x0),1-(pos.getZ(i)-z0)/(z1-z0));
  return roof;
}
export function buildingGeometry(buildings: Building[]) {
  const positions:number[]=[], uvs:number[]=[], windowPositions:number[]=[], windowUvs:number[]=[], framePositions:number[]=[], frameUvs:number[]=[];
  function quad(target:number[], tex:number[], a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,w=1,h=1){
    [a,b,d,b,c,d].forEach(v=>target.push(v.x,v.y,v.z));tex.push(0,0,w,0,0,h,w,0,w,h,0,h);
  }
  for(const building of buildings){
    const height=building.height;
    for(const ring of building.rings){
      for(let i=0;i<ring.length;i++){
        const p=ring[i],q=ring[(i+1)%ring.length];
        const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<.1)continue;
        const a=new THREE.Vector3(p[0],0,p[1]),b=new THREE.Vector3(q[0],0,q[1]);
        quad(positions,uvs,a,b,b.clone().setY(height),a.clone().setY(height),len/4,height/4);
        if(building.area<70 || len<3.5)continue;
        const floors=Math.max(1,Math.round(height/3.2));
        const count=Math.floor(len/3.8),nx=-dz/len,nz=dx/len;
        for(let floor=0;floor<floors;floor++)for(let n=0;n<count;n++){
          const along=(n+.5)*len/count;
          const cx=p[0]+dx/len*along,cz=p[1]+dz/len*along,cy=floor*height/floors+1.7;
          const w=1.25,h=1.45;
          // Both faces are offset slightly from their wall to remain visible for
          // either source winding. These details are visual, not acoustic openings.
          for(const side of [-1,1]){
            const center=new THREE.Vector3(cx+nx*.04*side,cy,cz+nz*.04*side);
            const left=new THREE.Vector3(dx/len*w/2,0,dz/len*w/2);
            const up=new THREE.Vector3(0,h/2,0);
            const corners=[center.clone().sub(left).sub(up),center.clone().add(left).sub(up),center.clone().add(left).add(up),center.clone().sub(left).add(up)];
            quad(framePositions,frameUvs,...corners as [THREE.Vector3,THREE.Vector3,THREE.Vector3,THREE.Vector3]);
            left.multiplyScalar(.84);up.multiplyScalar(.86);center.x+=nx*.025*side;center.z+=nz*.025*side;
            quad(windowPositions,windowUvs,center.clone().sub(left).sub(up),center.clone().add(left).sub(up),center.clone().add(left).add(up),center.clone().sub(left).add(up));
          }
        }
      }
    }
  }
  const make=(p:number[],uv:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;};
  return {walls:make(positions,uvs),windows:make(windowPositions,windowUvs),frames:make(framePositions,frameUvs)};
}

export function ribbon(points:Point2[], width:number, height=.13) {
  const p:number[]=[],uv:number[]=[];let along=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(!l)continue;
    const ox=-dz/l*width/2,oz=dx/l*width/2;
    const verts=[[a[0]+ox,height,a[1]+oz],[b[0]+ox,height,b[1]+oz],[a[0]-ox,height,a[1]-oz],
      [b[0]+ox,height,b[1]+oz],[b[0]-ox,height,b[1]-oz],[a[0]-ox,height,a[1]-oz]];
    verts.forEach(v=>p.push(...v));uv.push(0,along/5,0,(along+l)/5,width/5,along/5,0,(along+l)/5,width/5,(along+l)/5,width/5,along/5);along+=l;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
}
