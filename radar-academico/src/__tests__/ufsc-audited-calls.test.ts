import { expect, it } from "vitest";
import { UFSC_AUDITED_CALLS, normalizeUfscAuditedCall } from "@/lib/ingestion/normalize-ufsc-audited-calls";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const now=new Date("2026-10-27T12:00:00Z");
const content={
  "ufsc-proaa-2027":{primary:"Programa de Bolsas de Extensão para Ações Afirmativas. PROAA em 2027. 17h do dia 27 de outubro. de 6 a 27 de outubro de 2026. servidores docentes e técnico-administrativos. registrado e aprovado no SIGPEX.",
    supplement:"Edital 11/2026/PROEX. PROAA 2027. 27/10/2026 às 17h."},
  "ufsc-ppgtg-masters-2027-1":{primary:"Engenharia de Transportes e Gestão Territorial. 1º trimestre de 2027. até 27 de novembro de 2026. inscrições são gratuitas, alunos graduados, 28 vagas.",
    supplement:"INGRESSO NO 1º TRIMESTRE DE 2027. Inscrições: 09/10/2026 à 27/11/2026."},
  "ufsc-transfers-2027-1":{primary:"primeiro semestre letivo de 2027. Inscrições de 22 a 30 de outubro de 2026. Candidatos externos: um único curso e inciso.",
    supplement:"5.139 vagas, transferência interna e retorno de aluno abandono, transferência externa e retorno de graduados."},
};
const article=(text:string)=>`<article><h2>Chamada UFSC</h2><div>${text}</div></article>`;
function fixture(call:typeof UFSC_AUDITED_CALLS[number]) {
  const fact=content[call.id];
  const source={id:call.id,baseUrl:call.url,listingUrls:[call.url],active:true,
    allowedDomains:[new URL(call.url).hostname,new URL(call.supplement).hostname],allowedPathPrefixes:["/"],
    extractionMode:"html"} as OfficialSource;
  return {source,html:article(fact.primary),supplement:call.supplement.endsWith(".pdf")?fact.supplement:article(fact.supplement)};
}

it.each(UFSC_AUDITED_CALLS)("validates the exact current UFSC call and supporting official evidence: $id",call=>{
  const f=fixture(call),items=normalizeUfscAuditedCall(f.html,f.supplement,f.source,now);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({opportunityStatus:"open",deadlineAt:call.deadline,deadlinePrecision:call.precision,
    applicantType:call.applicant,applicationRoute:call.route,stateCode:null,cityName:null,nationallyEligible:false});
  expect(publicationIssue(items[0],f.source,now)).toBeNull();
});

it.each(UFSC_AUDITED_CALLS)("rejects incomplete evidence, a neighboring edition or a deadline only in the sidebar: $id",call=>{
  const f=fixture(call);
  expect(()=>normalizeUfscAuditedCall(f.html,"",f.source,now)).toThrow();
  expect(()=>normalizeUfscAuditedCall(f.html.replaceAll("2027","2028"),f.supplement,f.source,now)).toThrow();
  expect(()=>normalizeUfscAuditedCall(`<article>Unrelated news</article><aside>${f.html}</aside>`,f.supplement,f.source,now)).toThrow();
  expect(()=>normalizeUfscAuditedCall(f.html,f.supplement,{...f.source,listingUrls:["https://example.org/"]},now)).toThrow();
});

it("expires the PROAA proposal at 17h Brasília without treating the institutional call as a student vacancy",()=>{
  const call=UFSC_AUDITED_CALLS[0],f=fixture(call);
  const normalize=(at:string)=>normalizeUfscAuditedCall(f.html,f.supplement,f.source,new Date(at))[0];
  expect(normalize("2026-10-27T16:59:59-03:00").opportunityStatus).toBe("open");
  expect(normalize("2026-10-27T17:00:01-03:00").opportunityStatus).toBe("closed");
  expect(normalize("2026-10-27T12:00:00-03:00").requirementsText).toContain("docentes ou técnicos");
  const item=normalizeUfscAuditedCall(f.html,"Introdução ".repeat(500)+f.supplement,f.source,now)[0];
  expect(item.applicantType).toBe("mixed");
  expect(item.evidenceJson.deadline_at).toMatchObject({source_url:call.url,excerpt:expect.stringContaining("17h do dia 27 de outubro")});
});
