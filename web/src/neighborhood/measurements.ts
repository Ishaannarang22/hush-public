import { distance, type SceneData, type WallData } from '../acoustics/engine/domain.ts';

/** Inventory of the exact wall surfaces passed to the acoustic solver. */
export function wallMeasurements(scene:SceneData){
  return scene.surfaces.filter((s):s is WallData=>s.kind==='wall').map((wall,index)=>({
    id:wall.id,label:`Wall ${index+1}`,lengthM:distance(wall.a,wall.b),heightM:wall.heightM,
    thicknessM:wall.thicknessM,areaM2:distance(wall.a,wall.b)*wall.heightM,
    openingAreaM2:wall.openings.reduce((sum,o)=>sum+o.widthM*o.heightM,0),
    materialId:wall.materialId,evidence:wall.evidence,
    openings:wall.openings.map(o=>({id:o.id,kind:o.kind,widthM:o.widthM,heightM:o.heightM,
      sillM:o.bottomM-wall.a.y,centerM:o.centerM,state:o.state,evidence:o.evidence})),
  }));
}
