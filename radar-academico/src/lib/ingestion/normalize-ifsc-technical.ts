import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const IFSC_TECHNICAL_URL = "https://www.ifsc.edu.br/tecnicos";
const applicationUrl = "https://sistemadeingresso.ifsc.edu.br/inicio.php";

function dateOnly(day: string, month: string, year: string) {
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function normalizeIfscTechnicalCourses(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== "ifsc-technical-courses-2027") return [];
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (!/Edital\s+05\/Deing\/2027-1/i.test(text)) return [];
  const proof = /(\d{1,2})\/(\d{1,2}) a (\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*Período de inscrições para cursos com seleção por prova/i.exec(text);
  const lottery = /(\d{1,2})\/(\d{1,2}) a (\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*Período de inscrições para cursos com seleção por sorteio e ordem de inscrição/i.exec(text);
  if (!proof || !lottery || proof[5] !== "2026" || lottery[5] !== "2026" ||
    !$("a").toArray().some((a) => $(a).text().trim() === "Inscreva-se" && $(a).attr("href") === applicationUrl)) return [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const heading = $("h2").filter((_, element) => $(element).text().trim() === "Cursos").last();
  const candidates: OpportunityCandidate[] = [];
  let campus = "", selection = "";
  for (let element = heading.next(); element.length && !element.is("h2"); element = element.next()) {
    const paragraph = element.text().replace(/\s+/g, " ").trim();
    if (element.is("h4") && /^Câmpus\s+/.test(paragraph)) {
      campus = paragraph.replace(/^Câmpus\s+/, "");
      selection = "";
      continue;
    }
    if (!element.is("p") || !campus) continue;
    if (/^Seleção por (?:prova|sorteio|ordem de inscrição)/i.test(paragraph)) {
      selection = paragraph;
      continue;
    }
    if (!selection) continue;
    const window = /prova/i.test(selection) ? proof : lottery;
    const startAt = dateOnly(window[1], window[2], window[5]);
    const deadlineAt = dateOnly(window[3], window[4], window[5]);
    if (!startAt || !deadlineAt || deadlineAt < startAt) continue;
    for (const anchor of element.find("a").toArray()) {
      const course = $(anchor).text().replace(/\s+/g, " ").trim();
      if (!/^(Médio Técnico em|Subsequente em|Concomitante em|Proeja)/i.test(course)) continue;
      const link = $(anchor).attr("href");
      if (!link || !/^https:\/\/(?:www\.)?ifsc\.edu\.br\//.test(link)) continue;
      // The advertised seats immediately follow this course link, before the next <br>.
      const sibling = anchor.nextSibling;
      const detail = sibling?.type === "text" ? sibling.data.replace(/\s+/g, " ").trim() : "";
      const seats = /^[-–].{0,120}?\b(\d+) vagas?/i.exec(detail);
      if (!seats || Number(seats[1]) < 1) continue;
      const modalityTitle = course.replace(/^Médio Técnico em/i, "Técnico integrado em")
        .replace(/^Subsequente em/i, "Técnico subsequente em").replace(/^Concomitante em/i, "Técnico concomitante em");
      const title = `${modalityTitle} — IFSC ${campus} 2027.1`;
      const remote = /EaD|a distância/i.test(detail);
      const cityName = remote || /-|Bilíngue/i.test(campus) ? null : campus;
      const requirementsText = `${course} no Câmpus ${campus}; ${selection.toLowerCase()}. Oferta: ${detail.replace(/^[-–]\s*/, "")}. ` +
        (/^Médio Técnico/i.test(course) ? "Para cursar ensino médio e técnico juntos. " :
          /^Concomitante/i.test(course) ? "Para quem está cursando o ensino médio. " :
            /^Subsequente/i.test(course) ? "Para quem concluiu o ensino médio. " : "Educação de jovens e adultos; confira idade e escolaridade no edital. ") +
        "Consulte o edital oficial para todos os requisitos e documentos.";
      candidates.push({
        officialSourceId: source.id, title, institution: source.institutionName, sourcePageUrl: IFSC_TECHNICAL_URL,
        applicationUrl, applicantType: /^(Médio Técnico|Concomitante)/i.test(course) ? "high_school_student" : "mixed",
        applicationRoute: "direct_student_application", benefitType: "other", categories: ["formacao"],
        isCourse: true, nationallyEligible: false, countryCode: remote ? null : "BR", stateCode: remote ? null : "SC", cityName,
        deadlineAt, deadlinePrecision: "date_only", requirementsText,
        amountText: "Confira no edital a eventual taxa de inscrição; valores de apoio não informados nesta página.",
        reviewStatus: "needs_information", opportunityStatus: deadlineAt < today ? "closed" : startAt > today ? "upcoming" : "open",
        evidenceJson: {
          deadline_at: { source_url: IFSC_TECHNICAL_URL, excerpt: window[0] },
          opportunity_status: { source_url: IFSC_TECHNICAL_URL, excerpt: window[0] },
          application_route: { source_url: IFSC_TECHNICAL_URL, excerpt: `Inscreva-se: ${applicationUrl}` },
          requirements: { source_url: IFSC_TECHNICAL_URL, excerpt: `${campus} ${selection} ${course} ${detail}` },
          location: { source_url: IFSC_TECHNICAL_URL, excerpt: `Câmpus ${campus}: ${course} ${detail}` },
        },
        extractionMethod: source.extractionMode,
        contentHash: crypto.createHash("sha256").update(`ifsc-technical-v1\n${title}\n${detail}\n${selection}\n${window[0]}`).digest("hex"),
      });
    }
  }
  return candidates;
}
