import type { GeometricAcousticSolver } from '../acoustics/engine/solver.ts';
import type { SourceData,Vec } from '../acoustics/engine/domain.ts';
import { weightedEnergy } from './simulation.ts';
/** Sum each vehicle's actual propagated band energies exactly once. The per-
 * source readout and combined room probe use this same calculation. */
export function receiverContributions(solver:GeometricAcousticSolver,probe:Vec,sources:SourceData[]){
  const total=Array(8).fill(0),bySource:Record<string,number>={};
  for(const source of sources){
    if(!source.enabled)continue;
    if(Object.hasOwn(bySource,source.id))throw new Error('Duplicate source at receiver');
    const result=solver.evaluate(probe,[source],{diffraction:true,reflections:true});
    result.total.forEach((e,b)=>{total[b]+=e;});bySource[source.id]=weightedEnergy(result.total);
  }
  return {db:weightedEnergy(total),bySource,total};
}
