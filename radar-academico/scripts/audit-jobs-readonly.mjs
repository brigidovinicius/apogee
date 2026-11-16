// Reads public feeds only. No database, model transport, credentials or publication.
import { createServer } from 'vite';
import { resolve } from 'node:path';
const server=await createServer({configFile:false,envFile:false,root:process.cwd(),logLevel:'error',
  resolve:{alias:{'@':resolve('src')}},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try{
  const {jobSource}=await server.ssrLoadModule('/src/lib/ingestion/job-sources.ts');
  const {fetchPublicJobApi}=await server.ssrLoadModule('/src/lib/ingestion/job-api.ts');
  const {parseJobFeed}=await server.ssrLoadModule('/src/lib/ingestion/job-feed.ts');
  const result=[];
  for(const id of ['jobs-whippy','jobs-nortal','jobs-n8n','jobs-gitlab']){
    try{
      // This descriptor is in memory only; no stored source is activated.
      const source={...jobSource(id),active:true};
      const resource=await fetchPublicJobApi(source);
      const feed=parseJobFeed(JSON.parse(resource.body.toString('utf8')),source);
      result.push({source:id,bytes:resource.body.byteLength,listedRequisitions:feed.listedRequisitions.length,
        candidates:feed.candidates.map(c=>({title:c.title,url:c.sourcePageUrl,roleFamily:c.employment.roleFamily,
          workplace:c.employment.workplace,brazilEligibility:c.employment.brazilEligibility,status:c.opportunityStatus}))});
    }catch(e){result.push({source:id,error:e.message});process.exitCode=1;}
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),readOnly:true,paidApiCalls:0,sources:result},null,2));
}finally{await server.close();}
