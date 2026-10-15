import { expect, it } from "vitest";
import { normalizeAcimStartupWeekend as normalize } from "@/lib/ingestion/normalize-acim-startup-weekend";
import { publicationIssue } from "@/lib/ingestion/publication";
import { acimHtml, acimSource } from "./fixtures/acim-startup-weekend";
const now = new Date("2026-10-15T01:20:00Z");
const run = (html = acimHtml, date = now) => normalize(html, acimSource, date);
it("publica uma única edição paga com vagas comprovadas sem converter o início em prazo", () => {
 const items = run(); expect(items).toHaveLength(1);
 expect(items[0]).toMatchObject({ opportunityStatus: "open", categories: ["eventos"], deadlinePrecision: "not_informed", eventStartsAt: "2026-11-06T18:00:00-03:00", cityName: "Imbituba", stateCode: "SC", countryCode: "BR", applicantType: "mixed" });
 expect(items[0]).not.toHaveProperty("deadlineAt"); expect(items[0].amountText).toContain("R$ 80,00 + R$ 2,00"); expect(items[0].amountText).toContain("R$ 82,00");
 expect(items[0].requirementsText).toContain("Idade e escolaridade mínimas não estão comprovadas"); expect(publicationIssue(items[0],acimSource,now)).toBeNull();
 // The real ticket picker starts at quantity zero; that is not a zero-vacancy notice.
 expect(acimHtml).toContain("Quantidade"); expect(items[0].opportunityStatus).toBe("open");
});
it("retira por cancelamento, adiamento, esgotamento e início confirmado", () => {
 for (const [html,status] of [[acimHtml.replace('https://schema.org/EventScheduled','https://schema.org/EventCancelled'),'cancelled'],[acimHtml.replace('https://schema.org/EventScheduled','https://schema.org/EventPostponed'),'suspended'],[acimHtml.replaceAll('https://schema.org/InStock','https://schema.org/SoldOut'),'closed']] as const) {
  const [item] = run(html); expect(item.opportunityStatus).toBe(status); expect(publicationIssue(item,acimSource,now)).toBe("status_unconfirmed");
 }
 expect(run(undefined,new Date("2026-11-06T20:59:59Z"))[0].opportunityStatus).toBe("open");
 expect(run(undefined,new Date("2026-11-06T21:00:00Z"))[0].opportunityStatus).toBe("closed");
 expect(run(acimHtml.replace("Nos dias 06", "Evento cancelado. Nos dias 06"))[0].opportunityStatus).toBe("cancelled");
 expect(run(acimHtml.replace("https://schema.org/EventScheduled","https://schema.org/EventRescheduled"))[0].opportunityStatus).toBe("unknown");
});
it("recusa edição, datas, local e valores contraditórios ou venda futura", () => {
 for(const html of [acimHtml.replace('https://schema.org/OfflineEventAttendanceMode','https://schema.org/OnlineEventAttendanceMode'),acimHtml.replace('"description":"2ª Edição"','"description":"3ª Edição"'),acimHtml.replace('"startDate":"2026-11-06','"startDate":"2027-11-06'),acimHtml.replace('"startDate":"2026-11-06T18:00:00-03:00"','"startDate":"2026-11-06T19:00:00-03:00"'),acimHtml.replace('"priceCurrency":"BRL"','"priceCurrency":"USD"'),acimHtml.replace('2,00 de taxa','3,00 de taxa'),acimHtml.replaceAll('2026-09-02T13:36:29.428Z','2026-12-02T13:36:29.428Z'),acimHtml.replace('"validFrom":','"validThrough":"2026-11-01T10:00:00Z","validFrom":'),acimHtml.replaceAll('Imbituba - SC','Imbituba - RS')]) expect(run(html)).toEqual([]);
 expect(run(acimHtml.replace('Nos dias 06','Inscrições até 30/10/2026. Nos dias 06'))).toEqual([]);
});
it("preserva para retry se a resposta perder identidade ou estrutura e ignora traduções ocultas", () => {
 expect(()=>run('<h1 data-hook="event-title">Startup Weekend Imbituba</h1>')).toThrow();
 expect(()=>run(acimHtml.replace('application/ld+json','application/json'))).toThrow();
 expect(run()[0].opportunityStatus).toBe("open");
 expect(normalize(acimHtml,{...acimSource,id:"another-source"},now)).toEqual([]);
});
