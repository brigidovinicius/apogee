import { expect, it } from "vitest";
import { normalizeEvgCourse, normalizeEvgPolicy, parseEvgListing } from "@/lib/ingestion/normalize-evg-courses";
import { publicationIssue } from "@/lib/ingestion/publication";
import { canonicalOpportunityKey } from "@/lib/ingestion/revision-key";
import type { OfficialSource } from "@/lib/ingestion/types";
const source = {id:"evg-enap-open-courses", active:true, allowedDomains:["www.escolavirtual.gov.br"],allowedPathPrefixes:["/curso/","/perguntas-frequentes"]} as OfficialSource;
const url="https://www.escolavirtual.gov.br/curso/1604";
const policy=normalizeEvgPolicy("<body>Todos os cursos da Escola Virtual de Governo (EV.G) são de autoinstrução, sem tutoria, com certificado e gratuitos.</body>");
const html=`<main class="curso-detalhe"><div class="box-curso-intro"><h2>Investigações</h2><div class="badges">Curso Aberto</div><p>Descrição pedagógica</p></div>
<div id="collapseOferta"><div class="accordion-body"><dl><dt>Conteudista:</dt><dd>MJSP</dd><dt>Certificador:</dt><dd>Enap - Escola Nacional de Administração Pública</dd><dt>Idioma:</dt><dd>Português</dd><dt>Carga Horária:</dt><dd>30h</dd><dt>Disponibilidade:</dt><dd>30 dias</dd><dt>Público Alvo:</dt><dd>Qualquer pessoa interessada.</dd><dt>Conteúdo Programático:</dt><dd>Módulo 1: procedimentos para oferta suspensa e cancelamento do curso</dd></dl><a href="https://www.escolavirtual.gov.br/secretaria/inscricao/51547">Inscreva-se</a></div></div>
<div id="collapseOutrasInformacoes"><div class="accordion-body">Você pode inscrever-se a qualquer momento e iniciar imediatamente.</div></div></main>`;
it("requires actual self-hosted enrollment, current availability and confirmed universal fee policy",()=>{
 const candidate=normalizeEvgCourse(html,url,source,policy)!;expect(candidate).toMatchObject({opportunityStatus:"open",deadlinePrecision:"continuous_flow",deadlineAt:undefined,countryCode:null,stateCode:null,cityName:null,nationallyEligible:false});
 expect(candidate.title).toBe("Investigações — MJSP (EV.G)");expect(candidate.requirementsText).toContain("30 dias; essa duração não é prazo de matrícula");expect(publicationIssue(candidate,source)).toBeNull();
 expect(normalizeEvgCourse(html,url,source)).toBeNull();
 const explicit=html.replace("Qualquer pessoa interessada.","Curso aberto, gratuito e com certificado, qualquer pessoa pode se inscrever.");expect(normalizeEvgCourse(explicit,url,source)?.opportunityStatus).toBe("open");
 for(const changed of [html.replace("Português","Espanhol"),html.replace("Enap - Escola Nacional de Administração Pública","Instituição não auditada"),html.replace("www.escolavirtual.gov.br/secretaria/inscricao/51547","terceiro.example/inscricao/51547"),html.replace("Inscreva-se","Saiba mais"),...["Exclusivo para servidores cadastrados.","Cursos restritos a servidores.","Exclusivamente para empregados.","Destinado a grupos exclusivos.","Inscrições até 31/10/2026."].map(notice=>html.replace("Qualquer pessoa interessada.",notice)),html.replace("imediatamente.","imediatamente. Inscrições até 31/10/2026."),html.replace("Qualquer pessoa interessada.","Curso não é gratuito.")])expect(normalizeEvgCourse(changed,url,source,policy)).toBeNull();
 expect(()=>normalizeEvgCourse("Manutenção",url,source,policy)).toThrow();expect(()=>normalizeEvgPolicy("Página de manutenção")).toThrow();
});
it("detects actual notices without turning pedagogical content into closure or claiming absent requirements",()=>{
 const candidate=normalizeEvgCourse(html.replace("Qualquer pessoa interessada.","Público a partir de 16 anos, com ensino médio."),url,source,policy)!;expect(candidate.opportunityStatus).toBe("open");expect(candidate.requirementsText).toContain("16 anos");expect(candidate.requirementsText).not.toContain("mínimas não informadas");
 const cancelled=normalizeEvgCourse(html.replace("<div class=\"accordion-body\"><dl>","<div class=\"accordion-body\"><p>Curso cancelado</p><dl>"),url,source,policy)!;expect(cancelled.opportunityStatus).toBe("cancelled");expect(cancelled.evidenceJson.opportunity_status.excerpt).toContain("Curso cancelado");
 const audienceClosed=normalizeEvgCourse(html.replace("Qualquer pessoa interessada.","Inscrições encerradas."),url,source,policy)!;expect(audienceClosed.opportunityStatus).toBe("closed");
 const suspended=normalizeEvgCourse(html.replace("Descrição pedagógica","Inscrições suspensas"),url,source,policy)!;expect(suspended.opportunityStatus).toBe("suspended");
});
it("counts full independent courses and preserves stable identity across distinct URLs",()=>{
 for(const title of ["Módulo 1 - Conteúdo","Eixo 3 - Programa","Trilha de aprendizagem","S2ID - M3 - Reconstrução","Investigações - Versão 2","Investigações 2ª edição"])
  expect(normalizeEvgCourse(html.replace("<h2>Investigações</h2>",`<h2>${title}</h2>`),url,source,policy)).toBeNull();
 expect(normalizeEvgCourse(html,"https://www.escolavirtual.gov.br/curso/627",source,policy)).toBeNull();
 const a=normalizeEvgCourse(html,url,source,policy)!,b=normalizeEvgCourse(html,"https://www.escolavirtual.gov.br/curso/9999",source,policy)!;
 expect(canonicalOpportunityKey(source.id,a.title,a.sourcePageUrl)).toBe(canonicalOpportunityKey(source.id,b.title,b.sourcePageUrl));
 expect(normalizeEvgCourse(html.replace("<dd>MJSP</dd>","<dd>Enap</dd>"),url,source,policy)?.title).not.toBe(a.title);
 const listing=`<div class="courseboxes"><div class="card" id="curso1604"><h3 class="card-title"><a href="${url}">Investigações</a></h3><a href="https://www.escolavirtual.gov.br/secretaria/inscricao/51547">Inscrever-se</a></div></div><a href="https://www.escolavirtual.gov.br/curso/1572">Curso relacionado</a>`;
 expect(parseEvgListing(listing).map(x=>x.url)).toEqual([url]);expect(()=>parseEvgListing("Manutenção")).toThrow();
});
