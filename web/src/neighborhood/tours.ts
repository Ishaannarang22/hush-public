import { geoToWorld } from './simulation.ts';
import type { District, Building, Point2 } from './data.ts';
import { matchBuilding } from './viewableBuildings.ts';

export type PropertyTour={id:string;name:string;url:string;status?:'live'|'unverified';location?:{lat:number;lon:number}|null};
export type TourProperty={id:number;name:string;address:string;city:string;state:string;location:{lat:number;lon:number};locationSource:string;tours:PropertyTour[]};
export type TourCatalog={source:string;properties:TourProperty[];fetchedAt?:string;warning?:string};
export type MappedTourProperty=TourProperty&{position:Point2;buildings:Building[]};

export function mapTourProperties(catalog:TourCatalog|null,data:District|null):MappedTourProperty[]{
  if(!catalog||!data)return [];
  return catalog.properties.flatMap(property=>{
    const p=geoToWorld({lat:String(property.location.lat),long:String(property.location.lon)},data.origin);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!property.tours.length)return [];
    const bounds=data.studyBounds;
    if(bounds&&(p.x<bounds[0]||p.z<bounds[1]||p.x>bounds[2]||p.z>bounds[3]))return [];
    const matches=new Map<string,Building>();
    for(const tour of property.tours){
      // A property address locates a community, not every scanned building.
      // Outline only a uniquely matched, live georeferenced tour footprint.
      if(!tour.location||tour.status!=='live')continue;
      const point=geoToWorld({lat:String(tour.location.lat),long:String(tour.location.lon)},data.origin);
      const match=matchBuilding(data.buildings,[[point.x,point.z]],0);
      if(match)matches.set(match.building.id,match.building);
    }
    return [{...property,position:[p.x,p.z] as Point2,buildings:[...matches.values()]}];
  });
}
