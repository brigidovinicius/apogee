import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
import { AXIA_ID,AXIA_URL,AXIA_APPLICATION,normalizeAxiaInternship } from "@/lib/ingestion/normalize-axia-internship";
import { publicationIssue } from "@/lib/ingestion/publication";
import { programmeCataloguePageCount,normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import type { OfficialSource } from "@/lib/ingestion/types";
const page=readFileSync(new URL('./fixtures/axia-internship-20261015.html',import.meta.url),'utf8');
const source={id:AXIA_ID,institutionName:'AXIA Energia',active:true,allowedDomains:['axia.com.br'],allowedPathPrefixes:[new URL(AXIA_URL).pathname]} as OfficialSource;
const now=new Date('2026-10-15T13:00:00Z');
it('publishes one paid programme across states and courses, without invented amount or city',()=>{
 const items=normalizeAxiaInternship(page,source,now);expect(items).toHaveLength(1);
 expect(items[0]).toMatchObject({benefitType:'internship',categories:['carreira'],deadlineAt:'2026-10-15',deadlinePrecision:'date_only',countryCode:'BR',stateCode:null,cityName:null,opportunityStatus:'open',applicationUrl:AXIA_APPLICATION});
 expect(items[0].requirementsText).toContain('Santa Catarina');expect(items[0].amountText).toContain('valor não divulgado');expect(publicationIssue(items[0],source,now)).toBeNull();
 expect(programmeCataloguePageCount(AXIA_ID)).toBe(1);expect(normalizeProgrammeCatalogue(page,'',source)).toHaveLength(1);
});
it('expires at the end of the confirmed date in Brasilia and withdraws a removed CTA or explicit closure',()=>{
 expect(normalizeAxiaInternship(page,source,new Date('2026-10-16T02:59:59Z'))[0].opportunityStatus).toBe('open');
 expect(normalizeAxiaInternship(page,source,new Date('2026-10-16T03:00:00Z'))[0].opportunityStatus).toBe('closed');
 expect(normalizeAxiaInternship(page.replaceAll(AXIA_APPLICATION,'https://example.org/'),source,now)[0].opportunityStatus).toBe('closed');
 expect(normalizeAxiaInternship(page.replace('</body>','Inscrições encerradas.</body>'),source,now)[0].opportunityStatus).toBe('closed');
});
it('rejects partial responses, changed edition, eligibility, pay or deadline for a retry audit',()=>{
 for(const input of ['<h1>Manutenção</h1>',page.replaceAll('2027','2028'),page.replace('15 de outubro de 2026','16 de outubro de 2026'),page.replace('bolsa-auxílio compatível com o mercado','estágio voluntário'),page.replace('Santa Catarina','Paraná'),page.replace('</body>','Prazo prorrogado.</body>')]) expect(()=>normalizeAxiaInternship(input,source,now)).toThrow();
 expect(normalizeAxiaInternship(page,{...source,id:'other'},now)).toEqual([]);
});
