import { wallMeasurements } from './measurements';
import type { NoiseStudy } from './useNoiseStudy';

export default function WallMeasurements({study}:{study:NoiseStudy}){
  const {apartment,result}=study;if(!apartment)return null;
  const walls=wallMeasurements(apartment.scene),selected=walls.find(w=>w.id===study.wall)??walls[0];
  function download(){
    const value={schemaVersion:1,modelId:apartment!.id,name:apartment!.name,property:apartment!.propertyContext,
      units:'meters',walls,scene:apartment!.scene,scenario:study.scenario,
      sources:study.sources,rooms:apartment!.rooms.map(room=>({...room,indoorDbA:result?.levels[apartment!.id]?.[room.id]??null,
        unobstructedDbA:result?.referenceLevels[apartment!.id]?.[room.id]??null})),
      note:'Measured scan geometry; estimated or assumed heights are flagged. Material spectra and source activity remain assumptions. Unobstructed reference uses identical sources and receivers with all apartment surfaces removed.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`hush-walls-${apartment!.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <details className="study-wall-measurements" onToggle={event=>{if(event.currentTarget.open&&!study.wall&&walls[0])study.setWall(walls[0].id);}}><summary>Wall measurements · {walls.length} segments</summary>
    <p>{apartment.rooms.length} modeled rooms · {apartment.geometry?.windows??0} windows · {apartment.geometry?.doors??0} doorways. Dimensions are in metres.</p>
    <p>CoStar: {apartment.propertyContext?.constructionMaterial??'construction unspecified'}{apartment.propertyContext?.yearBuilt?` · built ${apartment.propertyContext.yearBuilt}`:''}. Individual wall assemblies remain assumptions.</p>
    <label>Inspect wall<select aria-label="Inspect measured wall" value={selected?.id??''} onChange={e=>study.setWall(e.target.value)}>{walls.map(w=><option key={w.id} value={w.id}>{w.label} · {w.lengthM.toFixed(2)} m{w.openings.length?` · ${w.openings.length} openings`:''}</option>)}</select></label>
    {selected&&<><dl><div><dt>Length × height</dt><dd>{selected.lengthM.toFixed(2)} × {selected.heightM.toFixed(2)} m</dd></div><div><dt>Thickness</dt><dd>{(selected.thicknessM*100).toFixed(1)} cm</dd></div><div><dt>Gross wall / openings</dt><dd>{selected.areaM2.toFixed(2)} / {selected.openingAreaM2.toFixed(2)} m²</dd></div></dl>
      <label>Assumed wall assembly<select aria-label="Selected wall material" value={selected.materialId} onChange={e=>study.setWallMaterial(selected.id,e.target.value)}>{apartment.scene.materials.filter(m=>['plasterboard','concrete'].includes(m.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {selected.openings.map(o=><p key={o.id}>{o.kind==='door'?'Doorway':o.kind==='window'?'Window':'Opening'} · {o.widthM.toFixed(2)} × {o.heightM.toFixed(2)} m · sill {o.sillM.toFixed(2)} m · {o.state}</p>)}
    </>}
    {(apartment.geometry?.assumedHeights??0)>0&&<p>{apartment.geometry!.assumedHeights} room heights are missing and use the stated 2.7 m assumption. A scan cannot establish hidden or unscanned walls.</p>}
    <button className="study-wall-export" onClick={download}>Download walls + current analysis</button>
  </details>;
}
