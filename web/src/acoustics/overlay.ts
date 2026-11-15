import type * as Three from "three";
import type { FieldResult, Point } from "./field";
import type { DemoSource } from "./demo";
import type { MpSdk, SceneComponent } from "./matterport";
import { sourceDragHandles } from "./source-drag";
export type OverlayState = {
  field: FieldResult | null;
  polygons: Point[][];
  floor: number;
  flipZ: number;
  opacity: number;
  grid: boolean;
  visible: boolean;
  sources: DemoSource[];
};
export async function createOverlay(
  sdk: MpSdk,
  state: () => OverlayState,
  handles: HTMLElement,
  onMove: (id: string, point: Point) => void,
) {
  const name = `hush.floor.${Math.random().toString(36).slice(2)}`;
  let group: Three.Group,
    markers: Three.Group,
    mesh: Three.Mesh | undefined,
    texture: Three.DataTexture | undefined,
    material: Three.ShaderMaterial | undefined;
  let lastField: FieldResult | null = null,
    lastSources: DemoSource[] | null = null;
  let dragging: ReturnType<typeof sourceDragHandles> | undefined;
  function clearMarkers() {
    markers?.traverse((obj) => {
      const m = obj as Three.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const materials = Array.isArray(m.material) ? m.material : [m.material];
        materials.forEach((mat) => {
          (mat as Three.SpriteMaterial).map?.dispose();
          mat.dispose();
        });
      }
    });
    markers?.clear();
  }
  const registration = await sdk.Scene.register(name, () => ({
    outputs: {},
    context: undefined as unknown as SceneComponent["context"],
    onInit() {
      group = new this.context.three.Group();
      markers = new this.context.three.Group();
      group.add(markers);
      this.outputs.objectRoot = group;
      dragging = sourceDragHandles(this.context, state, handles, onMove);
    },
    onTick() {
      const s = state(),
        THREE = this.context.three;
      group.visible = s.visible;
      group.position.y = s.floor + 0.05;
      group.scale.z = s.flipZ;
      dragging?.tick();
      if (s.field !== lastField) {
        lastField = s.field;
        if (mesh) {
          group.remove(mesh);
          mesh.geometry.dispose();
          material?.dispose();
          texture?.dispose();
          mesh = undefined;
        }
        if (s.field && s.polygons.length) {
          const f = s.field,
            shapes = s.polygons.map(
              (poly) =>
                new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.z))),
            );
          const geometry = new THREE.ShapeGeometry(shapes),
            positions = geometry.getAttribute("position"),
            uv = geometry.getAttribute("uv");
          for (let i = 0; i < positions.count; i++)
            uv.setXY(
              i,
              (positions.getX(i) - f.minX) / f.spanX,
              (positions.getY(i) - f.minZ) / f.spanZ,
            );
          geometry.rotateX(Math.PI / 2);
          const pixels = new Float32Array(f.width * f.height * 4);
          for (let i = 0; i < f.db.length; i++) {
            pixels[i * 4] = f.db[i];
            pixels[i * 4 + 3] = f.mask[i];
          }
          texture = new THREE.DataTexture(
            pixels,
            f.width,
            f.height,
            THREE.RGBAFormat,
            THREE.FloatType,
          );
          texture.needsUpdate = true;
          material = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
              field: { value: texture },
              opacity: { value: s.opacity },
              grid: { value: s.grid ? 1 : 0 },
              origin: { value: new THREE.Vector2(f.minX, f.minZ) },
              span: { value: new THREE.Vector2(f.spanX, f.spanZ) },
            },
            vertexShader:
              "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
            fragmentShader: `precision highp float;varying vec2 vUv;uniform sampler2D field;uniform float opacity,grid;uniform vec2 origin,span;
       vec3 ramp(float t){vec3 a=vec3(.07,.22,.65),b=vec3(.0,.72,.65),c=vec3(1.,.69,.14),d=vec3(.96,.18,.14);return t<.333?mix(a,b,t*3.):t<.667?mix(b,c,(t-.333)*3.):mix(c,d,(t-.667)*3.);}
       void main(){vec4 s=texture2D(field,vUv);if(s.a<.5)discard;vec3 color=ramp(clamp((s.r-20.)/60.,0.,1.));vec2 world=origin+vUv*span;vec2 cell=abs(fract(world*2.-.5)-.5)/max(fwidth(world*2.),vec2(.0001));float line=1.-min(min(cell.x,cell.y),1.);color=mix(color,min(color+vec3(.2),vec3(1.)),line*grid*.7);gl_FragColor=vec4(color,opacity);}`,
          });
          mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = 2;
          group.add(mesh);
        }
      }
      if (material) {
        material.uniforms.opacity.value = s.opacity;
        material.uniforms.grid.value = s.grid ? 1 : 0;
      }
      if (s.sources !== lastSources) {
        lastSources = s.sources;
        clearMarkers();
        for (const source of s.sources) {
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 12, 8),
            new THREE.MeshBasicMaterial({
              color: source.color,
              transparent: true,
              opacity: source.enabled ? 1 : 0.25,
            }),
          );
          marker.position.set(source.x, 0.15, source.z);
          markers.add(marker);
          for (const radius of [1, 2, 3]) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(radius - 0.015, radius + 0.015, 64),
              new THREE.MeshBasicMaterial({
                color: source.color,
                transparent: true,
                opacity: source.enabled ? 0.25 : 0.05,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(source.x, 0.01, source.z);
            markers.add(ring);
          }
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 128;
          const c = canvas.getContext("2d")!;
          c.fillStyle = "#101719dd";
          c.fillRect(0, 0, 512, 128);
          c.textAlign = "center";
          c.fillStyle = source.color;
          c.font = "bold 34px system-ui";
          c.fillText(source.name, 256, 50);
          c.fillStyle = "#ffffff";
          c.font = "26px system-ui";
          c.fillText(
            source.enabled ? `${source.level.toFixed(1)} dB at 1 m` : "Muted",
            256,
            92,
          );
          const map = new THREE.CanvasTexture(canvas),
            sprite = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map,
                depthTest: false,
                transparent: true,
              }),
            );
          sprite.position.set(source.x, 0.65, source.z);
          sprite.scale.set(2.4, 0.6, 1);
          markers.add(sprite);
        }
      }
    },
    onDestroy() {
      dragging?.dispose();
      mesh?.geometry.dispose();
      material?.dispose();
      texture?.dispose();
      clearMarkers();
    },
  }));
  const [object] = await sdk.Scene.createObjects(1);
  object.addNode().addComponent(name);
  object.start();
  return () => {
    object.stop();
    registration?.dispose();
  };
}
