import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const SENAC_PSG_URL = "https://portal.sc.senac.br/cursos-gratuitos";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
function dateOnly(value: unknown) {
  const date = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})T/.exec(value)?.[1] : undefined;
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeSenacPsgCourses(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== "senac-sc-psg-open-cohorts") return [];
  const $ = cheerio.load(html);
  const pageText = $("body").clone().find("script,style,noscript").remove().end().text().replace(/\s+/g, " ");
  const income = /renda familiar mensal per capita de até 2 salários mínimos/i.exec(pageText)?.[0];
  if (!/Programa Senac de Gratuidade/i.test(pageText) || !/100%\s*GRATUITO\s*PSG/i.test(pageText) || !income) throw new Error("Programa PSG não confirmado");
  // Read the organizer's embedded JSON, never execute its scripts or call an external API.
  const embedded = $("script").toArray().map((element) => $(element).html() ?? "")
    .map((script) => /window\.cursosData\s*=\s*(\[[\s\S]*\]);\s*$/.exec(script)?.[1]).find(Boolean);
  if (!embedded) throw new Error("Catálogo PSG não confirmado");
  let courses: unknown;
  try { courses = JSON.parse(embedded); } catch { throw new Error("Catálogo PSG inválido"); }
  if (!Array.isArray(courses)) throw new Error("Catálogo PSG inválido");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const programmes = new Map<string, OpportunityCandidate>();
  for (const course of courses) {
    if (!record(course) || course.permitirPublicarInternet !== true || course.matriculasAbertas !== true ||
      course.estadoDoPlanoDoCurso !== "Disponivel" || !Number.isInteger(course.planoDoCursoId) ||
      !Array.isArray(course.requisitos) || !Array.isArray(course.turmasLiberadasParaMatricula)) continue;
    const name = text(course.titulo);
    const requirements = course.requisitos.flatMap((group: unknown) => record(group) && Array.isArray(group.requisitos)
      ? group.requisitos.map(text).filter(Boolean) : []);
    // A training place conditional on an existing employment contract is not a job vacancy.
    if (!name || !requirements.length || /aprendizagem profissional|mestrado|doutorado|pós-graduação/i.test(name) ||
      requirements.some((requirement) => /contrato de trabalho da aprendizagem/i.test(requirement))) continue;
    for (const cohort of course.turmasLiberadasParaMatricula) {
      if (!record(cohort) || cohort.estadoDescricao !== "Liberado Para Matrícula" || cohort.divulgacaoOnline !== true ||
        cohort.planoDoCursoId !== course.planoDoCursoId || !Number.isInteger(cohort.id) || !Array.isArray(cohort.recursosFinanceiros)) continue;
      const free = cohort.recursosFinanceiros.filter((resource: unknown) => record(resource) && text(resource.nome).toUpperCase() === "PSG" &&
        resource.tipoDeRecursoNome === "Gratuito" && Number.isInteger(resource.vagasDisponiveis) && Number(resource.vagasDisponiveis) > 0);
      if (!free.length) continue;
      const deadline = dateOnly(cohort.dataDeEncerramentoPresencial);
      const start = dateOnly(cohort.dataPeriodoExecucaoInicial);
      const end = dateOnly(cohort.dataPeriodoExecucaoFinal);
      const city = text(cohort.localidade), unit = text(cohort.nomeUnidadeOperativa), mode = text(cohort.formaDeExecucao);
      if (!deadline || deadline < today || !start || !end || end < start || deadline > end || !city || !unit ||
        !["Presencial", "Flexível"].includes(mode)) continue;
      const title = `${name} — Senac PSG ${city}, início ${start}`;
      const detail = `${unit}; ${mode}; período ${start} a ${end}; matrícula liberada até ${deadline}; ` +
        `vagas PSG disponíveis: ${free.map((resource) => Number((resource as Record<string, unknown>).vagasDisponiveis)).join(" / ")}.`;
      const key = `${slug(name)}|${slug(city)}|${start}`;
      const existing = programmes.get(key);
      if (existing) {
        // Parallel classes, shifts and plan versions of the same programme/edition are one card.
        existing.requirementsText += ` Oferta paralela: ${detail} Requisitos: ${requirements.join("; ")}.`;
        existing.evidenceJson.opportunity_status.excerpt += ` Turma ${cohort.id}: ${detail}`;
        existing.evidenceJson.requirements.excerpt += ` ${requirements.join("; ")}`;
        if (deadline < existing.deadlineAt!) {
          existing.deadlineAt = deadline;
          existing.evidenceJson.deadline_at.excerpt = `dataDeEncerramentoPresencial: ${deadline} (primeiro prazo das ofertas paralelas).`;
        }
        continue;
      }
      programmes.set(key, {
        officialSourceId: source.id, title, institution: source.institutionName, sourcePageUrl: SENAC_PSG_URL,
        applicationUrl: SENAC_PSG_URL, applicantType: "mixed", applicationRoute: "direct_application",
        benefitType: "other", categories: ["formacao"], isCourse: true, nationallyEligible: false,
        countryCode: "BR", stateCode: "SC", cityName: city, geographicScopeKind: "city",
        deadlineAt: deadline, deadlinePrecision: "date_only", opportunityStatus: "open", reviewStatus: "needs_information",
        requirementsText: `${detail} Requisitos: ${requirements.join("; ")}. PSG: ${income}. ` +
          "Consulte a unidade indicada na fonte oficial para efetivar a matrícula gratuita. Registrar interesse não garante matrícula ou reserva de vaga.",
        amountText: "Curso gratuito pelo Programa Senac de Gratuidade (PSG), sujeito aos requisitos de renda e às vagas disponíveis. Remuneração não informada.",
        evidenceJson: {
          deadline_at: { source_url: SENAC_PSG_URL, excerpt: `Turma ${cohort.id}: dataDeEncerramentoPresencial: ${deadline}.` },
          opportunity_status: { source_url: SENAC_PSG_URL, excerpt: `matriculasAbertas: true; Liberado Para Matrícula; Turma ${cohort.id}: ${detail}` },
          requirements: { source_url: SENAC_PSG_URL, excerpt: `${requirements.join("; ")}. ${income}` },
          location: { source_url: SENAC_PSG_URL, excerpt: `Senac Santa Catarina: localidade ${city}; unidade ${unit}; ${mode}.` },
          benefit: { source_url: SENAC_PSG_URL, excerpt: `100% GRATUITO PSG; ${detail}` },
        },
        extractionMethod: source.extractionMode, contentHash: "",
      });
    }
  }
  return [...programmes.values()].map((candidate) => ({ ...candidate,
    contentHash: crypto.createHash("sha256").update(`senac-psg-v1\n${candidate.title}\n${candidate.deadlineAt}\n${candidate.requirementsText}`).digest("hex"),
  }));
}
