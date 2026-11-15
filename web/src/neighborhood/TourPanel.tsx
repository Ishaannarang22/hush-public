import {useEffect,useRef,useState} from 'react';
import type {PropertyTours} from './usePropertyTours';
import type {NoiseStudy} from './useNoiseStudy';
import type {BundleWindow,MpSdk} from '../acoustics/matterport';
import './tours.css';

function MatterportTour({src,title,bundled}:{src:string;title:string;bundled:boolean}){
  const frame=useRef<HTMLIFrameElement>(null),sdk=useRef<MpSdk|null>(null),disposed=useRef(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;sdk.current?.disconnect();};},[]);
  async function connect(){
    if(!bundled){setLoading(false);return;}
    try{
      const win=frame.current?.contentWindow as BundleWindow;
      if(!win?.MP_SDK)throw new Error('Viewer connection unavailable');
      const connected=await win.MP_SDK.connect(win);
      if(disposed.current){connected.disconnect();return;}
      sdk.current=connected;
      await connected.App.state.waitUntil(state=>state.phase===connected.App.Phase.PLAYING);
      if(!disposed.current)setLoading(false);
    }catch{if(!disposed.current){setLoading(false);setError('The embedded tour could not connect. Use “Open on Matterport” above to open the original tour.');}}
  }
  return <div className="property-tour-frame">{loading&&<p className="property-tour-loading" role="status">Loading the real Matterport tour…</p>}<iframe ref={frame} title={title} src={src} allow="fullscreen; xr-spatial-tracking" allowFullScreen onLoad={connect}/>{error&&<p className="property-tour-error" role="alert">{error}</p>}</div>;
}

export default function TourPanel({tours,study,onSound}:{tours:PropertyTours;study:NoiseStudy;onSound:(id:string)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[sdkKey,setSdkKey]=useState<string|null>(null);
  const property=tours.properties.find(p=>p.id===tours.target?.propertyId);
  const tour=property?.tours.find(t=>t.id===tours.target?.modelId)??property?.tours[0];
  const activeTour=useRef(tour?.id);activeTour.current=tour?.id;
  const available=Boolean(property&&tour);
  useEffect(()=>{
    if(!available)return;
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.showModal();
    return()=>{previous?.focus();};
  },[available]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/matterport/config',{signal:controller.signal}).then(r=>r.json()).then(c=>setSdkKey(c.sdkKey||''))
      .catch(e=>{if(e.name!=='AbortError')setSdkKey('');});
    return()=>controller.abort();
  },[]);
  if(!property||!tour)return null;
  const soundAvailable=study.apartments.some(a=>a.id===tour.id);
  const src=sdkKey?`/matterport-bundle/showcase.html?${new URLSearchParams({m:tour.id,applicationKey:sdkKey,play:'1',qs:'1'})}`:tour.url+'&play=1';
  async function analyze(){if(!tour)return;const id=tour.id;if(await study.loadModel(id)&&activeTour.current===id)onSound(id);}
  function choose(propertyId:number,modelId?:string){tours.open(propertyId,modelId);}
  return <dialog ref={dialog} className="property-tour-dialog" aria-labelledby="property-tour-title" onCancel={e=>{e.preventDefault();tours.close();}}>
    <header className="property-tour-header"><div><span>REAL INTERIOR TOURS · COSTAR + MATTERPORT</span><h2 id="property-tour-title">{property.name}</h2><p>{property.address}, {property.city}</p></div><button onClick={tours.close} aria-label="Close property tour">×</button></header>
    <div className="property-tour-content"><nav aria-label="Properties with tours"><span>{tours.properties.length} properties in this map</span>{tours.properties.map(p=><button key={p.id} onClick={()=>choose(p.id)} aria-pressed={p.id===property.id}><strong>{p.name}</strong><small>{p.address}</small><span>{p.tours.length} tours</span></button>)}</nav>
      <section className="property-tour-view" aria-label="Matterport tour viewer"><div className="property-tour-toolbar"><label>Choose a tour<select aria-label="Choose an interior tour" value={tour.id} onChange={e=>choose(property.id,e.target.value)}>{property.tours.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><a href={tour.url} target="_blank" rel="noreferrer">Open on Matterport ↗</a></div>
        {sdkKey===null?<div className="property-tour-frame"><p className="property-tour-loading" role="status">Preparing tour viewer…</p></div>:<MatterportTour key={tour.id} title={`${property.name} — ${tour.name}`} src={src} bundled={Boolean(sdkKey)}/>}
        <footer><span role={study.modelErrors[tour.id]?'status':undefined}>{study.modelErrors[tour.id]||(soundAvailable?'Measured interior geometry is ready for sound analysis.':'Analyze this tour using its own measured walls, openings and location.')}</span><button disabled={study.modelLoading===tour.id} onClick={analyze}>{study.modelLoading===tour.id?'Loading geometry…':soundAvailable?'View indoor sound →':'Analyze sound →'}</button></footer>
      </section>
    </div>
  </dialog>;
}
