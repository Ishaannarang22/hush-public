"""ID-based, provenance-preserving CoStar floor-plan and listing joins."""
import json, math, re
from pathlib import Path
SQFT=.09290304

def positive(v):
    return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>0

def area(v): return round(v*SQFT,3) if positive(v) else None

def media(items):
    result=[]
    for a in items or []:
        kind=a.get('attachmentType',a.get('type'))
        if kind not in (10,12,43,112,119): continue
        url=a.get('attachmentUri') or a.get('uri')
        if not isinstance(url,str) or not url.startswith('https://'): url=None
        model=a.get('videoKey') if kind==43 and a.get('videoExternalReferenceType',a.get('externalReferenceType')) in (36,234) else None
        result.append(dict(id=str(a.get('attachmentMasterId',a.get('id',''))),kind=kind,caption=a.get('caption') or ('Floor plan' if kind in (10,12) else '3D scan'),url=url,modelId=model))
    return result

class PortfolioEnricher:
    def __init__(self,properties):
        self.properties=properties
        self.details={key:dict(id=key,floorPlans=[],listings=[],features=[],media=[],units=[],facts={},sources=[]) for key in properties}
        self.by_listing={str(i):p['id'] for p in properties.values() for i in p['listingIds']}
        self.counts={};self.unmatched={};self.matches={}
    def source(self,key,dataset,record):
        self.details[key]['sources'].append(dict(dataset=dataset,recordId=record))
        self.matches[dataset]=self.matches.get(dataset,0)+1
    def plan(self,m,dataset):
        return dict(id=str(m['id']),name=m.get('modelName') or m.get('name') or str(m['id']),areaMinM2=area(m.get('minSquareFeet')),areaMaxM2=area(m.get('maxSquareFeet')),
            beds=m.get('numBeds'),baths=m.get('numBaths'),numUnits=m.get('numUnits'),unitsAvailable=m.get('numUnitsAvailable'),media=media(m.get('attachments')),sources=[dataset],match='property' if dataset=='commercial-property' else 'listing-only')
    def ingest(self,dataset,r):
        self.counts[dataset]=self.counts.get(dataset,0)+1
        if dataset=='commercial-property':
            key='commercial:'+str(r['id'])
            if key not in self.details:return
            d=self.details[key];apt=r.get('propertyApartment') or {};self.source(key,dataset,r['id'])
            d['facts'].update(numBuildings=apt.get('numBuildings'),totalUnits=apt.get('totalNumUnits'),typicalFloorAreaM2=area(r.get('grossTypicalFloorSquareFeet')))
            d['media']+=media(r.get('attachments'))
            d['floorPlans']=[self.plan(m,dataset) for m in apt.get('models',[])]
            units={}
            for m in apt.get('models',[]):
                for u in m.get('units',[]):
                    if not u.get('id'):continue
                    units[str(u['id'])]=dict(id=str(u['id']),number=u.get('unitNumber') or u.get('unitName'),floorPlanId=str(m['id']),beds=u.get('numBeds'),baths=u.get('numBaths'),areaMinM2=area(u.get('minSquareFeet')),areaMaxM2=area(u.get('maxSquareFeet')),media=media(u.get('attachments')),source=dataset)
            for u in apt.get('units',[]):
                if not u.get('id') or str(u['id']) in units:continue
                units[str(u['id'])]=dict(id=str(u['id']),number=u.get('unitNumber') or u.get('unitName'),floorPlanId=None,beds=u.get('numBeds'),baths=u.get('numBaths'),areaMinM2=area(u.get('minSquareFeet')),areaMaxM2=area(u.get('maxSquareFeet')),media=media(u.get('attachments')),source=dataset)
            d['units']=list(units.values())
        elif dataset=='apartment-listing':
            key='commercial:'+str(r.get('propertyId'))
            if key not in self.details:self.unmatched[dataset]=self.unmatched.get(dataset,0)+1;return
            d=self.details[key];self.source(key,dataset,r['id']);d['listings'].append(dict(id=r['id'],dataset=dataset,totalUnits=r.get('totalNumUnits'),unitsAvailable=r.get('numUnitsAvailable'),areaMinM2=area(r.get('minSquareFeet')),areaMaxM2=area(r.get('maxSquareFeet'))))
            plans={p['id']:p for p in d['floorPlans']}
            for m in r.get('apartmentModels',[]):
                p=self.plan(m,dataset)
                if p['id'] in plans:
                    old=plans[p['id']];old['sources'].append(dataset);old['match']='matched';old['unitsAvailable']=p['unitsAvailable']
                    for k in ('areaMinM2','areaMaxM2','beds','baths','numUnits'):
                        if old[k] is None:old[k]=p[k]
                        elif p[k] is not None and old[k]!=p[k]:old.setdefault('differences',[]).append(dict(field=k,propertyValue=old[k],listingValue=p[k]))
                else:d['floorPlans'].append(p)
        elif dataset=='residential-listings':
            key=self.by_listing.get(str(r['id']))
            if not key:return
            d=self.details[key];p=self.properties[key];self.source(key,dataset,r['id']);home=r.get('property') or {};structure=(r.get('resoValues') or {}).get('structure') or {}
            d['listings'].append(dict(id=r['id'],dataset=dataset,date=r.get('listDate'),status=r.get('listingStatus'),beds=home.get('bedsMin'),baths=home.get('bathsMin'),areaMinM2=area(home.get('sqftMin')),areaMaxM2=area(home.get('sqftMax'))))
            d['media']+=media(r.get('media'))
            for k,v in [('beds',home.get('bedsMin')),('baths',home.get('bathsMin')),('homeType',home.get('mlsPropertyType')),('unitFloor',(home.get('address') or {}).get('floorNumber'))]:
                if v is not None:d['facts'].setdefault(k,v)
            if p['stories'] is None and positive(structure.get('stories')):
                p['stories']=structure['stories'];d['facts']['storiesSource']='residential-listings.resoValues.structure.stories'
        elif dataset=='residential-listing-features':
            key=self.by_listing.get(str(r['id']))
            if not key:self.unmatched[dataset]=self.unmatched.get(dataset,0)+1;return
            self.source(key,dataset,r['id']);d=self.details[key]
            for f in r.get('features',[]):
                label=f.get('name','')
                # Keep building/room features; no schools, financials or contacts.
                if not re.search(r'window|glaz|door|insulat|floor|construction|wall|ceiling|roof|bedroom|bathroom|story|stories|square feet|heating|cooling|air|room|foundation',label,re.I):continue
                if f.get('boolValue') is False:continue
                d['features'].append(dict(id=f.get('id'),name=label,value=f.get('doubleValue',f.get('stringValue',f.get('boolValue'))),source=f.get('source','CoStar'),listingId=r['id']))
        elif dataset=='commercial-listing-summary':
            key='commercial:'+str(r.get('propertyId'))
            if key not in self.details:self.unmatched[dataset]=self.unmatched.get(dataset,0)+1;return
            self.source(key,dataset,r['id']);d=self.details[key];d['listings'].append(dict(id=r['id'],dataset=dataset,status=r.get('listingStatus'),date=r.get('certifiedFreshDate') or r.get('createdDate'),areaMinM2=area(r.get('buildingSizeSquareFeet'))));d['media']+=media(r.get('attachments'))
    def finish(self,directory):
        directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
        totals=dict(floorPlans=0,units=0,features=0,planMedia=0,linkedPlanMedia=0,propertiesWithPlans=0,propertiesWithFeatures=0,propertiesWithListings=0,matchedPlans=0,listingOnlyPlans=0,planScanLinks=0)
        for key,p in self.properties.items():
            d=self.details[key];plans=d['floorPlans'];features=d['features'];names={f['name'] for f in features}
            # Preserve descriptions and provenance. Thermal glazing claims do not
            # imply an acoustic transmission loss or an invented window area.
            floor_labels=sorted(n for n in names if 'Flooring' in n)
            glazing=sorted(n for n in names if re.search('window|glaz',n,re.I))
            envelopes=sorted(n for n in names if re.search('construction|insulat|wall|door|roof',n,re.I))
            valid=[q for q in plans if positive(q['areaMinM2'])]
            weighted=[q for q in valid if positive(q['numUnits'])]
            population=weighted or valid
            unit_area=sum(q['areaMinM2']*(q['numUnits'] if weighted else 1) for q in population)/sum(q['numUnits'] if weighted else 1 for q in population) if population else p['floorAreaM2']
            basis='unit-count-weighted floor-plan area' if weighted else 'mean floor-plan area' if valid else 'listed home area' if p['kind']=='residential' and unit_area else 'listed building area' if unit_area else 'assumed area'
            # An indicative room size, never a reconstructed room boundary.
            beds=d['facts'].get('beds')
            if beds is None and population:
                beds=sum((q['beds'] if isinstance(q['beds'],(int,float)) else 1)*(q['numUnits'] if weighted else 1) for q in population)/sum(q['numUnits'] if weighted else 1 for q in population)
            rooms=max(3,(beds if isinstance(beds,(int,float)) else 2)+2)
            room_area=max(6,min(60,(unit_area or 100)/rooms))
            floor_prior='carpet' if floor_labels and all('Carpet' in f for f in floor_labels) else 'floor' if floor_labels and all(any(t in f for t in ['Tile','Wood','Hardwood','Stone','Concrete','Marble','Laminate']) for f in floor_labels) else None
            p['dataSummary']=dict(floorPlans=len(plans),units=len(d['units']),features=len(features),listings=len(d['listings']),sourceDatasets=sorted(set(s['dataset'] for s in d['sources'])),planMedia=sum(m['kind'] in (10,12) for q in plans for m in q['media'])+sum(m['kind'] in (10,12) for m in d['media']))
            p['acousticProfile']=dict(unitAreaM2=round(unit_area,3) if unit_area else None,areaBasis=basis,roomAreaM2=round(room_area,3),roomAreaAssumed=True,beds=beds,floorMaterialPrior=floor_prior,flooring=floor_labels,glazing=glazing,envelopeFeatures=envelopes,
                note='Room dimensions and acoustic coefficients remain assumptions; listing descriptions are not tested wall/window assemblies.')
            d['profile']=p['acousticProfile']
            for q in plans:
                q['modelIds']=sorted({m['modelId'] for m in q['media'] if m.get('modelId') in p['modelIds']})
                totals['planScanLinks']+=len(q['modelIds']);totals['matchedPlans']+=q['match']=='matched';totals['listingOnlyPlans']+=q['match']=='listing-only'
            # Stable de-duplication retains evidence from each listing.
            d['media']=list({json.dumps(m,sort_keys=True):m for m in d['media']}.values())
            d['profile']['mediaNote']='Some plan attachments have an ID but no download URL in the export.'
            (directory/(key.replace(':','-')+'.json')).write_text(json.dumps(d,separators=(',',':')))
            totals['floorPlans']+=len(plans);totals['units']+=len(d['units']);totals['features']+=len(features);totals['propertiesWithPlans']+=bool(plans);totals['propertiesWithFeatures']+=bool(features);totals['propertiesWithListings']+=bool(d['listings'])
            plan_media=[m for q in plans for m in q['media'] if m['kind'] in (10,12)]+[m for m in d['media'] if m['kind'] in (10,12)]
            totals['planMedia']+=len(plan_media);totals['linkedPlanMedia']+=sum(bool(m['url']) for m in plan_media)
        return dict(datasetsRead=self.counts,recordsJoined=self.matches,unmatchedRecords=self.unmatched,**totals)
