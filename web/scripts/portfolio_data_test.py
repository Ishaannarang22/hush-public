import json,tempfile,unittest
from pathlib import Path
from portfolio_data import PortfolioEnricher
class PortfolioJoinTests(unittest.TestCase):
    def property(self,key='commercial:1'):
        return dict(id=key,kind='apartments' if key.startswith('commercial') else 'residential',floorAreaM2=50000,stories=None,modelIds=['abcdefghijk'],listingIds=[10])
    def test_plan_join_uses_id_and_retains_conflicts_and_all_units(self):
        p=self.property();e=PortfolioEnricher({p['id']:p})
        e.ingest('commercial-property',dict(id=1,propertyApartment=dict(models=[dict(id=7,modelName='A',minSquareFeet=1000,numUnits=2,numBeds=1,units=[dict(id=1,unitNumber='101'),dict(id=2,unitNumber='102')],attachments=[dict(attachmentType=43,videoKey='abcdefghijk',videoExternalReferenceType=36),dict(attachmentType=10,attachmentMasterId=8)])])))
        e.ingest('apartment-listing',dict(id=20,propertyId=1,apartmentModels=[dict(id=7,name='Renamed',minSquareFeet=1100,numUnits=2,numBeds=1),dict(id=8,name='A',minSquareFeet=2000,numUnits=1,numBeds=2)]))
        with tempfile.TemporaryDirectory() as d:
            result=e.finish(d);detail=json.loads((Path(d)/'commercial-1.json').read_text())
        self.assertEqual(result['matchedPlans'],1);self.assertEqual(result['listingOnlyPlans'],1);self.assertEqual(len(detail['units']),2)
        plan=detail['floorPlans'][0];self.assertEqual(plan['modelIds'],['abcdefghijk']);self.assertTrue(plan['differences']);self.assertIsNone(plan['media'][1]['url'])
        self.assertLess(p['acousticProfile']['unitAreaM2'],200);self.assertNotEqual(p['acousticProfile']['unitAreaM2'],50000)
    def test_feature_join_keeps_listing_provenance_without_acoustic_glazing_claim(self):
        p=self.property('residential:1');e=PortfolioEnricher({p['id']:p})
        e.ingest('residential-listings',dict(id=10,property=dict(bedsMin=2),resoValues=dict(structure=dict(stories=1))))
        e.ingest('residential-listing-features',dict(id=10,features=[dict(id=1,name='Double Pane Windows',source='Mls'),dict(id=2,name='Carpet Flooring',source='Mls'),dict(id=3,name='Annual Tax',doubleValue=10000)]))
        e.ingest('residential-listing-features',dict(id=999,features=[dict(id=4,name='Concrete Exterior Construction')]))
        with tempfile.TemporaryDirectory() as d: result=e.finish(d);detail=json.loads((Path(d)/'residential-1.json').read_text())
        self.assertEqual(p['stories'],1);self.assertEqual(p['acousticProfile']['glazing'],['Double Pane Windows']);self.assertEqual(p['acousticProfile']['floorMaterialPrior'],'carpet')
        self.assertEqual(len(detail['features']),2);self.assertEqual(detail['features'][0]['listingId'],10);self.assertNotIn('windowFraction',p['acousticProfile']);self.assertEqual(result['unmatchedRecords']['residential-listing-features'],1)
    def test_mixed_floor_finishes_do_not_become_wall_to_wall_carpet(self):
        p=self.property('residential:1');e=PortfolioEnricher({p['id']:p});e.ingest('residential-listing-features',dict(id=10,features=[dict(name='Carpet Flooring'),dict(name='Tile Flooring')]))
        with tempfile.TemporaryDirectory() as d:e.finish(d)
        self.assertIsNone(p['acousticProfile']['floorMaterialPrior'])
if __name__=='__main__':unittest.main()
