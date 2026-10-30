import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { calendarSource } from "./calendar-sources";
import { calendarDate, parseDiscovery, type Stage } from "./discovery";
import type { OfficialSource, OpportunityCandidate } from "./types";

const clean = (s: string) => s.replace(/\s+/gu, " ").trim();
const fold = (s: string) => clean(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const key = (s: string) => {
  const normalized = fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized.length <= 60 ? normalized : normalized.slice(0, 40) + "-" + crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
};
const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const fail = () => { throw new Error("Evidência do calendário oficial mudou ou está incompleta; coleta não aplicada"); };
const iso = (d: string, m: string | number, y: string) => calendarDate(`${y}-${String(m).padStart(2, "0")}-${d.padStart(2, "0")}`);
function time(date: string, h: string, m = "00") {
  if (+h > 23 || +m > 59) fail();
  return calendarDate(`${date}T${h.padStart(2, "0")}:${m}:00-03:00`);
}
type Dates = { start: string; end?: string };
function numericDates(value: string, year: string): Dates {
  const s = clean(value);
  const m = /^(?:(\d{1,2})\s+a\s+)?(\d{1,2})\/(\d{2})\/(\d{4})/.exec(s);
  if (!m || m[4] !== year) return fail();
  const end = iso(m[2], m[3], m[4]), start = m[1] ? iso(m[1], m[3], m[4]) : end;
  if (start > end) fail();
  return { start, ...(start !== end ? { end } : {}) };
}
/** Only an explicit year or the audited edition supplies the year. Never infer the next edition. */
function portugueseDates(value: string, year?: string): Dates {
  const s = fold(value).replace(/(\d)[º°ª]/g, "$1");
  const m = /^(\d{1,2}(?:(?:\s*,\s*|\s+e\s+|\s+a\s+)\d{1,2})*)\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(20\d{2}))?(?:\s+a\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(20\d{2}))?)?/.exec(s);
  if (!m || !months.includes(m[2]) || !(m[3] || year)) return fail();
  const days = m[1].match(/\d+/g)!;
  const start = iso(days[0], months.indexOf(m[2]) + 1, m[3] || year!);
  const end = m[4] ? iso(m[4], months.indexOf(m[5]) + 1, m[6] || m[3] || year!)
    : iso(days.at(-1)!, months.indexOf(m[2]) + 1, m[3] || year!);
  if (end < start || m[4] && !months.includes(m[5])) fail();
  // A list of disconnected days is not a continuous event interval.
  if (/[e,]/.test(m[1]) && days.some((day, i) => i > 0 && +day !== +days[i - 1] + 1)) fail();
  return { start, ...(end !== start ? { end } : {}) };
}

/** Expand HTML row spans so a level cannot accidentally inherit another level's date/time. */
function tableRows($: cheerio.CheerioAPI, table: cheerio.Cheerio<AnyNode>) {
  const rows: string[][] = [], spans: { value: string; remaining: number }[] = [];
  table.find("tr").each((_, tr) => {
    const row: string[] = [];
    spans.forEach((span, i) => { if (span.remaining > 0) { row[i] = span.value; span.remaining--; } });
    let col = 0;
    $(tr).children("td,th").each((_, td) => {
      while (row[col] !== undefined) col++;
      if (Number($(td).attr("colspan") || 1) !== 1) fail();
      const count = Number($(td).attr("rowspan") || 1);
      if (!Number.isInteger(count) || count < 1 || count > 20) fail();
      row[col] = clean($(td).text()); spans[col] = { value: row[col], remaining: count - 1 }; col++;
    });
    rows.push(row);
  });
  if (spans.some(s => s.remaining)) fail();
  return rows;
}

