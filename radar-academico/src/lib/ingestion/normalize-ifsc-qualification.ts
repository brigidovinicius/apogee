import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { confirmedTerminalStatus } from "./publication";

export const IFSC_QUALIFICATION_URL = "https://www.ifsc.edu.br/qualifica";
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
function calendarDate(day: string, month: string, year: string) {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

export function normalizeIfscQualification(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== "ifsc-qualification-courses-2026-2") return [];
  const $ = cheerio.load(html);$("script,style,noscript,nav,footer,header").remove();
  const text = clean($("body").text());
  const window = /(\d{1,2})\s+a\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*Período de inscrições/i.exec(text);
  if (!window || window[4] !== "2026" || !/Edital Deing 24\/2026\/2/i.test(text) || !/Edital Deing 27\/2026\/2/i.test(text) ||
    !html.includes("https://sistemadeingresso.ifsc.edu.br") || !/Não há cobrança de taxa de inscrição/i.test(text) || !/curso gratuito/i.test(text)) throw new Error("Oferta FIC ou inscrição não confirmada");
  const start = calendarDate(window[1], window[3], window[4]), deadlineAt = calendarDate(window[2], window[3], window[4]);
  if (!start || !deadlineAt || start > deadlineAt) throw new Error("Período FIC inválido");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const edital = $(".journal-content-article").filter((_, node) => $(node).find("h2").toArray()
    .some(heading => clean($(heading).text()) === "Edital"));
  if (edital.length !== 1) throw new Error("Bloco de inscrição FIC não confirmado");
  const registrationNotice = clean(`${edital.text()} ${$(".alert,.alerta,[role=alert]").text()}`);
  const status = confirmedTerminalStatus(registrationNotice) ?? (deadlineAt < today ? "closed" : start > today ? "upcoming" : "open");
  const roots = $(".journal-content-article").filter((_, node) => $(node).find("h2").toArray()
    .some(heading => ["Cursos de qualificação profissional", "Cursos de Idiomas"].includes(clean($(heading).text()))));
  if (roots.length !== 2) throw new Error("Estrutura do catálogo FIC alterada");
  const courses = new Map<string, { name: string; campus: string; offers: string[]; selection: string }>();
  roots.each((_, root) => {
    let campus = "";
    $(root).find("p").each((_, paragraph) => {
      const linkedCampus = clean($(paragraph).find("a").text());
      if (/^Câmpus /i.test(linkedCampus)) { campus = linkedCampus.replace(/^Câmpus /i, "");return; }
      const lines = $(paragraph).clone().find("br").replaceWith("\n").end().text().split("\n").map(clean);
      const selection = lines.find(line => /^Seleção por /i.test(line)) ?? "Consulte o edital";
      for (const line of lines) {
        const match = /^(.+?)\s+-\s+\d+ vagas\b(.*)$/i.exec(line);
        if (!match || !campus) continue;
        const name = match[1].replace(/\*$/, "").trim(), key = `${campus}\n${name}`;
        const entry = courses.get(key) ?? { name, campus, offers: [], selection };
        entry.offers.push(line);courses.set(key, entry);
      }
    });
  });
  if (!courses.size || courses.size > 100) throw new Error("Cursos FIC não confirmados dentro do limite");
  return [...courses.values()].map(course => {
    const offer = course.offers.join("; ");
    const available = course.offers.some(line => !confirmedTerminalStatus(line, course.name) &&
      [...line.matchAll(/(\d+)\s+vagas/gi)].some(match => Number(match[1]) > 0));
    const opportunityStatus = status !== "open" && status !== "upcoming" ? status : available ? status :
      course.offers.map(line => confirmedTerminalStatus(line, course.name)).find(value => value) ?? "closed";
    const title = `${course.name} — IFSC ${course.campus}, 2026.2`;
    const proof = { source_url: IFSC_QUALIFICATION_URL, excerpt: `${window[0]}; ${offer}` };
    return { officialSourceId: source.id, title, institution: source.institutionName,
      sourcePageUrl: IFSC_QUALIFICATION_URL, applicationUrl: "https://sistemadeingresso.ifsc.edu.br/",
      applicantType: "mixed", applicationRoute: "direct_student_application", benefitType: "other", categories: ["formacao"],
      isCourse: true, nationallyEligible: false, countryCode: null, stateCode: null, cityName: null, geographicScopeKind: "unknown",
      deadlineAt, deadlinePrecision: "date_only", opportunityStatus, reviewStatus: "needs_information", extractionMethod: "html",
      requirementsText: `Oferta do Câmpus ${course.campus}: ${offer}. ${course.selection} Requisitos de idade, escolaridade e conhecimentos variam por curso e devem ser conferidos nos editais 24 a 27/2026/2. O nome do câmpus não comprova o local das aulas; ofertas EaD mantêm essa modalidade no texto. Consulte a fonte para endereço, horários completos e condições.`,
      amountText: "Curso gratuito do IFSC e sem taxa de inscrição. Remuneração e auxílios não informados nesta listagem.",
      evidenceJson: { deadline_at: proof, opportunity_status: proof,
        requirements: { source_url: IFSC_QUALIFICATION_URL, excerpt: `Câmpus ${course.campus}; ${offer}; pré-requisitos de cada curso no edital.` } },
      contentHash: crypto.createHash("sha256").update(`ifsc-fic-v1\n${title}\n${window[0]}\n${offer}\n${opportunityStatus}`).digest("hex") };
  });
}
