"""Prepare a private, minimal full CoStar property catalog; no contact/price data.
Usage: python3 web/scripts/prepare-portfolio.py --kit work/costar-hackathon-kit.zip
Set COSTAR_KIT_PASSWORD for encrypted ZIPs. Output stays in ignored work/.
"""
import argparse, csv, io, json, math, os, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def build(kit, password=None, details_directory=None):
    z = zipfile.ZipFile(kit)
    if password: z.setpassword(password.encode())
    def file(suffix):
        name = next(n for n in z.namelist() if n.endswith('/'+suffix) or n == suffix)
        return io.TextIOWrapper(z.open(name), encoding='utf-8-sig')
    def models(filename, key):
        result = {}
        with file(filename) as f:
            for row in csv.DictReader(f):
                if row.get('MatterportModelId'):
                    result.setdefault(str(row[key]), set()).add(row['MatterportModelId'])
        return result
    cm = models('commercial-properties.csv','PropertyId')
    rm = models('residential-listings.csv','ListingId')
    properties = {}; missing = 0; records = 0
    material_names = [None,'Masonry','Metal','Reinforced concrete','Steel','Wood frame','Brownstone','Limestone']
    for dataset in ('commercial-property','residential-listings'):
        with file(dataset+'.jsonl') as f:
            for line in f:
                r = json.loads(line); records += 1
                residential = dataset == 'residential-listings'
                p = r.get('property',{}) if residential else r
                a = p.get('address',{}) if residential else r.get('primaryAddress',{})
                lat, lon = a.get('latitude'), a.get('longitude')
                if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not math.isfinite(lat+lon) or not(-85<lat<85 and -180<lon<180) or (lat==0 and lon==0):
                    missing += 1; continue
                identity = r.get('propertyId') or r['id'] if residential else r['id']
                key = ('residential:' if residential else 'commercial:') + str(identity)
                address = a.get('fullStreetAddress') or ' '.join(str(a[k]) for k in ('streetNumber','streetName','streetType') if a.get(k))
                unit = a.get('unitNumber')
                if unit and not address.lower().endswith(str(unit).lower()): address += f' · Unit {unit}'
                tours = sorted((rm if residential else cm).get(str(r['id']),set()))
                if key in properties:
                    properties[key]['modelIds'] = sorted(set(properties[key]['modelIds']) | set(tours))
                    properties[key]['listingIds'].append(r['id']); continue
                area = p.get('sqftMin') if residential else r.get('grossBuildingAreaSquareFeet') or r.get('rentableBuildingAreaSquareFeet')
                stories = p.get('stories') if residential else r.get('numStoriesAboveGrade')
                material = r.get('buildingConstructionMaterial',0) if not residential else 0
                properties[key] = dict(id=key, propertyId=identity, listingIds=[r['id']] if residential else [],
                    kind='residential' if residential else ('apartments' if r.get('propertyType')==11 else 'commercial'),
                    name=r.get('buildingName') or address, address=address, city=a.get('city',''), state=a.get('state',''),
                    lat=lat, lon=lon, modelIds=tours, floorAreaM2=round(area*.09290304,2) if isinstance(area,(int,float)) and area>0 else None,
                    stories=stories if isinstance(stories,(int,float)) and stories>0 else None,
                    constructionMaterial=material_names[material] if isinstance(material,int) and 0<=material<len(material_names) else None,
                    yearBuilt=p.get('yearBuilt') if residential else next((e.get('year') for e in r.get('constructionEvents',[]) if e.get('eventType')==2),None))
    from portfolio_data import PortfolioEnricher
    enricher=PortfolioEnricher(properties)
    for dataset in ('commercial-property','apartment-listing','residential-listings','residential-listing-features','commercial-listing-summary'):
        with file(dataset+'.jsonl') as f:
            for line in f: enricher.ingest(dataset,json.loads(line))
    enrichment=enricher.finish(details_directory or ROOT/'work/neighborhood/property-data')
    return dict(enrichment=enrichment,schemaVersion=1,source='CoStar sponsor export',properties=list(properties.values()),
        counts=dict(sourceRecords=records,properties=len(properties),missingCoordinates=missing,residential=sum(p['kind']=='residential' for p in properties.values()),
                    models=len({m for p in properties.values() for m in p['modelIds']})),
        limitations=['Residential listings deduplicated by CoStar property ID; commercial communities may contain multiple physical buildings.',
            'Model shapes are illustrative massing at recorded property locations, not measured footprints.',
            'Floor area is total listed floor area, not a measured footprint. Orientation, storey height and unknown story counts are assumptions.',
            'Tour IDs do not establish the availability or completeness of measured wall geometry.'])
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--kit',type=Path,required=True);parser.add_argument('--output',type=Path,default=ROOT/'work/neighborhood/portfolio.json');args=parser.parse_args()
    result=build(args.kit,os.environ.get('COSTAR_KIT_PASSWORD'),args.output.parent/'property-data');args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,separators=(',',':')));print(json.dumps({'counts':result['counts'],'enrichment':result['enrichment']}))
