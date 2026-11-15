import { AcousticScene, GeometricAcousticSolver } from '../acoustics/engine/solver';
import { AcousticGridJob, displayField } from '../acoustics/engine/grid';
import { flowLines } from '../acoustics/propagation';
import { toLocal, type Apartment } from './simulation';
import { receiverContributions } from './receivers';
import type { SourceData } from '../acoustics/engine/domain';
type Request={id:number;key:string;apartments:Apartment[];sources:SourceData[];selected:string;room:string};
let queued:Request|null=null,running=false;
async function run(){
  if(running||!queued)return;running=true;const q=queued;queued=null;
  try{
    const levels:Record<string,Record<string,number>>={},referenceLevels:Record<string,Record<string,number>>={},contributions:Record<string,Record<string,Record<string,number>>>={};let detail=null;
    for(const apartment of q.apartments){
      const solver=new GeometricAcousticSolver(new AcousticScene(apartment.scene));
      const freeField=new GeometricAcousticSolver(new AcousticScene({...apartment.scene,surfaces:[]}));
      const sources=q.sources.map(s=>({...s,position:toLocal(s.position,apartment.frame)}));
      levels[apartment.id]={};referenceLevels[apartment.id]={};contributions[apartment.id]={};
      for(const room of apartment.rooms){const r=receiverContributions(solver,room.probe,sources);levels[apartment.id][room.id]=r.db;contributions[apartment.id][room.id]=r.bySource;referenceLevels[apartment.id][room.id]=receiverContributions(freeField,room.probe,sources).db;}
      if(apartment.id!==q.selected)continue;
      const room=apartment.rooms.find(r=>r.id===q.room)??apartment.rooms.find(r=>r.name.startsWith('Bedroom'))??apartment.rooms[0];
      const paths=flowLines(solver.scene,solver.tracePaths(room.probe,sources).paths,30);
      const points=apartment.scene.regions.flatMap(r=>r.polygon),xs=points.map(p=>p.x),zs=points.map(p=>p.z);
      const minX=Math.min(...xs),minZ=Math.min(...zs),spanX=Math.max(...xs)-minX,spanZ=Math.max(...zs)-minZ;
      const job=new AcousticGridJob(solver,{bounds:{minX,minZ,spanX,spanZ},width:22,height:22,receiverHeightM:1.2,
        floorId:apartment.scene.regions[0].floorId,sources,options:{reflections:true,diffraction:true}});
      while(!job.step(2))await new Promise(resolve=>setTimeout(resolve,0));
      detail={field:displayField(job.field,'A'),paths,probe:room.probe,roomId:room.id,sources};
    }
    self.postMessage({id:q.id,key:q.key,selected:q.selected,levels,referenceLevels,contributions,sourceIds:q.sources.map(s=>s.id),detail});
  }catch(error){self.postMessage({id:q.id,key:q.key,error:error instanceof Error?error.message:'Noise calculation failed'});}
  running=false;void run();
}
self.onmessage=event=>{queued=event.data;void run();};