export function normalizeCalendarSource(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const spec = calendarSource(source.id);
  if (!spec) return [];
  if (source.baseUrl !== spec.url || source.listingUrls.length !== 1 || source.listingUrls[0] !== spec.url) fail();
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside,template,[hidden],del,s").remove();
  $("br").replaceWith(" ");
  const stages: Stage[] = [], evidence: OpportunityCandidate["evidenceJson"] = {};
  const add = (id: string, name: string, kind: Stage["kind"], dates: Dates, excerpt: string) => {
    if (stages.some(s => s.id === id) || name.length > 160) fail();
    stages.push({ id, name, kind, ...dates, sourceUrl: spec.url, checkedAt: now.toISOString() });
    evidence[`calendar_${id}`] = { source_url: spec.url, excerpt: clean(excerpt).slice(0, 2000) };
  };
  let opening = "", closing = "", registrationEvidence = "";

  if (source.id === "obmep-calendar-2026") {
    const table = $("#old-calendar-table");
    if (table.length !== 1) fail();
    const rows = tableRows($, table), headers = rows[0].map(fold);
    const expected = ["", "abertura das inscricoes", "encerramento das inscricoes", "provas da 1ª fase", "data-limite para envio dos cartoes-resposta", "divulgacao dos classificados (2ª fase)", "cadastro de professores", "provas da 2ª fase", "divulgacao dos premiados"];
    if (JSON.stringify(headers) !== JSON.stringify(expected)) fail();
    const matches = rows.filter(row => row[0] === spec.edition);
    if (matches.length !== 1 || matches[0].length !== 9) fail();
    const row = matches[0];
    const definitions: [number, string, Stage["kind"], string][] = [
      [1, "registration-open", "registration", "Abertura das inscrições das escolas"],
      [2, "registration-close", "registration", "Encerramento das inscrições das escolas"],
      [3, "exam-1", "exam", "Prova da 1ª fase"], [4, "answer-cards", "event", "Prazo para envio dos cartões-resposta"],
      [5, "result-1", "result", "Divulgação dos classificados para a 2ª fase"],
      [6, "teacher-registration", "registration", "Cadastro de professores (não é inscrição de estudantes)"],
      [7, "exam-2", "exam", "Prova da 2ª fase"], [8, "awards", "result", "Divulgação dos premiados"],
    ];
    for (const [i, id, kind, name] of definitions) add(id, name, kind, portugueseDates(row[i], spec.edition), `${spec.edition}: ${headers[i]} — ${row[i]}`);
    opening = stages[0].start; closing = stages[1].start;
    registrationEvidence = `${spec.edition}: abertura ${row[1]}; encerramento ${row[2]}. Inscrição pelas escolas; cadastro de professores é outra etapa.`;
  } else if (source.id === "obi-calendar-2026") {
    const content = $("section.inner-page .row.content").first();
    if (!content.length) fail();
    const heading = content.find("h2").filter((_, el) => fold($(el).text()) === "inscricoes");
    const list = heading.next("ul");
    const startLine = clean(list.children("li").first().text());
    const startMatch = /Abertura das inscrições:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(startLine);
    if (!startMatch) fail();
    opening = numericDates(startMatch![1], spec.edition).start;
    add("registration-open", "Abertura das inscrições", "registration", { start: opening }, startLine);
    const deadlines: string[] = [];
    for (const [prefix, label, headingText] of [["school", "Cadastro de escolas", "cadastro de escolas"], ["competitor", "Inscrição de competidores", "inscricao de competidores"]]) {
      const parent = list.children("li").filter((_, el) => fold($(el).clone().children("ul").remove().end().text()).startsWith(headingText));
      const children = parent.children("ul").children("li");
      if (parent.length !== 1 || children.length !== 3) fail();
      children.each((_, el) => {
        const line = clean($(el).text()), parts = line.split(/:\s*até\s*/i);
        const modality = /Iniciação/.test(parts[0]) ? "iniciacao" : /Competição Feminina/.test(parts[0]) ? "cf-obi" : /Programação/.test(parts[0]) ? "programacao" : fail();
        const date = numericDates(parts[1] || "", spec.edition).start;
        const clock = /,\s*(\d{1,2}):(\d{2})/.exec(parts[1]);
        const end = clock ? time(date, clock[1], clock[2]) : date;
        add(`${prefix}-${modality}`, `${label} — ${modality === "cf-obi" ? "CF-OBI" : modality === "iniciacao" ? "Iniciação" : "Programação"}`, "registration", { start: end }, `${label}: ${line}`);
        if (prefix === "competitor") deadlines.push(end);
      });
    }
    closing = deadlines.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)!;
    registrationEvidence = clean(list.text());
    const tables = content.find("table");
    if (tables.length !== 4) fail();
    tables.each((index, el) => {
      const table = $(el), title = clean(table.prev("h3").text());
      if (index < 3 ? !title.startsWith(`Fase ${index + 1}`) : !title.includes("Competição Feminina")) fail();
      const rows = tableRows($, table), headers = rows.shift()!.map(fold);
      if (headers[0] !== "modalidade" || !headers.includes("dia") || !headers.includes("horario")) fail();
      const groups = new Map<string, { dates: Dates; levels: string[]; modality: string; excerpt: string }>();
      if (rows.length !== (index === 3 ? 4 : 8)) fail();
      for (const row of rows) {
        if (row.length !== headers.length || !/^(Iniciação|Programação) Nível (Júnior|Mirim|1|2|Sênior)$/.test(row[0])) fail();
        const dates = numericDates(row[headers.indexOf("dia")], spec.edition);
        const horario = row[headers.indexOf("horario")];
        const clock = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(horario);
        if (clock) {
          if (dates.end) fail();
          dates.end = time(dates.start, clock[3], clock[4]); dates.start = time(dates.start, clock[1], clock[2]);
        } else if (!/horário à escolha da escola/i.test(horario)) fail();
        const modality = row[0].split(" Nível ")[0], level = row[0].split(" Nível ")[1];
        const groupKey = `${modality}|${dates.start}|${dates.end || ""}`;
        const group = groups.get(groupKey) || { dates, levels: [], modality, excerpt: "" };
        group.levels.push(level); group.excerpt += `${row.join(" | ")}; `; groups.set(groupKey, group);
      }
      for (const group of groups.values()) {
        const label = `${index === 3 ? "CF-OBI" : `Fase ${index + 1}`} — ${group.modality} — níveis ${group.levels.join(", ")}`;
        add(key(label), label, "exam", group.dates, `${title}: ${group.excerpt}`);
      }
    });
    const weekHeading = content.find("h2").filter((_, el) => clean($(el).text()) === "Semana Olímpica da OBI");
    // Text nodes between the two headings, not international competitions later on the page.
    let week = "";
    for (let node = weekHeading[0]?.nextSibling; node; node = node.nextSibling) {
      if (node.type === "tag" && node.name === "h2") break;
      week += $(node).text();
    }
    const match = /de\s+(\d{1,2}\s+de\s+dezembro\s+a\s+\d{1,2}\s+de\s+dezembro)/i.exec(clean(week));
    if (!match) fail();
    add("olympic-week", "Semana Olímpica da OBI — participação conforme convocação", "event", portugueseDates(match![1], spec.edition), week);
  } else if (source.id === "comvest-vestibular-2027") {
    const content = $(".single-post__post-content");
    const text = clean(content.text());
    if (content.length !== 1 || !text.includes("Calendário Vestibular Unicamp 2027") ||
      !/Comvest.*prorrogou o período de inscrições para o Vestibular Unicamp 2027/.test(text) ||
      !$("meta[property='article:published_time']").attr("content")?.startsWith("2026-")) fail();
    // This later Comvest-authored notice supersedes the August 3 announcement.
    const closingMatch = /Inscrições: até (\d{1,2} de [a-zç]+ de 2026), às (\d{1,2}) horas/i.exec(text);
    if (!closingMatch) fail();
    closing = time(portugueseDates(closingMatch![1]).start, closingMatch![2]);
    registrationEvidence = `Prorrogação do Vestibular Unicamp 2027. ${closingMatch![0]}`;
    evidence.registration_extension = { source_url: spec.url, excerpt: registrationEvidence };
    const heading = content.find("p").filter((_, el) => clean($(el).text()) === "Calendário Vestibular Unicamp 2027");
    const table = heading.next("figure").find("table");
    if (heading.length !== 1 || table.length !== 1) fail();
    const rows = tableRows($, table);
    if (rows.length !== 12 || rows.some(row => row.length !== 2)) fail();
    const expected = ["Divulgação dos contemplados com a Isenção da Taxa", "Inscrições Vestibular Unicamp 2026",
      "Prova de Habilidades Específicas – Música", "1ª fase", "2ª fase", "Provas de Habilidades Específicas",
      "Divulgação dos aprovados em 1ª chamada", "Matrícula virtual da 1ª Chamada",
      "Divulgação dos aprovados em 2ª Chamada", "Matrícula virtual da 2ª Chamada",
      "Divulgação dos aprovados em 3ª Chamada", "Matrícula virtual da 3ª Chamada"];
    rows.forEach((row, i) => {
      // The publisher mislabeled this one row 2026. Heading/prose explicitly identify admission 2027.
      const label = i === 1 ? row[0].replace(/Unicamp 2027$/, "Unicamp 2026") : row[0].replace(/[-–—]/g, "–");
      if (fold(label) !== fold(expected[i])) fail();
    });
    const numeric = (value: string, year: string): Dates => {
      const m = /^(\d{1,2})(?:\/(\d{1,2}))?(?: (a|e) (\d{1,2}))?\/(\d{1,2})\/(20\d{2})$/.exec(value);
      if (!m || m[6] !== year || m[3] === "e" && +m[4] !== +m[1] + 1) return fail();
      const start = iso(m[1], m[2] || m[5], m[6]);
      const end = iso(m[4] || m[1], m[5], m[6]);
      if (end < start) fail();
      return { start, ...(end !== start ? { end } : {}) };
    };
    const registration = numeric(rows[1][1], "2026");
    if (registration.end !== closing.slice(0, 10)) fail();
    opening = registration.start;
    add("registration-open", "Abertura das inscrições", "registration", { start: opening }, rows[1].join(" — "));
    add("registration-close", "Encerramento das inscrições — prazo prorrogado", "registration", { start: closing }, registrationEvidence);
    add("exam-music", "Habilidades específicas — envio de vídeos de Música", "exam", numeric(rows[2][1], "2026"), rows[2].join(" — "));
    const clock = /As duas fases serão aplicadas no período da manhã, com início às (\d{1,2}) horas/.exec(text);
    if (!clock) fail();
    const phase1 = numeric(rows[3][1], "2026");
    if (phase1.end) fail();
    add("exam-1", "Prova da 1ª fase", "exam", { start: time(phase1.start, clock![1]) }, `${rows[3].join(" — ")}; ${clock![0]}`);
    const phase2 = numeric(rows[4][1], "2026");
    if (!phase2.end || Date.parse(phase2.end) - Date.parse(phase2.start) !== 86_400_000) fail();
    for (const [i, date] of [phase2.start, phase2.end!].entries()) {
      add(`exam-2-day-${i + 1}`, `Prova da 2ª fase — ${i + 1}º dia`, "exam", { start: time(date, clock![1]) }, `${rows[4].join(" — ")}; ${clock![0]}`);
    }
    add("exam-skills", "Habilidades específicas — Artes Cênicas, Artes Visuais e Dança", "exam", numeric(rows[5][1], "2026"), rows[5].join(" — "));
    for (let call = 1; call <= 3; call++) {
      const result = rows[4 + call * 2], enrollment = rows[5 + call * 2];
      const resultDate = numeric(result[1], spec.edition);
      add(`result-${call}`, `Divulgação dos aprovados — ${call}ª chamada`, "result", resultDate, result.join(" — "));
      let dates: Dates;
      if (call === 3) dates = numeric(enrollment[1], spec.edition);
      else {
        const m = /^(\d{2})h(\d{2}) do dia (\d{2})\/(\d{2}) às (\d{2})h(\d{2}) do dia (\d{2})\/(\d{2})$/.exec(enrollment[1]);
        if (!m) fail();
        dates = { start: time(iso(m![3], m![4], spec.edition), m![1], m![2]), end: time(iso(m![7], m![8], spec.edition), m![5], m![6]) };
      }
      if (dates.start < resultDate.start) fail();
      add(`enrollment-${call}`, `Matrícula virtual — ${call}ª chamada`, "enrollment", dates, `${result.join(" — ")}; ${enrollment.join(" — ")}`);
    }
  } else {
    const content = $("article#post-1040750 > .entry-content");
    const text = clean(content.text());
    if (content.length !== 1 || !text.includes("Cronograma do Vestibular 2027") ||
      !text.includes("Texto: Assessoria de Imprensa da Fuvest") ||
      !$("meta[property='article:published_time']").attr("content")?.startsWith("2026-")) fail();
    const heading = content.children("p").filter((_, el) => clean($(el).text()) === "Principais datas:");
    const lines = heading.next("ul").children("li");
    if (heading.length !== 1 || lines.length !== 9) fail();
    const definitions: Record<string, [string, Stage["kind"], string]> = {
      "abertura das inscricoes": ["registration-open", "registration", "Abertura das inscrições"],
      "encerramento das inscricoes": ["registration-close", "registration", "Encerramento das inscrições"],
      "prova da 1ª fase": ["exam-1", "exam", "Prova da 1ª fase"],
      "divulgacao dos convocados e dos locais da 2ª fase": ["result-2", "result", "Convocação para a 2ª fase"],
      "provas da 2ª fase": ["exam-2", "exam", "Prova da 2ª fase"],
      "provas de competencias especificas": ["exam-skills", "exam", "Provas de Competências Específicas"],
      "divulgacao da primeira chamada para matricula": ["result-1", "result", "Primeira chamada para matrícula"],
    };
    lines.each((_, el) => {
      const line = clean($(el).text()), parts = line.split(/\s+[–—]\s+/);
      if (parts.length !== 2) fail();
      const definition = definitions[fold(parts[1])];
      // Materials/local announcements are not exam dates; the October location date was later updated.
      if (!definition) {
        if (!["divulgacao do guia de provas", "divulgacao dos locais de prova da 1ª fase"].includes(fold(parts[1]))) fail();
        return;
      }
      const [id, kind, name] = definition;
      const dates = portugueseDates(parts[0], "2026");
      if (dates.start.slice(0, 4) !== (id === "result-1" ? "2027" : "2026")) fail();
      if (id === "exam-2") {
        if (!dates.end || Date.parse(dates.end) - Date.parse(dates.start) !== 86_400_000) fail();
        [dates.start, dates.end!].forEach((date, i) => add(`${id}-day-${i + 1}`, `${name} — ${i + 1}º dia`, kind, { start: date }, line));
      } else {
        if (id !== "exam-skills" && dates.end) fail();
        add(id, name, kind, dates, line);
      }
      if (id === "registration-open") opening = dates.start;
      if (id === "registration-close") closing = dates.start;
    });
    if (stages.length !== 8) fail();
    registrationEvidence = stages.filter(s => s.kind === "registration").map(s => evidence[`calendar_${s.id}`].excerpt).join("; ");
  }

  if (!opening || !closing || Date.parse(closing) < Date.parse(opening)) fail();
  const discovery = parseDiscovery({ primaryType: spec.subtype === "olimpiada" ? "competicoes" : "formacao", subtype: spec.subtype,
    areas: [...spec.areas], editions: [{ id: spec.edition, name: spec.edition, stages }] }, source);
  const instant = (s: string, end: boolean) => Date.parse(s.length === 10 ? `${s}T${end ? "23:59:59" : "00:00:00"}-03:00` : s);
  const status = instant(closing, true) < now.getTime() ? "closed" : instant(opening, false) > now.getTime() ? "upcoming" : "open";
  evidence.deadline_at = evidence.opportunity_status = { source_url: spec.url, excerpt: registrationEvidence.slice(0, 2000) };
  return [{ officialSourceId: spec.id, title: spec.name, institution: spec.institution, sourcePageUrl: spec.url, applicationUrl: spec.url,
    applicantType: "mixed", applicationRoute: spec.subtype === "olimpiada" ? "institutional_call" : "direct_application",
    benefitType: "other", categories: [discovery.primaryType as "competicoes" | "formacao"], isCourse: false,
    nationallyEligible: false, geographicScopeKind: "unknown", countryCode: null, stateCode: null, cityName: null,
    deadlineAt: closing, deadlinePrecision: closing.length === 10 ? "date_only" : "exact_datetime", opportunityStatus: status,
    reviewStatus: "needs_information", requirementsText: spec.subtype === "olimpiada"
      ? "Inscrição e participação conforme o regulamento oficial e a escola responsável. Confira modalidade, nível e convocação de cada etapa; o calendário não comprova elegibilidade."
      : "Processo de vestibular; conferir requisitos, taxa, modalidades de concorrência e convocação no regulamento oficial. Não representa inscrição pelo Enem nem garantia de vaga.",
    amountText: "Calendário oficial; benefícios e condições financeiras não inferidos.", extractionMethod: "html", discovery, evidenceJson: evidence,
    // checkedAt changes on every fetch; only source facts define the content revision.
    contentHash: crypto.createHash("sha256").update(JSON.stringify({ id: spec.id, status, evidence, stages: stages.map(({ checkedAt: _checkedAt, ...stage }) => { void _checkedAt; return stage; }) })).digest("hex"),
    hasRetification: /prorrog|retificaç/i.test(Object.values(evidence).map(e => e.excerpt).join(" ")) }];
}
