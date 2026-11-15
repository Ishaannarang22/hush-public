import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { VIEWS, worldToGeographic, type Building, type District, type Layers, type ViewName } from '../neighborhood/data';
import './neighborhood.css';
import { cropStudy } from '../neighborhood/study';
import { useNoiseStudy } from '../neighborhood/useNoiseStudy';
import StudyPanel from '../neighborhood/StudyPanel';
import {usePropertyTours} from '../neighborhood/usePropertyTours';
import TourPanel from '../neighborhood/TourPanel';
import type { MeshStatus } from '../neighborhood/VexcelMesh';

const DistrictCanvas=lazy(()=>import('../neighborhood/DistrictCanvas'));
function Icon({name,size=20}:{name:string;size?:number}){
  const paths:Record<string,ReactNode>={
    layers:<><path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    building:<><path d="M4 21V4h12v17M16 10h4v11M2 21h20M8 8h4M8 12h4M8 16h4"/></>,
    road:<><path d="m6 3-3 18M18 3l3 18M12 3v3M12 10v4M12 18v3"/></>,
    home:<><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></>,
    tree:<><path d="M12 21v-6M8 17h8M7 14a4 4 0 0 1-2-7 5 5 0 0 1 10-2 5 5 0 0 1 2 9Z"/></>,
    car:<><path d="m4 10 2-6h12l2 6M3 10h18v8H3zM5 18v3M19 18v3M6 14h2M16 14h2"/></>,
    pin:<><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/></>,
    arrow:<><path d="M4 12h15m-6-6 6 6-6 6"/></>,
    export:<><path d="M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7"/></>,
    crane:<><path d="M8 21V3h3v18M4 6h17L10 3M19 6v8h-3M5 21h9"/></>,
    target:<><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    pause:<><path d="M8 5v14M16 5v14"/></>,
    play:<path d="m8 4 12 8-12 8V4Z"/>,
    plus:<path d="M12 5v14M5 12h14"/>,
    minus:<path d="M5 12h14"/>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,
    compass:<><circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 1 2-5 4-1Z"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.layers}</svg>;
}
class ViewBoundary extends Component<{children:ReactNode;onError:(message:string)=>void},{error:boolean}>{
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  componentDidCatch(){this.props.onError('A 3D asset could not load. Reload to retry, or open the apartment lab.');}
  render(){return this.state.error?null:this.props.children;}
}

export default function Neighborhood(){
  const [data,setData]=useState<District|null>(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
  const [vexcelDate,setVexcelDate]=useState('');
  const [meshStatus,setMeshStatus]=useState<MeshStatus>('loading');
  const [view,setView]=useState<ViewName>('district'),[layers,setLayers]=useState<Layers>({buildings:true,trees:true,traffic:true,sources:false});
  const [paused,setPaused]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[topDown,setTopDown]=useState(false);
  const [selected,setSelected]=useState<Building|null>(null),[focus,setFocus]=useState<Building|null>(null);
  const [zoomRequest,setZoomRequest]=useState({key:0,direction:0}),[resetKey,setResetKey]=useState(0);
  const [showSources,setShowSources]=useState(false),[mobilePanel,setMobilePanel]=useState(false);
  const compassRef=useRef<HTMLSpanElement>(null);
  const modalRef=useRef<HTMLElement>(null);
  const study=useNoiseStudy(data);
  const tours=usePropertyTours(data);
  const currentTourProperty=tours.properties.find(p=>p.tours.some(t=>t.id===study.selected));
  useEffect(()=>{
    if(!showSources)return;
    const previous=document.activeElement as HTMLElement|null;
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function keydown(event:KeyboardEvent){
      if(event.key==='Escape'){setShowSources(false);return;}
      if(event.key!=='Tab')return;
      const items=modalRef.current?.querySelectorAll<HTMLElement>('button,a[href]');if(!items?.length)return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
  },[showSources]);
  useEffect(()=>{const controller=new AbortController();fetch('/neighborhood/scene.json',{signal:controller.signal})
    .then(async r=>{if(!r.ok)throw new Error('Map data could not be loaded.');return r.json();})
    .then(async d=>{if(d.schemaVersion!==1||!Array.isArray(d.buildings)||!Array.isArray(d.roads))throw new Error('Map data has an unsupported format.');
      const response=await fetch('/api/neighborhood/vexcel/scene',{signal:controller.signal}),live=await response.json();
      if(!response.ok||!live.buildings?.length)throw new Error(live.error??'Vexcel site data unavailable.');
      setVexcelDate(live.captureDate?.slice(0,10)??'Date unavailable');
      setData(cropStudy({...d,buildings:live.buildings,imagery:live.imagery,sources:[{name:'Vexcel 3D Cities — Houston',url:'https://vexceldata.com/products/3d-cities/',license:'© Microsoft Corporation. All Rights Reserved. © Vexcel Imaging US Inc. · capture December 7–11, 2023'},{name:'Vexcel live structure + ortho APIs',url:'https://api.vexcelgroup.com/v2',license:`Sponsor API access · imagery ${live.captureDate?.slice(0,10)??'date unavailable'}`},...d.sources.filter((s:{name:string})=>s.name.startsWith('TxDOT'))],
        limitations:['Vexcel 3D Cities supplies the photographic exterior mesh (Houston, Dec 7–11, 2023). Aerial imagery and structure measurements may have different capture dates. The acoustic model still uses footprints, measured interiors and explicit material assumptions; it does not infer wall materials from the photographic mesh.','CoStar property data uses the sponsor export; live Matterport APIs supply apartment interiors.','Moving vehicle and construction levels are editable scenarios, not observed emissions.','Tree positions are imagery-derived candidates; vegetation attenuation is not modeled.','Traffic routes use the archived TxDOT Greenhouse Road segment. Highway, residential and construction sources are unavailable pending replacement geometry.']}));})
    .catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
  useEffect(()=>{const previous=document.title;document.title='Hush · Greenhouse Road neighborhood';return()=>{document.title=previous;document.body.style.cursor='auto';};},[]);
  const onReady=useCallback(()=>setReady(true),[]);
  function chooseView(next:ViewName){setView(next);setResetKey(n=>n+1);setFocus(null);setSelected(null);setMobilePanel(false);}
  function openInterior(building:Building,id:string){chooseView('apartments');setFocus({...building});setTopDown(false);study.select(id);}
  function selectBuilding(building:Building){
    const available=study.viewable.find(v=>v.building.id===building.id);
    if(available){openInterior(building,available.interiors.find(a=>a.id===study.selected)?.id??available.interiors[0].id);return;}
    const property=tours.properties.find(p=>p.buildings.some(b=>b.id===building.id));
    if(property){tours.open(property.id);return;}
    setSelected(building);study.setOpen(false);
  }
  function toggle(key:keyof Layers){setLayers(l=>({...l,[key]:!l[key]}));}
  function exportScene(){
    if(!data)return;
    const exported={schemaVersion:1,name:data.name,coordinateSystem:'local-meters-y-up',origin:data.origin,
      buildings:data.buildings,roads:data.roads,canopyCandidates:data.trees,constructionAreas:data.zones,
      sourceInputs:data.roads.filter(r=>r.kind==='motorway'||r.name==='Greenhouse Road').map(r=>({id:r.id,kind:'road',geometry:r.points.map(([x,z])=>worldToGeographic(x,z,data.origin)),vehiclesPerHour:null,spectrumDbAt1m:null,evidence:r.geometryEvidence??r.source??'Road geometry; traffic inputs unassigned'})),
      emissionScenario:study.scenario,activeSources:study.sources,renderedVehicles:study.emitters,vehicleData:study.vehicleData,acousticResults:study.result?{roomProbeLevels:study.result.levels,perVehicleContributions:study.result.contributions,calculatedSourceIds:study.result.sourceIds,selectedApartment:study.selected,scope:"Instantaneous scenario estimates from measured interior geometry; exterior shielding and vegetation attenuation excluded"}:null,provenance:data.sources,limitations:data.limitations};
    const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='hush-greenhouse-neighborhood.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const currentGeo=selected&&data?worldToGeographic(...selected.center,data.origin):null;
  const selections:[ViewName,string,string,string][]=[
    ['apartments','building','Volterra at Westlake','Our existing apartment demo'],
    ['highway','road','I‑10 / Katy Freeway','Highway and frontage roads'],
    ['homes','home','Residential streets','Houses beyond the arterial'],
  ];
  return <div className="neighborhood">
    <a className="neighborhood-skip" href="#neighborhood-controls">Skip to map controls</a>
    <header className="neighborhood-header">
      <Link to="/" className="neighborhood-brand" aria-label="Hush home"><span className="hush-mark"><i/><i/><i/><i/></span>hush<span className="brand-divider"/> <span className="brand-description">A quieter place to live.</span></Link>
      <nav aria-label="Demo views"><span className="active-view"><Icon name="layers" size={16}/>Neighborhood</span><Link to="/lab/portfolio">All properties</Link><Link to="/lab">Apartment lab <Icon name="arrow" size={16}/></Link></nav>
      <span className="header-status"><i/>Neighborhood sound study · 40°</span>
    </header>
    <section className={`neighborhood-map ${study.open?'study-open':''}`} aria-label="Interactive 3D map of Greenhouse Road, Houston">
      <div className="study-map-canvas"><ViewBoundary onError={setError}><Suspense fallback={null}>{data&&<DistrictCanvas data={data} layers={layers} view={view} onView={chooseView} selected={selected} onSelect={selectBuilding} onOpenInterior={openInterior} tourProperties={tours.properties} onOpenTours={tours.open} paused={paused} topDown={topDown} zoomRequest={zoomRequest} resetKey={resetKey} focus={focus} onReady={onReady} compassRef={compassRef} study={study} onMeshStatus={setMeshStatus}/>}</Suspense></ViewBoundary>
        {ready&&tours.properties.length>0&&<button className="viewable-map-key" onClick={()=>tours.open(tours.properties.find(p=>p.id===9160550)?.id??tours.properties[0].id)}><i/><span>{tours.properties.length} properties · {tours.properties.reduce((s,p)=>s+p.tours.length,0)} tours<small>Blue: real tours · Mint: indoor sound</small></span></button>}
      </div>
      <StudyPanel study={study} paused={paused} onPause={()=>setPaused(p=>!p)} onTour={currentTourProperty?()=>tours.open(currentTourProperty.id,study.selected):undefined}/>
      {!ready&&!error&&<div className="map-loading" role="status"><span className="loading-kicker">GREENHOUSE ROAD, HOUSTON</span><h2>Bringing the neighborhood into view.</h2><div className="map-loading-bars"><i/><i/><i/></div><p>Loading live Vexcel footprints and aerial imagery.</p></div>}
      {error&&<div className="neighborhood-error" role="alert"><h2>Map data unavailable</h2><p>{error}</p><button onClick={()=>location.reload()}>Try again</button><Link to="/lab">Open apartment lab</Link></div>}
      <button className="mobile-map-toggle" onClick={()=>setMobilePanel(!mobilePanel)} aria-expanded={mobilePanel}><Icon name="layers"/>Explore neighborhood</button>
      <aside id="neighborhood-controls" className={`neighborhood-panel ${mobilePanel?'is-open':''}`} aria-label="Neighborhood controls">
        <div className="panel-heading"><span className="eyebrow"><Icon name="pin" size={13}/> HOUSTON, TEXAS</span><h1>Greenhouse Road</h1><p>See the setting.<br/>Then step inside.</p><span className="real-map-badge"><i/>Real streets. Real building footprints.</span></div>
        <div className="district-stats"><div><strong>{data?.buildings.length.toLocaleString()??'—'}</strong><span>mapped structures</span></div><div><strong>I‑10</strong><span>highway corridor</span></div></div>
        <details className="map-tour-list" open><summary>EXPLORE REAL INTERIOR TOURS <span>{tours.properties.length||'…'}</span></summary>{tours.error?<p role="alert">{tours.error}</p>:!tours.properties.length?<p>Loading CoStar tour catalog…</p>:<div>{tours.properties.map(p=><button key={p.id} onClick={()=>tours.open(p.id)}><span><strong>{p.name}</strong><small>{p.address}</small></span><b>{p.tours.length} ↗</b></button>)}</div>}</details>
        <div className="panel-section"><div className="section-label">EXPLORE THE AREA<button onClick={()=>chooseView('district')}>View all <Icon name="arrow" size={13}/></button></div>
          <div className="place-list">{selections.map(([id,icon,label,description])=><button key={id} className={view===id?'place active':'place'} onClick={()=>chooseView(id)} aria-pressed={view===id}><span className="place-icon"><Icon name={icon}/></span><span><strong>{label}</strong><small>{description}</small></span><span className="place-chevron">›</span></button>)}</div>
        </div>
        <div className="panel-section"><div className="section-label">MAP LAYERS <Icon name="layers" size={14}/></div><div className="layer-list">
          {([['buildings','building','3D buildings'],['trees','tree','3D canopy models'],['traffic','car','Vehicle animation'],['sources','target','Source locations']] as const).filter(([id])=>id!=='trees'||meshStatus!=='ready'||topDown||!layers.buildings).map(([id,icon,label])=><button className="layer-toggle" key={id} role="switch" aria-checked={layers[id]} onClick={()=>toggle(id)}><span><Icon name={icon} size={17}/>{label}</span><i className={layers[id]?'switch on':'switch'}/></button>)}
        </div><p className="layer-caption">Moving vehicles use editable emission scenarios. Select an apartment to see the calculated indoor field.</p></div>
        <div className="lab-entry"><span className="lab-entry-label">INSIDE THE NEIGHBORHOOD</span><strong>Real tours. Indoor sound.</strong><p>Blue 360° pins open CoStar-linked tours. Mint outlines mark the layouts with indoor sound calculations.</p><button className="focus-building" onClick={()=>{study.setOpen(true);chooseView('apartments');}}>Explore indoor sound <Icon name="arrow" size={17}/></button></div>
      </aside>
      <div className="map-view-tools" aria-label="Camera tools"><div className="view-mode"><button className={!topDown?'chosen':''} onClick={()=>setTopDown(false)} aria-pressed={!topDown}>3D view</button><button className={topDown?'chosen':''} onClick={()=>setTopDown(true)} aria-pressed={topDown}>Satellite</button></div><button className="map-tool" onClick={()=>{setResetKey(n=>n+1);setFocus(null);}} aria-label="Reset camera"><Icon name="compass"/></button></div>
      <div className="map-zoom-tools"><span className="north-label">N <span ref={compassRef}>↑</span></span><button className="map-tool" aria-label="Zoom in" onClick={()=>setZoomRequest(z=>({key:z.key+1,direction:1}))}><Icon name="plus"/></button><button className="map-tool" aria-label="Zoom out" onClick={()=>setZoomRequest(z=>({key:z.key+1,direction:-1}))}><Icon name="minus"/></button><button className="map-tool" aria-label={paused?'Play vehicle animation':'Pause vehicle animation'} aria-pressed={paused} onClick={()=>setPaused(v=>!v)}><Icon name={paused?'play':'pause'}/></button></div>
      {selected&&<aside className="building-inspector" aria-label="Selected building"><div className="inspector-heading"><span className="eyebrow">SELECTED BUILDING</span><button aria-label="Close building details" onClick={()=>setSelected(null)}><Icon name="close" size={17}/></button></div><h2>{selected.name??selected.address??selected.type}</h2><p>{selected.name?'2219 Greenhouse Road, Houston':selected.type}</p><dl><div><dt>Mapped footprint</dt><dd>{Math.round(selected.area).toLocaleString()} m²</dd></div><div><dt>3D height</dt><dd>{selected.height.toFixed(1)} m <small>{selected.heightMeasured?'Vexcel roof height':'estimated'}</small></dd></div><div><dt>Source</dt><dd>{selected.source}</dd></div></dl><p className="inspector-note">{selected.heightBasis}. Acoustic geometry uses footprint and height measurements; the photographic 3D mesh is a separate visual layer.</p>{currentGeo&&<span className="coordinate-readout">{currentGeo.lat.toFixed(5)}° N · {Math.abs(currentGeo.lon).toFixed(5)}° W</span>}<button className="focus-building" onClick={()=>{setFocus({...selected});setTopDown(false);}}>Focus on building <Icon name="target" size={16}/></button>{selected.reference&&<Link className="inspector-lab-link" to="/lab">Open reference apartment <Icon name="arrow" size={15}/></Link>}</aside>}
      <div className="map-bottom-bar"><span className="scene-indicator"><i/>{VIEWS[view].label}<span className="map-only">{study.sources.length} active scenario sources</span></span><span className="map-gesture">Drag to pan <b>·</b> Point + scroll to zoom</span><button onClick={exportScene} disabled={!data} title="Download mapped geometry"><Icon name="export" size={15}/>Export scene</button></div>
      <div className="map-attribution"><span>{!topDown&&layers.buildings?(meshStatus==='ready'?'3D © Microsoft / Vexcel · Dec 7–11, 2023':meshStatus==='error'?'3D unavailable · showing approximate buildings':'Loading Vexcel 3D · showing approximate buildings'):`Aerial © Vexcel · ${vexcelDate||'loading'}`} · CoStar · Matterport · TxDOT</span><button onClick={()=>setShowSources(true)}><Icon name="info" size={12}/>Data & credits</button></div>
    </section>
    {tours.target&&<TourPanel tours={tours} study={study} onSound={id=>{tours.close();const entry=study.viewable.find(v=>v.interiors.some(a=>a.id===id));if(entry)openInterior(entry.building,id);else {study.select(id);const property=tours.properties.find(p=>p.tours.some(t=>t.id===id));if(property?.buildings[0]){chooseView('district');setFocus(property.buildings[0]);}}}}/>}
    {showSources&&<div className="map-modal-backdrop" onClick={()=>setShowSources(false)}><section ref={modalRef} className="map-credits" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={e=>e.stopPropagation()}><button className="credits-close" onClick={()=>setShowSources(false)} aria-label="Close data and credits"><Icon name="close"/></button><span className="eyebrow">THE DATA BEHIND THE VIEW</span><h2 id="credits-title">Real geography, visible assumptions.</h2><p>This is the actual Greenhouse Road and I‑10 corridor. Retrieved November 14, 2026; source imagery may be older.</p><ul>{data?.sources.map(s=><li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><span>{s.license}</span></li>)}</ul><p>Tree: Poly Haven Island Tree 02 (CC0). Car: Car Concept by Eric Chadwick / Darmstadt Graphics Group, based on Unity Fan’s model (CC BY 4.0). Truck: Cesium Milk Truck (CC BY 4.0). Models optimized for this viewer.</p><ul className="data-limitations">{data?.limitations.map(l=><li key={l}>{l}</li>)}</ul><a href="/neighborhood/assets/credits.md" target="_blank" rel="noreferrer">Full asset attribution</a></section></div>}
  </div>;
}
