import type { NoiseStudy } from './useNoiseStudy';
export default function VehicleControls({study}:{study:NoiseStudy}){
  const {scenario,emitters,result,apartment,vehicleData}=study;
  const roomId=result?.detail?.roomId??study.room,room=apartment?.rooms.find(r=>r.id===roomId);
  const contributions=apartment?result?.contributions?.[apartment.id]?.[roomId]:undefined;
  const active=study.sources.filter(s=>s.id.startsWith('vehicle-')).length;
  return <details className="study-vehicles"><summary>{emitters.length} vehicles · {active} sound {active===1?'source':'sources'} <span>{vehicleData?'Noise model connected':'Loading emission model…'}</span></summary>
    <p>Traffic follows the saved TxDOT Greenhouse Road segment. Highway and residential routes are not connected. Every enabled vehicle feeds the active layouts. Pause traffic, then mute or isolate one vehicle to compare its contribution.</p>
    <div className="study-fleet-counts">{([['highway','Highway'],['arterial','Greenhouse Rd'],['residential','Residential']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={`${label} vehicle count`} type="number" min="0" max="12" step="1" disabled={!study.availableRoadGroups[key]} title={study.availableRoadGroups[key]?label:'Route data unavailable'} value={study.availableRoadGroups[key]?scenario.fleet[key]:0} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=12)study.setScenario(s=>({...s,fleet:{...s.fleet,[key]:n},soloVehicle:null}));}}/></label>)}</div>
    <div className="study-vehicle-list" aria-label="Vehicle sound contributions">{emitters.map(vehicle=>{
      const enabled=scenario.traffic&&!scenario.mutedVehicles.includes(vehicle.id)&&(!scenario.soloVehicle||scenario.soloVehicle===vehicle.id),db=contributions?.[vehicle.id];
      return <div className="study-vehicle-row" key={vehicle.id}>
        <label><input type="checkbox" aria-label={`${vehicle.id} sound enabled`} checked={!scenario.mutedVehicles.includes(vehicle.id)} onChange={e=>study.setScenario(s=>({...s,soloVehicle:null,mutedVehicles:e.target.checked?s.mutedVehicles.filter(id=>id!==vehicle.id):[...s.mutedVehicles,vehicle.id]}))}/><span><b>{vehicle.kind==='truck'?'Truck':'Car'} · {vehicle.id.replace('vehicle-','')}</b><small>{vehicle.road} · {vehicle.speedKmh?.toFixed(0)} km/h</small></span></label>
        <strong>{!enabled?'Muted':db===undefined?'…':db<=-100?'Below floor':`${db.toFixed(1)} dBA`}</strong>
        <button aria-label={`Isolate ${vehicle.id}`} aria-pressed={scenario.soloVehicle===vehicle.id} onClick={()=>study.setScenario(s=>({...s,traffic:true,mutedVehicles:s.mutedVehicles.filter(id=>id!==vehicle.id),soloVehicle:s.soloVehicle===vehicle.id?null:vehicle.id}))}>{scenario.soloVehicle===vehicle.id?'All':'Only'}</button>
      </div>;
    })}</div>
    <p>Contribution at the {room?.name??'selected room'} probe. Independent sources add as energy. Counts, positions and vehicle classes are scenarios; the emission model uses each vehicle's speed and class.</p>
    <div className="study-traffic-provenance"><b>Google traffic: {vehicleData?.google.status==='live'?'connected for Greenhouse Road':vehicleData?.google.status==='unavailable'?'request unavailable':'not configured'}</b>
      <p>{vehicleData?.google.note}</p>
      {vehicleData?.google.status==='live'&&<p>Traffic-aware route-average speeds by Google Maps. Retrieved {new Date(vehicleData.fetchedAt).toLocaleTimeString()}.</p>}
      <p>Street View: {vehicleData?.google.streetView.status??'not configured'}{vehicleData?.google.streetView.date?` · imagery ${vehicleData.google.streetView.date}`:''}. No vehicle counts have been extracted from imagery.</p>
      {vehicleData&&<p>Existing data: TxDOT {vehicleData.model.archivedRoad.aadt_year} AADT {vehicleData.model.archivedRoad.aadt.toLocaleString()} on S Greenhouse Rd. Used for provenance, not as a count of cars currently on screen. Its posted-speed record is the fallback for Greenhouse Road.</p>}
    </div>
  </details>;
}
