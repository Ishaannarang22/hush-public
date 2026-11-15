import { useMemo } from 'react';
import { Vector4 } from 'three';
import type { MapBounds } from './camera';

/** Decorative mist only: it has no picking, source, or construction geometry. */
export default function CloudBoundary({bounds}:{bounds:MapBounds}){
  const uniforms=useMemo(()=>({limits:{value:new Vector4(...bounds)}}),[bounds]);
  return <mesh position={[(bounds[0]+bounds[2])/2,1,(bounds[1]+bounds[3])/2]} rotation={[-Math.PI/2,0,0]} renderOrder={20} raycast={()=>{}}>
    <planeGeometry args={[bounds[2]-bounds[0]+2400,bounds[3]-bounds[1]+2400]}/>
    <shaderMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} uniforms={uniforms}
      vertexShader={`varying vec2 worldXZ;void main(){vec4 world=modelMatrix*vec4(position,1.0);worldXZ=world.xz;gl_Position=projectionMatrix*viewMatrix*world;}`}
      fragmentShader={`
        varying vec2 worldXZ;uniform vec4 limits;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float cloud(vec2 p){float n=0.0,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+17.2;a*=.5;}return n;}
        void main(){
          float edge=min(min(worldXZ.x-limits.x,limits.z-worldXZ.x),min(worldXZ.y-limits.y,limits.w-worldXZ.y));
          float n=cloud(worldXZ*.015);
          float reach=55.0+100.0*n;
          float opacity=1.0-smoothstep(0.0,reach,edge);
          float halo=(1.0-smoothstep(0.0,350.0,abs(edge)))*(.5+.5*n);
          vec3 white=vec3(1.0)-vec3(.028,.023,.016)*halo;
          gl_FragColor=vec4(white,opacity);
        }`}/>
  </mesh>;
}
