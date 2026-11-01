import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { it,expect } from 'vitest';
import candidates from '../../references/radar-completion-20261101/access-candidates.json';
import { fetchOfficialResource } from '@/lib/ingestion/fetch-source';
import { ingestionFailureReason } from '@/lib/ingestion/failure-reason';
import { publicText } from '@/lib/ingestion/structured-events';
import type { OfficialSource } from '@/lib/ingestion/types';
const packageUrl=new URL('../../scripts/radar-completion-recovery.mjs',import.meta.url).href;
it.skipIf(!process.env.RADAR_COMPLETION_AUDIT_PATH)('rechecks pending public sources with production robots, TLS and response limits',async()=>{
  const results:Record<string,unknown>[]=[];
  const {recoveryPackage}=await import(packageUrl);
  const pkg=await recoveryPackage();
  const normalize=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ');
  for(const candidate of candidates) {
    const row:Record<string,unknown>={...candidate};
    try {
      const source:OfficialSource={id:candidate.id,name:candidate.id,institutionName:'Auditoria pública',institutionAcronym:'',sourceType:'official_reference',baseUrl:candidate.url,allowedDomains:[new URL(candidate.url).hostname],allowedPathPrefixes:['/'],listingUrls:[candidate.url],extractionMode:'reference_only',audienceScope:[],geographicScope:[],categories:[],priority:0,active:true};
      const result=await fetchOfficialResource(candidate.url,source,2*1024*1024);
      const html=result.body.toString('utf8'),$=cheerio.load(html);
      const text=normalize(publicText(html)+' '+$('title').text()+' '+$('img[alt]').toArray().map(n=>$(n).attr('alt')).join(' '));
      if(!/text\/html|application\/xhtml/i.test(result.contentType)||html.length<200||!candidate.hints.some(h=>text.includes(normalize(h))))throw Error('identity_unconfirmed');
      row.outcome='checked';row.hash=result.hash;row.bytes=result.body.byteLength;
      row.title=$('title').text().replace(/\s+/g,' ').slice(0,200);
    }catch(error){row.outcome='blocked';row.reason=error instanceof Error&&error.message==='identity_unconfirmed'?error.message:ingestionFailureReason(error);}
    results.push(row);
    await writeFile(process.env.RADAR_COMPLETION_AUDIT_PATH!,JSON.stringify({complete:false,checkedAt:new Date().toISOString(),manifestHash:pkg.manifestHash,results},null,2));
    console.log(JSON.stringify({id:row.id,url:row.url,outcome:row.outcome,reason:row.reason}));
  }
  expect(results).toHaveLength(candidates.length);
  await writeFile(process.env.RADAR_COMPLETION_AUDIT_PATH!,JSON.stringify({complete:true,checkedAt:new Date().toISOString(),manifestHash:pkg.manifestHash,results},null,2));
},1_200_000);
