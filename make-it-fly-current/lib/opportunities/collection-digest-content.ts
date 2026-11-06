import {createHash} from 'node:crypto';
import type {StudentOpportunity} from './types';

export type DigestBaseline=Record<string,string>;
// Only public, semantic changes matter. Verification timestamps alone are noise.
export function digestFingerprint(item:StudentOpportunity):string {
 const stages=item.discovery?.editions.flatMap(e=>e.stages.map(s=>({edition:e.id,id:s.id,name:s.name,kind:s.kind,start:s.start,end:s.end}))).sort((a,b)=>(a.edition+':'+a.id).localeCompare(b.edition+':'+b.id));
 return createHash('sha256').update(JSON.stringify({title:item.title,status:item.opportunityStatus,deadline:item.deadline,deadlineAt:item.deadlineAt,eventStartsAt:item.eventStartsAt,stages})).digest('hex');
}
export function digestBaseline(items:StudentOpportunity[]):DigestBaseline {
 return Object.fromEntries(items.map(i=>[i.id,digestFingerprint(i)]));
}
export function digestChanges(items:StudentOpportunity[],baseline:DigestBaseline) {
 return items.filter(i=>baseline[i.id]!==digestFingerprint(i)).map(i=>({id:i.id,title:i.title.slice(0,500),change:baseline[i.id]?'Datas ou informações atualizadas':'Novo na coleção'}));
}
