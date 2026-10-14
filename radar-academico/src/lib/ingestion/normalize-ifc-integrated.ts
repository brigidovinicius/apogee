import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const IFC_COURSES_URL = "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/cursos/";
export const IFC_APPLICATION_URL = "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/inscricoes/";

const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };

export function normalizeIfcIntegratedCourses(
  coursesHtml: string,
  applicationHtml: string,
  source: OfficialSource,
  now = new Date(),
): OpportunityCandidate[] {
  if (source.id !== "ifc-integrated-technical-2027") return [];
  const $courses = cheerio.load(coursesHtml);
  const $application = cheerio.load(applicationHtml);
  const applicationText = $application(".entry-content").text().replace(/\s+/g, " ").trim();
  const date = /Inscrições até (\d{1,2}) de (\p{L}+) de (20\d{2})/iu.exec(applicationText);
  const route = /Acesse candidato\.ifc\.edu\.br para fazer sua inscrição/i.exec(applicationText);
  const fee = /Valor da Taxa de Inscrição\*?\s*R\$\s*([\d.,]+)/i.exec(applicationText);
  if (!date || !route || !fee || date[3] !== "2026") return [];
  const month = months[date[2].toLowerCase()];
  const deadlineAt = month && `${date[3]}-${month}-${date[1].padStart(2, "0")}`;
  if (!deadlineAt || new Date(`${deadlineAt}T00:00:00Z`).toISOString().slice(0, 10) !== deadlineAt) return [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const opportunityStatus = deadlineAt >= today ? "open" : "closed";
  const candidates: OpportunityCandidate[] = [];
  $courses(".entry-content .cursos-campus-title").each((_, heading) => {
    const cityName = $courses(heading).text().trim();
    if (!cityName || cityName.length > 100) return;
    $courses(heading).next(".cursos-cards-grid").find(".curso-card").each((_, card) => {
      const course = $courses(card).find(".curso-card-header span").text().trim();
      const cardText = $courses(card).text().replace(/\s+/g, " ").trim();
      const seats = /Vagas:\s*(\d+)/i.exec(cardText);
      const selection = /Forma de seleção:\s*Exame de Classificação/i.exec(cardText);
      if (!course || !seats || Number(seats[1]) < 1 || !selection) return;
      const title = `Técnico integrado em ${course} — IFC ${cityName} 2027`;
      candidates.push({
        officialSourceId: source.id, title, institution: source.institutionName,
        sourcePageUrl: IFC_COURSES_URL,
        applicationUrl: "https://candidato.ifc.edu.br",
        applicantType: "high_school_student", applicationRoute: "direct_student_application",
        benefitType: "other", categories: ["formacao"], isCourse: true, nationallyEligible: false,
        countryCode: "BR", stateCode: "SC", cityName,
        deadlineAt, deadlinePrecision: "date_only",
        requirementsText: `Curso técnico integrado ao ensino médio no campus ${cityName}. Seleção por Exame de Classificação; ${seats[1]} vagas para este curso e campus. Consulte o edital para os requisitos de ingresso.`,
        amountText: `Taxa de inscrição de R$ ${fee[1]}; consulte o edital para condições e benefícios.`,
        reviewStatus: "needs_information", opportunityStatus,
        evidenceJson: {
          deadline_at: { source_url: IFC_APPLICATION_URL, excerpt: date[0] },
          opportunity_status: { source_url: IFC_APPLICATION_URL, excerpt: date[0] },
          application_route: { source_url: IFC_APPLICATION_URL, excerpt: route[0] },
          requirements: { source_url: IFC_COURSES_URL, excerpt: `${cityName} ${course} ${seats[0]} ${selection[0]}` },
          location: { source_url: IFC_COURSES_URL, excerpt: `${cityName} ${course}` },
          amount: { source_url: IFC_APPLICATION_URL, excerpt: fee[0] },
        },
        extractionMethod: source.extractionMode,
        contentHash: crypto.createHash("sha256").update(`ifc-integrated-v1\n${cityName}\n${course}\n${cardText}\n${date[0]}\n${fee[0]}`).digest("hex"),
      });
    });
  });
  return candidates;
}
