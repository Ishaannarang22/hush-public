import {useEffect,useMemo,useState} from 'react';
import type {District} from './data';
import {mapTourProperties,type TourCatalog} from './tours';

export function usePropertyTours(data:District|null){
  const [catalog,setCatalog]=useState<TourCatalog|null>(null),[error,setError]=useState('');
  const [target,setTarget]=useState<{propertyId:number;modelId?:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/neighborhood/tours',{signal:controller.signal}).then(async r=>{
      const body=await r.json();if(!r.ok)throw new Error(body.error??'Tour catalog unavailable');return body;
    }).then(setCatalog).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[]);
  const properties=useMemo(()=>mapTourProperties(catalog,data),[catalog,data]);
  return {catalog,properties,error,target,open:(propertyId:number,modelId?:string)=>setTarget({propertyId,modelId}),close:()=>setTarget(null)};
}
export type PropertyTours=ReturnType<typeof usePropertyTours>;
