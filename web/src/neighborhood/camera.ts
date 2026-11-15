import { PerspectiveCamera, Vector3 } from 'three';

export const AERIAL_ELEVATION = 40 * Math.PI / 180;
export type MapBounds = [number, number, number, number];

/** Ground footprint of the visible viewport, including the corners behind UI. */
export function groundCorners(camera: PerspectiveCamera): Vector3[] {
  camera.updateMatrixWorld();
  return [[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>{
    const direction = new Vector3(x,y,.5).unproject(camera).sub(camera.position);
    return camera.position.clone().addScaledVector(direction,-camera.position.y/direction.y);
  });
}

/** Keep navigation targets inside the usable site, leaving zoom unrestricted. */
export function frameMapCamera(camera: PerspectiveCamera, target: Vector3, bounds: MapBounds) {
  containMapCamera(camera,target,bounds);
}

/** The site is finite; the cloudy space outside it is only a visual backdrop. */
export function containMapCamera(camera: PerspectiveCamera, target: Vector3, bounds: MapBounds) {
  const clamped=new Vector3(Math.max(bounds[0],Math.min(bounds[2],target.x)),0,
    Math.max(bounds[1],Math.min(bounds[3],target.z)));
  camera.position.add(clamped.clone().sub(target));
  target.copy(clamped);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
