import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { normalizeScHackathon, NIAVI_ID, NIAVI_URL, ORION_ID, ORION_URL } from "@/lib/ingestion/normalize-sc-hackathons";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const now = new Date("2026-10-15T12:00:00Z");
const source = (id:string,url:string) => ({id,institutionName:id,active:true,allowedDomains:[new URL(url).hostname],allowedPathPrefixes:["/"]}) as OfficialSource;
const niavi = readFileSync(new URL("./fixtures/niavi-hackathon-20261015.html",import.meta.url),"utf8");
const orion = readFileSync(new URL("./fixtures/orion-hackathon-20261015.html",import.meta.url),"utf8");
it("publishes one edition per source, never its seats or teams, with no invented deadline",()=>{
 for(const [html,id,url,city,start] of [[niavi,NIAVI_ID,NIAVI_URL,"Rio do Sul","2026-10-24"],[orion,ORION_ID,ORION_URL,"Lages","2026-10-16"]]){
  const s=source(id,url), items=normalizeScHackathon(html,s,now);
  expect(items).toHaveLength(1);expect(items[0]).toMatchObject({cityName:city,categories:["competicoes","eventos"],deadlinePrecision:"not_informed",eventStartsAt:start,opportunityStatus:"open"});
  expect(items[0].deadlineAt).toBeUndefined();expect(publicationIssue(items[0],s,now)).toBeNull();
  expect(normalizeScHackathon(html,s,new Date(start+"T03:00:00Z"))[0].opportunityStatus).toBe("closed");
 }
});
it("withdraws full or removed registration and confirmed cancellation",()=>{
 const s=source(NIAVI_ID,NIAVI_URL);
 expect(normalizeScHackathon(niavi.replace("7 confirmados Restam 93 vagas","100 confirmados Restam 0 vagas"),s,now)[0].opportunityStatus).toBe("closed");
 expect(normalizeScHackathon(niavi.replace('/inscricao','/about'),s,now)[0].opportunityStatus).toBe("closed");
 expect(normalizeScHackathon(niavi.replace('</main>','Evento cancelado.</main>'),s,now)[0].opportunityStatus).toBe("cancelled");
});
it("preserves previous evidence via error on partial pages, edition changes or contradictory capacity",()=>{
 const s=source(NIAVI_ID,NIAVI_URL);
 for(const html of ["<h1>Manutenção</h1>",niavi.replace("24 de outubro de 2026","24 de outubro de 2027"),niavi.replace("Restam 93","Restam 94"),niavi.replace('</main>','Inscrições até 20/10/2026.</main>'),niavi.replace('</main>','Inscrições encerram em 31/02/2026.</main>')]){
  expect(()=>normalizeScHackathon(html,s,now)).toThrow();
 }
 expect(normalizeScHackathon(niavi,source("other",NIAVI_URL),now)).toEqual([]);
});
