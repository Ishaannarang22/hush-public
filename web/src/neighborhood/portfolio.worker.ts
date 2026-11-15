import { type PortfolioProperty, type EnvironmentSource, type EnvelopeSettings, type Geo } from './portfolioModel';
import { PortfolioFieldCache, browserFieldStore } from './portfolioCache';
let cachedProperties:PortfolioProperty[]=[],cachedBaseline:PortfolioProperty[]=[];
const cache=new PortfolioFieldCache(browserFieldStore());
type Request={id:number;properties?:PortfolioProperty[];baselineProperties?:PortfolioProperty[];sources:EnvironmentSource[];baseline:EnvironmentSource[];settings:EnvelopeSettings;baselineSettings:EnvelopeSettings;origin:Geo};
let queued:Request|null=null,running=false;
self.onmessage=({data}:{data:Request})=>{
  // Capture catalog updates immediately; queued slider edits may omit arrays.
  if(data.properties)cachedProperties=data.properties;if(data.baselineProperties)cachedBaseline=data.baselineProperties;
  queued={...data,properties:cachedProperties,baselineProperties:cachedBaseline};void drain();
};
async function drain(){
  if(running)return;running=true;
  try{while(queued){const data=queued;queued=null;const start=performance.now(),before={...cache.stats};
    try{const results=await cache.calculate(data.properties!,data.sources,data.origin,data.settings),baseline=await cache.calculate(data.baselineProperties!,data.baseline,data.origin,data.baselineSettings);
      if(!queued)self.postMessage({id:data.id,results,baseline,elapsed:performance.now()-start,cache:{reused:cache.stats.memoryHits+cache.stats.diskHits-before.memoryHits-before.diskHits,computed:cache.stats.computed-before.computed,persisted:cache.stats.diskHits-before.diskHits}});
    }catch(error){if(!queued)self.postMessage({id:data.id,error:error instanceof Error?error.message:'Property calculation failed'});}
  }}finally{running=false;}
}
