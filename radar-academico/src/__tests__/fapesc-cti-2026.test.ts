import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { FAPESC_CTI_ID, FAPESC_CTI_URL, normalizeFapescCti } from "@/lib/ingestion/normalize-fapesc-cti-2026";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const source: OfficialSource = {
 id:FAPESC_CTI_ID,name:"FAPESC CECTI",institutionName:"Fapesc",institutionAcronym:"FAPESC",sourceType:"government_foundation",
 baseUrl:FAPESC_CTI_URL,listingUrls:[FAPESC_CTI_URL],allowedDomains:["fapesc.sc.gov.br"],allowedPathPrefixes:[new URL(FAPESC_CTI_URL).pathname],
 extractionMode:"html",audienceScope:["mixed"],geographicScope:["Santa Catarina"],categories:["eventos"],priority:60,active:true,
};
const html = readFileSync(new URL("./fixtures/discovery-20261030/fapesc-cecti-regional-2026.html", import.meta.url),"utf8");
const now=new Date("2026-10-30T17:00:00Z");
it("publishes one regional edition with capacity-based registration, without inventing a deadline or free entry",()=>{
 const [candidate]=normalizeFapescCti(html,source,now);
 expect(publicationIssue(candidate,source,now)).toBeNull();
 expect(candidate.deadlineAt).toBeUndefined();expect(candidate.deadlinePrecision).toBe("not_informed");
 expect(candidate.eventStartsAt).toBe("2026-11-03");expect(candidate.opportunityStatus).toBe("open");
 expect(candidate.institution).toContain("Santa Catarina");expect(candidate.requirementsText).toContain("regras próprias");
 expect(candidate.amountText).toContain("não informadas");expect(candidate.applicationUrl).toBe(FAPESC_CTI_URL);
 expect(normalizeFapescCti(html,source,new Date("2026-11-03T03:01:00Z"))[0].opportunityStatus).toBe("closed");
});
it("rejects changed capacity, date, public, CTA and article identity",()=>{
 for(const changed of [html.replace("03/11/2026","03/11/2027"),html.replace("no CIB, no dia","em outro local, no dia"),html.replace("capacidade de cada local for atingida","data final for anunciada"),
   html.replace("setores produtivo, governamental, acadêmico e sociedade civil organizada","público indeterminado"),
   html.replaceAll("http://www.conferenciacti.sc.gov.br/","http://outside.example/"),html.replaceAll("post-58157","post-99999")])
   expect(()=>normalizeFapescCti(changed,source,now)).toThrow();
});
it("does not let another edition or a duplicated content area supply evidence",()=>{
 expect(()=>normalizeFapescCti(html,{...source,baseUrl:"https://fapesc.sc.gov.br/"},now)).toThrow();
 expect(()=>normalizeFapescCti(html.replace('class="elementor-widget-container"','class="elementor-widget-theme-post-content"'),source,now)).toThrow();
});

it("still closes an explicit end of registration alongside the future capacity condition",()=>{
 const closed=html.replace("O número de vagas é limitado em cada região.","O número de vagas é limitado em cada região. Inscrições encerradas.");
 expect(normalizeFapescCti(closed,source,now)[0].opportunityStatus).toBe("closed");
});
