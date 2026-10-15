import { expect,it } from "vitest";
import { CPS_VIRTUAL_ID,CPS_VIRTUAL_URL,NILT_LETTERS_ID,NILT_LETTERS_URL,normalizeAuditedYouthCall } from "@/lib/ingestion/normalize-audited-youth-calls";
import { publicationIssue } from "@/lib/ingestion/publication";
import { programmeCataloguePageCount,normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import type { OfficialSource } from "@/lib/ingestion/types";
const cps=`<h1>Editais Abertos</h1><h3>Ari – 031.2026</h3><p>Programa eMovies e Programa INILATmov+ Modalidade Virtual Alunos FATEC que atendam a todos os requisitos do edital Inscrições ABERTAS até 08/12</p><a href="https://forms.cloud.microsoft/e">INSCRIÇÃO eMovies</a><a href="https://forms.cloud.microsoft/i">INSCRIÇÃO InilatMov+</a><h3>Ari – 033.2026</h3><p>Outro intercâmbio: Inscrições ENCERRADAS</p>`;
const nilt=`<h1>Cursos com inscrições abertas – 2026</h1><table><tr><td>Cartas de motivação para intercâmbios acadêmicos</td><td>Presencial e On line</td><td>Estudantes, técnicos e docentes da UFSC</td><td>de 27 de outubro a 13 de novembro</td><td>de 1º a 19 de outubro</td><td>espanhol.nilt@gmail.com</td></tr><tr><td>Outro curso Autoinstrucional</td><td>Inscrições permanentes</td></tr></table>`;
const now=new Date('2026-10-15T17:00:00Z');
function source(id:string):OfficialSource {const url=id===CPS_VIRTUAL_ID?CPS_VIRTUAL_URL:NILT_LETTERS_URL;return {id,institutionName:'Official organizer',active:true,extractionMode:'html',allowedDomains:[new URL(url).hostname],allowedPathPrefixes:[new URL(url).pathname]} as OfficialSource;}
it('publishes one virtual selection, without counting partner programmes, courses or destinations separately',()=>{
 const s=source(CPS_VIRTUAL_ID),items=normalizeAuditedYouthCall(cps,s,now);expect(items).toHaveLength(1);expect(items[0]).toMatchObject({categories:['intercambios'],isCourse:false,deadlineAt:'2026-12-08',opportunityStatus:'open',countryCode:null,stateCode:null,cityName:null});expect(items[0].amountText).toContain('não informados');expect(publicationIssue(items[0],s,now)).toBeNull();expect(programmeCataloguePageCount(s.id)).toBe(1);expect(normalizeProgrammeCatalogue(cps,'',s)).toHaveLength(1);
});
it('classifies a preparation workshop as learning rather than an exchange or internship',()=>{
 const s=source(NILT_LETTERS_ID),items=normalizeAuditedYouthCall(nilt,s,now);expect(items).toHaveLength(1);expect(items[0]).toMatchObject({categories:['formacao'],isCourse:true,deadlineAt:'2026-10-19',opportunityStatus:'open',countryCode:null,stateCode:null,cityName:null});expect(items[0].requirementsText).toContain('Não é uma vaga de intercâmbio nem estágio');expect(publicationIssue(items[0],s,now)).toBeNull();
});
it('withdraws a confirmed closure or missing enrollment contact and expires in Brasilia',()=>{
 expect(normalizeAuditedYouthCall(cps.replace('ABERTAS até 08/12','ENCERRADAS'),source(CPS_VIRTUAL_ID),now)[0].opportunityStatus).toBe('closed');
 expect(normalizeAuditedYouthCall(cps.replace('https://forms.cloud.microsoft/e','https://example.org/e'),source(CPS_VIRTUAL_ID),now)[0].opportunityStatus).toBe('closed');
 expect(normalizeAuditedYouthCall(nilt.replace('espanhol.nilt@gmail.com',''),source(NILT_LETTERS_ID),now)[0].opportunityStatus).toBe('closed');
 expect(normalizeAuditedYouthCall(nilt,source(NILT_LETTERS_ID),new Date('2026-10-20T02:59:59Z'))[0].opportunityStatus).toBe('open');
 expect(normalizeAuditedYouthCall(nilt,source(NILT_LETTERS_ID),new Date('2026-10-20T03:00:00Z'))[0].opportunityStatus).toBe('closed');
 expect(normalizeAuditedYouthCall(cps,source(CPS_VIRTUAL_ID),new Date('2026-12-09T03:00:00Z'))[0].opportunityStatus).toBe('closed');
});
it('rejects partial bodies, changed years, deadlines, audience and duplicate programme rows',()=>{
 for(const html of ['<h1>Manutenção</h1>',cps.replace('031.2026','031.2027'),cps.replace('08/12','09/12'),cps.replace('Alunos FATEC','Docentes FATEC'),cps+cps]) expect(()=>normalizeAuditedYouthCall(html,source(CPS_VIRTUAL_ID),now)).toThrow();
 for(const html of [nilt.replace('2026','2027'),nilt.replace('19 de outubro','20 de outubro'),nilt.replace('Estudantes, técnicos e docentes','Somente servidores'),nilt+nilt]) expect(()=>normalizeAuditedYouthCall(html,source(NILT_LETTERS_ID),now)).toThrow();
 expect(normalizeAuditedYouthCall(cps,source('unknown'),now)).toEqual([]);
});
