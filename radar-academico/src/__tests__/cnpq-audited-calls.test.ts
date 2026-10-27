import { expect, it } from "vitest";
import { CNPQ_AUDITED_CALLS, cnpqCallUrl, cnpqDocumentUrl, normalizeCnpqAuditedCall } from "@/lib/ingestion/normalize-cnpq-audited-calls";
import { programmeCataloguePageCount, programmeSupplementUrl } from "@/lib/ingestion/programme-catalogue";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const now = new Date("2026-10-27T12:00:00Z");
const facts = {
  "30": {title:"Chamada Pública CNPq/CAPES Nº 30/2026 – MAI/DAI",start:"19/08/2026",end:"11/12/2026",
    text:"mestrado e doutorado em universidades em parceria com empresas",
    document:"Chamada CNPq/CAPES Nº 30/2026. ICTs poderão submeter propostas. Representante Institucional. 11/12/2026."},
  "32": {title:"Chamada Pública MCTI/CNPq/ANR N° 32/2026",start:"03/09/2026",end:"31/03/2027",
    text:"projetos de pesquisa conjuntos entre grupos brasileiros e franceses",
    document:"MCTI/CNPq/ANR Nº 32/2026. coordenador(a) brasileiro(a), possuir o título de doutor(a). 31/03/2027."},
  "33": {title:"Chamada CNPq nº 33/2026 - Bolsas de Produtividade do CNPq",start:"07/10/2026",end:"07/01/2027",
    text:"Produtividade em Pesquisa Sênior; pesquisadores que possuam produção científica",
    document:"Chamada CNPq Nº 33/2026. possuir o título de Doutor; vínculo formal com a instituição. 07/01/2027."},
};
function fixture(call: typeof CNPQ_AUDITED_CALLS[number]) {
  const fact = facts[call.number];
  const source: OfficialSource = {id:call.id,name:call.title,institutionName:"CNPq",institutionAcronym:"CNPq",
    sourceType:"federal_government",baseUrl:cnpqCallUrl(call),listingUrls:[cnpqCallUrl(call)],
    allowedDomains:["www.gov.br"],allowedPathPrefixes:[new URL(cnpqCallUrl(call)).pathname.replace(/[^/]+$/, "")],
    extractionMode:"html",audienceScope:[call.applicant],geographicScope:[],categories:["bolsas","pesquisa"],priority:85,active:true};
  return {source,document:fact.document,html:`<h1>${fact.title}</h1><div id="content-core"><p>${fact.text}</p>
    <a href="${cnpqDocumentUrl(call)}">Chamada</a><p>Inscrições: ${fact.start} a ${fact.end}</p></div>`};
}

it.each(CNPQ_AUDITED_CALLS)("validates a single call and its PDF without inventing location or salary: $id", call => {
  const f=fixture(call),items=normalizeCnpqAuditedCall(f.html,f.document,f.source,now);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({applicantType:call.applicant,applicationRoute:call.route,
    deadlinePrecision:"date_only",opportunityStatus:"open",nationallyEligible:false,stateCode:null,cityName:null,countryCode:null});
  expect(publicationIssue(items[0],f.source,now)).toBeNull();
  expect(items[0].amountText).not.toMatch(/R\$/);
  expect(programmeCataloguePageCount(call.id)).toBe(2);
  expect(programmeSupplementUrl(call.id)).toBe(cnpqDocumentUrl(call));
});

it.each(CNPQ_AUDITED_CALLS)("requires identity, unique current deadline, official link and matching PDF: $id", call => {
  const f=fixture(call);
  for (const html of [f.html.replaceAll("2026","2025"), f.html.replace("Inscrições:","Resultados:"),
    f.html.replace('id="content-core"','id="unrelated"'),f.html.replace("href=","data-removed="),
    f.html.replace("</div>",`<p>Inscrições: 01/10/2026 a 31/12/2027</p></div>`)]) {
    expect(()=>normalizeCnpqAuditedCall(html,f.document,f.source,now)).toThrow();
  }
  expect(()=>normalizeCnpqAuditedCall(f.html,"",f.source,now)).toThrow();
  expect(()=>normalizeCnpqAuditedCall(f.html,f.document.replace(facts[call.number].end,"01/01/2028"),f.source,now)).toThrow();
  expect(()=>normalizeCnpqAuditedCall(f.html,f.document,{...f.source,baseUrl:"https://example.org/"},now)).toThrow();
});

it.each(CNPQ_AUDITED_CALLS)("withdraws expiry and explicit closure using Brasília dates: $id", call => {
  const f=fixture(call),item=normalizeCnpqAuditedCall(f.html,f.document,f.source,now)[0];
  expect(normalizeCnpqAuditedCall(f.html,f.document,f.source,new Date(item.deadlineAt+"T23:59:59-03:00"))[0].opportunityStatus).toBe("open");
  const next=new Date(item.deadlineAt+"T00:00:00-03:00");next.setUTCDate(next.getUTCDate()+1);
  expect(normalizeCnpqAuditedCall(f.html,f.document,f.source,next)[0].opportunityStatus).toBe("closed");
  expect(normalizeCnpqAuditedCall(f.html.replace("</div>","<p>Inscrições encerradas.</p></div>"),f.document,f.source,now)[0].opportunityStatus).toBe("closed");
});

it("does not treat institutional MAI/DAI as a direct student application", () => {
  const call=CNPQ_AUDITED_CALLS[0],f=fixture(call),item=normalizeCnpqAuditedCall(f.html,f.document,f.source,now)[0];
  expect(item).toMatchObject({applicantType:"institution",applicationRoute:"institutional_call"});
  expect(item.requirementsText).toContain("representante institucional");
});
