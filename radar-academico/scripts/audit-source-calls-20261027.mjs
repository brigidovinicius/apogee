// Operator-only dry run in the builder image. No database, forms or publication.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";

if (["DATABASE_URL","DATABASE_MIGRATION_URL","DATABASE_READER_URL","DATABASE_EDITOR_URL"].some(key=>process.env[key])) {
  throw new Error("Execute a auditoria em um processo isolado, sem credenciais de banco");
}
const root=fileURLToPath(new URL("../",import.meta.url));
const server=await createServer({root,configFile:false,cacheDir:"/tmp/radar-audit-vite",
  resolve:{alias:{"@":path.join(root,"src")}},server:{middlewareMode:true,hmr:false},
  appType:"custom",optimizeDeps:{noDiscovery:true}});
const rows=[];
try {
  const {fetchOfficialResource}=await server.ssrLoadModule("/src/lib/ingestion/fetch-source.ts");
  const {parsePdf}=await server.ssrLoadModule("/src/lib/ingestion/parse-pdf.ts");
  const {CNPQ_AUDITED_CALLS,cnpqCallUrl,cnpqDocumentUrl}=await server.ssrLoadModule("/src/lib/ingestion/normalize-cnpq-audited-calls.ts");
  const {UFSC_AUDITED_CALLS}=await server.ssrLoadModule("/src/lib/ingestion/normalize-ufsc-audited-calls.ts");
  const {ICIF_ID,ICIF_URL,ICIF_DOCUMENT,IEG_ID,IEG_URL}=await server.ssrLoadModule("/src/lib/ingestion/normalize-additional-calls-20261027.ts");
  const {normalizeProgrammeCatalogue}=await server.ssrLoadModule("/src/lib/ingestion/programme-catalogue.ts");
  const {publicationIssue}=await server.ssrLoadModule("/src/lib/ingestion/publication.ts");
  const {ingestionFailureReason}=await server.ssrLoadModule("/src/lib/ingestion/failure-reason.ts");
  const calls=[...CNPQ_AUDITED_CALLS.map(call=>({id:call.id,url:cnpqCallUrl(call),supplement:cnpqDocumentUrl(call)})),
    ...UFSC_AUDITED_CALLS,{id:ICIF_ID,url:ICIF_URL,supplement:ICIF_DOCUMENT},{id:IEG_ID,url:IEG_URL,supplement:IEG_URL}];
  for(const call of calls) {
    if(process.argv.length>2&&!process.argv.slice(2).includes(call.id))continue;
    const row={sourceId:call.id,checkedAt:new Date().toISOString()};
    const urls=[call.url,call.supplement];
    const source={id:call.id,name:call.id,institutionName:call.id,institutionAcronym:"",
      sourceType:"official_reference",baseUrl:call.url,listingUrls:[call.url],extractionMode:"html",active:true,
      allowedDomains:[...new Set(urls.map(url=>new URL(url).hostname))],
      allowedPathPrefixes:call.id.startsWith("cnpq-")
        ?[new URL(call.url).pathname.replace(/[^/]+$/,"")]
        :urls.map(url=>new URL(url).pathname),
      audienceScope:["mixed"],geographicScope:[],categories:[],priority:0};
    try {
      const primary=await fetchOfficialResource(call.url,source);
      const supplemental=call.supplement===call.url?primary:await fetchOfficialResource(call.supplement,source);
      const pdf=/application\/pdf/i.test(supplemental.contentType);
      const document=pdf?await parsePdf(new Uint8Array(supplemental.body),10):null;
      if(document?.requiresManualReview)throw new Error("Evidência PDF sem texto confirmável");
      const supplement=document?document.fullText.slice(0,30_000):supplemental.body.toString("utf8");
      const candidates=normalizeProgrammeCatalogue(primary.body.toString("utf8"),supplement,source);
      row.issues=candidates.map(candidate=>publicationIssue(candidate,source));
      row.valid=candidates.length===1&&row.issues.every(issue=>issue===null);
      row.primarySha256=primary.hash;row.supplementSha256=supplemental.hash;
      row.candidates=candidates;
    } catch(error) {row.valid=false;row.reason=ingestionFailureReason(error);}
    rows.push(row);
    console.log(`AUDIT_SOURCE=${JSON.stringify({sourceId:row.sourceId,valid:row.valid,reason:row.reason})}`);
  }
  console.log(`AUDIT_RESULT=${JSON.stringify({checkedAt:new Date().toISOString(),databaseAccess:false,sources:rows})}`);
  if(!rows.length||rows.some(row=>!row.valid))process.exitCode=1;
} finally {await server.close();}
