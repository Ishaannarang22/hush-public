import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {containMapCamera,groundCorners,frameMapCamera} from '../src/neighborhood/camera.ts';
import {STUDY_BOUNDS} from '../src/neighborhood/study.ts';
import {VIEWS} from '../src/neighborhood/data.ts';

test('pan stays inside the site without limiting overview distance or changing tilt',()=>{
  for(const aspect of [.45,1,1.8,3.4])for(const angle of [35,40,60,89.99])for(const azimuth of [0,.7,2,4]){
    const camera=new PerspectiveCamera(43,aspect,5,8000),target=new Vector3(2000,0,-2400);
    const elevation=angle*Math.PI/180;
    camera.position.copy(target).add(new Vector3(Math.sin(azimuth)*3000*Math.cos(elevation),3000*Math.sin(elevation),Math.cos(azimuth)*3000*Math.cos(elevation)));
    const offset=camera.position.clone().sub(target);
    containMapCamera(camera,target,STUDY_BOUNDS);
    assert.ok(target.x>=STUDY_BOUNDS[0]&&target.x<=STUDY_BOUNDS[2]);
    assert.ok(target.z>=STUDY_BOUNDS[1]&&target.z<=STUDY_BOUNDS[3]);
    assert.ok(camera.position.clone().sub(target).distanceTo(offset)<1e-8);
    const before=camera.position.clone();containMapCamera(camera,target,STUDY_BOUNDS);
    assert.ok(before.distanceTo(camera.position)<1e-7,'constraint should settle without jitter');
  }
});
test('each preset retains its requested tilt',()=>{
  for(const view of Object.values(VIEWS)){
    const camera=new PerspectiveCamera(43,1.8,5,8000),target=new Vector3(...view.target);
    camera.position.set(...view.position);const before=camera.position.clone().sub(target).normalize();
    containMapCamera(camera,target,STUDY_BOUNDS);
    assert.ok(camera.position.clone().sub(target).normalize().distanceTo(before)<1e-10);
  }
});


test('apartment navigation keeps the requested building in the center',()=>{
  const camera=new PerspectiveCamera(43,1.8,5,8000),target=new Vector3(...VIEWS.apartments.target),requested=target.clone();
  camera.position.set(...VIEWS.apartments.position);
  frameMapCamera(camera,target,STUDY_BOUNDS);
  assert.ok(target.distanceTo(requested)<1e-7);
  const overview=new PerspectiveCamera(43,1.8,5,15000),center=new Vector3(-260,0,660);
  overview.position.copy(center).add(new Vector3(3000,4000,3000));
  frameMapCamera(overview,center,STUDY_BOUNDS);
  assert.ok(overview.position.distanceTo(center)>5000);
  assert.ok(groundCorners(overview).some(p=>p.x<STUDY_BOUNDS[0]||p.z<STUDY_BOUNDS[1]||p.x>STUDY_BOUNDS[2]||p.z>STUDY_BOUNDS[3]));
});
