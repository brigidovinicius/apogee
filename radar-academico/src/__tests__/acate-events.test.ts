import { expect, it } from "vitest";
import { normalizeAcateEvent } from "@/lib/ingestion/normalize-acate-events";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const url = "https://www.acate.com.br/agenda-de-eventos/decola-acate-startups-lages-2026/";
const source = { id: "acate-audited-events", institutionName: "ACATE", active: true,
  allowedDomains: ["www.acate.com.br"], allowedPathPrefixes: ["/agenda-de-eventos/"] } as OfficialSource;
const html = `<link rel="canonical" href="${url}"><h1>Decola ACATE Startups – Lages</h1><article>
  <div>29 de OUT de 2026</div><div class="localizacao-detalhes-agenda">Orion Parque Tecnológico - Lages (SC)</div>
  <div class="horario-detalhes-agenda">19:00</div><div class="content-texto-detalhes-agenda">Encontro de empreendedorismo organizado pela ACATE.</div>
  <a href="https://www.sympla.com.br/evento/edition/123">Inscreva-se</a></article>`;
const now = new Date("2026-10-14T15:00:00Z");
it("extracts the audited edition without inventing a deadline, cost, eligibility or timezone", () => {
  const item = normalizeAcateEvent(html, url, source, now)!;
  expect(item).toMatchObject({ title: "Decola ACATE Startups – Lages", deadlinePrecision: "not_informed",
    eventStartsAt: "2026-10-29", opportunityStatus: "open", countryCode: "BR", stateCode: "SC", cityName: "Lages" });
  expect(item.deadlineAt).toBeUndefined();expect(item.amountText).toContain("Não presumir gratuidade");
  expect(publicationIssue(item, source, now)).toBeNull();
  expect(publicationIssue(item, source, new Date("2026-10-29T03:00:00Z"))).toBe("invalid_deadline");
});
it("fails closed for other organizers, removed registration, malformed dates or stated deadlines", () => {
  for (const changed of [html.replace("Inscreva-se", "Saiba mais"), html.replace("29 de OUT", "32 de OUT"),
    html.replace("(SC)", "(SP)"), html.replace("</article>", "Inscrições encerram em 31/02/2027.</article>")]) {
    expect(normalizeAcateEvent(changed, url, source, now)).toBeNull();
  }
  expect(normalizeAcateEvent(html, "https://www.acate.com.br/agenda-de-eventos/third-party/", source, now)).toBeNull();
  expect(() => normalizeAcateEvent("<h1>Manutenção</h1>", url, source, now)).toThrow("indisponível");
  const closed = normalizeAcateEvent(html.replace("</article>", "Inscrições encerradas.</article>"), url, source, now)!;
  // A terminal message is not an ambiguous deadline; no publication is possible.
  expect(closed === null || publicationIssue(closed, source, now) !== null).toBe(true);
  for (const notice of ["Cancelamento do evento.", "Este encontro foi cancelado.", "Inscrições suspensas."]) {
    const changed = html.replace(/<a href=[\s\S]*?<\/a>/, "").replace("</article>", `${notice}</article>`);
    const terminal = normalizeAcateEvent(changed, url, source, now)!;
    expect(terminal.opportunityStatus).toBe(notice.includes("suspensas") ? "suspended" : "cancelled");
    expect(publicationIssue(terminal, source, now)).toBe("status_unconfirmed");
  }
});
