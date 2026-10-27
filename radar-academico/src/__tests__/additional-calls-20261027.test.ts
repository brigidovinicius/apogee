import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { ICIF_ID,ICIF_URL,ICIF_DOCUMENT,IEG_ID,IEG_URL,normalizeAdditionalCall } from "@/lib/ingestion/normalize-additional-calls-20261027";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const now=new Date("2026-10-27T12:00:00Z");
const icif=`<div class="cps-texto-conteudo"><h1>8º Concurso de Gastronomia</h1><p>Para docentes das Etecs e Fatecs com contrato por prazo indeterminado.
Inscrições de 9 de outubro a 2 de novembro de 2026, até as 23h59. Bolsa de 12 semanas. Etapa em 24 de novembro de 2026.</p></div>`;
const document="EDITAL ARI nº 44/2026. Ser contratado por prazo indeterminado. Encerramento das inscrições 23h59min do dia 02/11/2026. transporte (incluindo passagem aérea), de inteira responsabilidade do candidato contemplado.";
const ieg=`<article>Encontro de Pesquisas em Raça, Gênero e Enfrentamento às Violências. 23 e 24 de novembro, 2026-11-23. Custo Grátis.
pesquisas em andamento e concluídas na pós-graduação da UFSC. O prazo para envio de trabalhos para participar da atividade é até 13 de novembro através deste formulário.</article>`;
function source(id:string):OfficialSource {
  const url=id===ICIF_ID?ICIF_URL:IEG_URL;
  return {id,baseUrl:url,listingUrls:[url],active:true,extractionMode:"html",allowedDomains:[new URL(url).hostname,new URL(ICIF_DOCUMENT).hostname],allowedPathPrefixes:["/"]} as OfficialSource;
}
it("publishes one ICIF competition while preserving its restricted audience and travel costs",()=>{
  const s=source(ICIF_ID),item=normalizeAdditionalCall(icif,document,s,now)[0];
  expect(item).toMatchObject({applicantType:"professor",deadlineAt:"2026-11-02",countryCode:null,stateCode:null,cityName:null});
  expect(publicationIssue(item,s,now)).toBeNull();
  expect(item.amountText).toContain("são do contemplado");
  expect(item.evidenceJson.deadline_at.excerpt).toContain("02/11/2026");
  expect(()=>normalizeAdditionalCall(icif,"",s,now)).toThrow();
});
it("publishes an IEG submission call with submission deadline distinct from event dates",()=>{
  const s=source(IEG_ID),item=normalizeAdditionalCall(ieg,"",s,now)[0];
  expect(item).toMatchObject({deadlineAt:"2026-11-13",eventStartsAt:"2026-11-23",categories:["pesquisa","eventos"]});
  expect(item.title).toContain("Submissão");
  expect(item.requirementsText).toContain("prazo desta ficha é para envio de trabalhos");
  expect(publicationIssue(item,s,now)).toBeNull();
  expect(item.evidenceJson.deadline_at.excerpt).toContain("13 de novembro");
  expect(normalizeAdditionalCall(ieg,"",s,new Date("2026-11-14T12:00:00Z"))[0].opportunityStatus).toBe("closed");
  expect(()=>normalizeAdditionalCall(`<article>Outra notícia</article><aside>${ieg}</aside>`,"",s,now)).toThrow();
});
it("stages eight inactive sources and preserves existing operator configuration when reapplied",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create table official_sources(id text primary key,name text,institution_name text,institution_acronym text,source_type text,base_url text,
      allowed_domains text[],allowed_path_prefixes text[],listing_urls text[],extraction_mode text,audience_scope text[],geographic_scope text[],categories text[],
      priority int,active boolean,verification_status text,crawl_interval_hours int,notes text);`);
    const files=["0039_audited_cnpq_calls_20261027.sql","0040_audited_ufsc_calls_20261027.sql","0041_audited_cps_ieg_calls_20261027.sql"];
    for(const file of files)await db.exec(readFileSync(new URL(`../../db/migrations/${file}`,import.meta.url),"utf8"));
    expect((await db.query("select count(*)::int as count from official_sources where not active and verification_status='pending'")).rows).toEqual([{count:8}]);
    await db.exec("update official_sources set active=true,verification_status='verified',crawl_interval_hours=48 where id='ufsc-proaa-2027'");
    for(const file of files)await db.exec(readFileSync(new URL(`../../db/migrations/${file}`,import.meta.url),"utf8"));
    expect((await db.query("select active,verification_status,crawl_interval_hours,audience_scope from official_sources where id='ufsc-proaa-2027'")).rows)
      .toEqual([{active:true,verification_status:"verified",crawl_interval_hours:48,audience_scope:["mixed"]}]);
  } finally {await db.close();}
});
