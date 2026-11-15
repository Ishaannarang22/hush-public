import { lazy, Suspense } from 'react';
import type { NoiseStudy } from './useNoiseStudy';
import './study.css';
import VehicleControls from './VehicleControls';
import WallMeasurements from './WallMeasurements';
const ApartmentView=lazy(()=>import('./ApartmentView'));
export default function StudyPanel({study,paused,onPause,onTour,externalEnvironment=false}:{study:NoiseStudy;paused:boolean;onPause:()=>void;onTour?:()=>void;externalEnvironment?:boolean}){
  const {apartment,result,scenario}=study;
  return <aside className={`noise-study ${study.open?'expanded':''}`} aria-label="Neighborhood sound simulation">
    <div className="noise-study-heading"><div><span className="eyebrow">ROAD → FACADE → ROOM</span><h2>Follow the sound.</h2></div><button onClick={()=>study.setOpen(!study.open)} aria-label={study.open?'Collapse sound study':'Expand sound study'}>{study.open?'−':'+'}</button></div>
    {study.open&&<>
      <div className="study-providers"><span><i/>Matterport {study.properties?.providers.matterport.mode==='cache'?'measurement cache':'API'}</span><span>CoStar properties</span><button onClick={study.refresh} disabled={study.loading} aria-label="Refresh live apartment data">↻</button></div>
      {study.loading&&<p role="status" className="study-message">Fetching apartments from the live Model API…</p>}
      {study.error&&<p role="alert" className="study-message">{study.error}</p>}
      <label className="study-model-picker">Sound model<select aria-label="Select sound model" value={study.selected} onChange={e=>study.select(e.target.value)}>{study.apartments.map(a=><option key={a.id} value={a.id}>{a.propertyName??a.address} · {a.name}</option>)}</select></label>

      {study.floorOptions.length>1&&<label className="study-model-picker">Measured floor<select aria-label="Measured floor" value={study.floorId} onChange={e=>study.setFloor(e.target.value)}>{study.floorOptions.map(f=><option key={f.id} value={f.id} disabled={f.status==='invalid'||f.status==='missing'}>{f.label}{f.status==='invalid'||f.status==='missing'?' · geometry unavailable':''}</option>)}</select></label>}
      {onTour&&<button className="study-open-tour" onClick={onTour}>Walk through this apartment <span>360° ↗</span></button>}
      {!externalEnvironment&&<><div className="study-emissions"><label><input type="checkbox" checked={scenario.traffic} onChange={e=>study.setScenario(s=>({...s,traffic:e.target.checked}))}/>Moving traffic</label><label><input type="checkbox" disabled={!study.constructionAvailable} checked={study.constructionAvailable&&scenario.construction} onChange={e=>study.setScenario(s=>({...s,construction:e.target.checked}))}/>{study.constructionAvailable?'Construction site':'Construction · no site data'}</label><button onClick={onPause}>{paused?'Play':'Pause'}</button></div>
      <VehicleControls study={study}/></>}
      {externalEnvironment&&<p className="study-message">Using the sources placed on the property map. This scan’s measured geometry drives the detailed result; map colors remain envelope estimates.</p>}
      {apartment&&<><div className="apartment-cutaway" aria-label="Live apartment geometry with calculated sound paths"><Suspense fallback={<p>Loading interior view…</p>}><ApartmentView apartment={apartment} field={result?.detail?.field??null} paths={result?.detail?.paths??[]} levels={result?.levels[apartment.id]??{}} roomId={result?.detail?.roomId??study.room} onRoom={study.setRoom} wallId={study.wall}/></Suspense></div>
        <div className="study-slice-caption"><span>Measured layout · walls cut at 1.05 m</span><span>{study.busy?'Updating…':'Calculated'}</span></div>
        <div className="study-heat-legend"><span>≤20</span><i/><span>80 dBA</span></div>
        <div className="study-path-legend"><span><i className="direct"/>Transmission</span><span><i className="reflection"/>Reflection</span><span><i className="diffraction"/>Diffraction</span></div>
        <div className="study-room-list">{apartment.rooms.filter(r=>!r.name.startsWith('Other')&&!r.name.startsWith('Closet')).map(r=>{
          const db=result?.levels[apartment.id]?.[r.id],reference=result?.referenceLevels[apartment.id]?.[r.id],delta=db!==undefined&&reference!==undefined?reference-db:null;
          return <button key={r.id} aria-pressed={r.id===(result?.detail?.roomId??study.room)} onClick={()=>study.setRoom(r.id)}><span>{r.name}{db!==undefined&&db>-100&&delta!==null&&<small className="study-room-reduction">{Math.abs(delta).toFixed(1)} dB {delta>=0?'lower':'higher'} than unobstructed</small>}</span><strong>{db!==undefined&&db>-100?db.toFixed(1):'—'}<small> dBA</small></strong></button>;
        })}</div>
        {(apartment.geometry?.windows??0)>0&&<label className="study-window"><input type="checkbox" checked={scenario.windowsOpen} onChange={e=>study.setScenario(s=>({...s,windowsOpen:e.target.checked}))}/>{apartment.id==='zzvymDx5ty7'?'Open surveyed window + sliding glass door':'Open measured windows'}</label>}
        <label className="study-window"><input type="checkbox" checked={scenario.doorsOpen} onChange={e=>study.setScenario(s=>({...s,doorsOpen:e.target.checked}))}/>Open doors · scenario assumption</label>
        <WallMeasurements study={study}/>
      </>}
      <p className="study-explanation">Select a room to follow its strongest sound paths. The unobstructed comparison uses the same sources and receiver with apartment walls, floors and ceilings removed. Values are point estimates at 1.2 m listening height.</p>
      <details className="study-assumptions"><summary>Source levels & data limits</summary>
        {!externalEnvironment&&<><label>Vehicle model adjustment: {scenario.trafficOffsetDb>0?'+':''}{scenario.trafficOffsetDb} dB<input aria-label="Vehicle emission adjustment" type="range" min="-15" max="15" value={scenario.trafficOffsetDb} onChange={e=>study.setScenario(s=>({...s,trafficOffsetDb:+e.target.value}))}/></label>
        <label>Construction: {scenario.constructionDb} dBA at 1 m<input disabled={!study.constructionAvailable} aria-label="Construction emission level" type="range" min="65" max="110" value={scenario.constructionDb} onChange={e=>study.setScenario(s=>({...s,constructionDb:+e.target.value}))}/></label>
        <p>Vehicles use the existing noise model's FHWA TNM class/speed emissions, converted from the 15 m pass-by reference to individual point sources. Octave shapes and animated counts/positions remain assumptions. These instantaneous estimates are separate from the lab's hourly road and room averages; neither is added twice.</p></>}
        {apartment?.warnings?.map((warning,i)=><p key={i}>{warning}</p>)}
        <p>Materials are assumed assemblies; CoStar's masonry classification does not identify every wall.</p>
        <p>Only the Volterra 664 ft² unit has a separate measured glazing survey. Other layouts use openings supplied by their own Model API. Ground floor and scan georeferences are provisional. Surrounding-building shielding and tree attenuation are not included.</p>
        {study.viewable.flatMap(v=>v.interiors).filter(a=>a.approximate).map(a=><p key={a.id}>{a.name.split(',')[0]} map highlight: approximate building association. Room locations lie up to {a.maxOffsetM.toFixed(1)} m outside the nearest Vexcel footprint; the scan has not been moved.</p>)}
        <p>Up to three layouts calculate at once. Additional tours can be analyzed from their tour panel when measured room boundaries and georeferencing are available.</p>
        <p>CoStar records come from the provided export. A live CoStar endpoint is not configured. Live interior fetch: {study.properties?new Date(study.properties.fetchedAt).toLocaleTimeString(): 'pending'}.</p>
      </details>
      {study.properties?.units.find(u=>u.modelId===study.selected)?.photos[0]&&<details className="study-assumptions"><summary>CoStar exterior photo</summary><img className="study-property-photo" alt="Actual exterior of Volterra at West Lake, supplied by CoStar" src={study.properties.units.find(u=>u.modelId===study.selected)!.photos[0].url}/></details>}
    </>}
  </aside>;
}
