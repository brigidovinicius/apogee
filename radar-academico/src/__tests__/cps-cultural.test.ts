import { expect,it } from "vitest";
import { CPS_CULTURAL_ID,CPS_OPEN_URL,CPS_CULTURAL_NEWS,normalizeCpsCultural } from "@/lib/ingestion/normalize-cps-cultural";
import { programmeCataloguePageCount,programmeSupplementUrl,normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const source={id:CPS_CULTURAL_ID,institutionName:"Centro Paula Souza",active:true,extractionMode:"html",allowedDomains:["arinter.cps.sp.gov.br"],allowedPathPrefixes:["/editais-abertos/",new URL(CPS_CULTURAL_NEWS).pathname]} as OfficialSource;
const block=(n:number,status="ABERTAS De 23/09 até 17/10")=>`<h3>Ari – ${String(n).padStart(3,"0")}.2026</h3><p>15º INTERCÂMBIO CULTURAL DO CENTRO PAULA SOUZA (2026)</p><p>Inscrições ${status}</p>`;
const listing=`<h1>Editais Abertos</h1>${Array.from({length:6},(_,i)=>block(i+33)).join("")}<h3>Ari – 039.2026</h3><p>Outra seleção: Inscrições ENCERRADAS</p>`;
const news=`<h1>15º Intercâmbio Cultural</h1><p>533 bolsas; embarques previstos para 2027.</p><p>estudantes regularmente matriculados em cursos elegíveis das Etecs e Fatecs; critérios acadêmicos definidos em cada edital; não tenham participado anteriormente do programa.</p><p>Passagens aéreas internacionais de ida e volta; Ajuda de custo em moeda local; Hospedagem em casa de família; quatro semanas; Alimentação (café da manhã e jantar); Seguro-viagem e seguro-saúde internacional.</p><p>As inscrições estarão abertas de 23 de setembro a 17 de outubro de 2026, exclusivamente pelo Sistema ARInter.</p>`;
const now=new Date("2026-10-15T16:30:00Z");
it("aggregates six modalities into one exchange, with evidence and no invented location",()=>{
 const items=normalizeCpsCultural(listing,news,source,now);expect(items).toHaveLength(1);
 expect(items[0]).toMatchObject({categories:["bolsas","intercambios"],deadlineAt:"2026-10-17",opportunityStatus:"open",countryCode:null,stateCode:null,cityName:null,applicationUrl:CPS_OPEN_URL});
 expect(publicationIssue(items[0],source,now)).toBeNull();expect(programmeCataloguePageCount(source.id)).toBe(2);expect(programmeSupplementUrl(source.id)).toBe(CPS_CULTURAL_NEWS);expect(normalizeProgrammeCatalogue(listing,news,source)).toHaveLength(1);
});
it("isolates closures by modality and ignores unrelated closed calls",()=>{
 expect(normalizeCpsCultural(listing.replace(block(33),block(33,"ENCERRADAS")),news,source,now)[0].opportunityStatus).toBe("open");
 expect(normalizeCpsCultural(listing.replaceAll("ABERTAS De 23/09 até 17/10","ENCERRADAS"),news,source,now)[0].opportunityStatus).toBe("closed");
 expect(normalizeCpsCultural(listing,news+"<p>Inscrições suspensas.</p>",source,now)[0].opportunityStatus).toBe("suspended");
});
it("expires at midnight after the confirmed date in Brasilia",()=>{
 expect(normalizeCpsCultural(listing,news,source,new Date("2026-10-18T02:59:59Z"))[0].opportunityStatus).toBe("open");
 expect(normalizeCpsCultural(listing,news,source,new Date("2026-10-18T03:00:00Z"))[0].opportunityStatus).toBe("closed");
});
it("rejects incomplete responses, edition, benefit and date contradictions",()=>{
 for(const [a,b] of [["<h1>Manutenção</h1>",news],[listing.replace(block(34),""),news],[listing.replaceAll("17/10","18/10"),news],[listing,news.replaceAll("2026","2027")],[listing,news.replace("Ajuda de custo em moeda local","")],[listing,news.replace("15º","16º")],[listing,news.replace("critérios acadêmicos definidos em cada edital","")]]) expect(()=>normalizeCpsCultural(a,b,source,now)).toThrow();
 expect(normalizeCpsCultural(listing,news,{...source,id:"another"},now)).toEqual([]);
});
