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
    const main = $("main").length === 1 ? $("main") : $("body");
    if (!main.find("h1").toArray().some(el => clean($(el).text()) === "Vestibular 2027")) fail();
    const lines = [...new Set(main.find("li").filter((_, el) => $(el).find("li").length === 0).toArray().map(el => clean($(el).text())))];
    const closeLines: string[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+[–—]\s+/);
      if (parts.length < 2 || !/^\d/.test(parts[0])) continue;
      const description = parts.slice(1).join(" — "), normalized = fold(description);
      if (/enem|indigena|vagas olimpicas|remanescentes|provao/.test(normalized)) continue;
      let id = "", kind: Stage["kind"] = "event";
      if (/abertura para inscricoes/.test(normalized)) { id = "registration-open"; kind = "registration"; }
      else if (/ultimo dia para inscricao|prazo final para inscricoes/.test(normalized)) {
        if (/prorrogad/.test(normalized)) {
          evidence.registration_extension = { source_url: spec.url, excerpt: line };
          continue; // Only a replacement row with its own full date can supersede it.
        }
        id = "registration-close"; kind = "registration"; closeLines.push(line);
      } else if (/matricula virtual/.test(normalized)) { id = `enrollment-${normalized.match(/(\d+)[aª.]?\s*chamada/)?.[1] || fail()}`; kind = "enrollment"; }
      else if (/divulgacao.*(?:aprovados|convocados)/.test(normalized)) { id = `result-${key(description.replace(/,.*$/, ""))}`; kind = "result"; }
      else if (/prova/.test(normalized) && !/divulgacao|locais|condicoes|recursos/.test(normalized)) { id = `exam-${key(description)}`; kind = "exam"; }
      else continue;
      const dates = portugueseDates(parts[0]);
      if (!["2026", "2027"].includes(dates.start.slice(0, 4))) fail();
      if (id === "registration-close") {
        const clock = /até\s+(?:às\s+|as\s+)?(\d{1,2})(?::(\d{2})|\s*horas|h(\d{2})?)/i.exec(description);
        if (clock) dates.start = time(dates.start, clock[1], clock[2] || clock[3] || "00");
      }
      if (kind === "enrollment") {
        const clocks = [...description.matchAll(/(\d{1,2})h(\d{2})/g)];
        if (clocks.length === 2) { dates.end = time(dates.end || dates.start, clocks[1][1], clocks[1][2]); dates.start = time(dates.start, clocks[0][1], clocks[0][2]); }
        else if (clocks.length) fail();
      }
      add(id, description.slice(0, 160), kind, dates, line);
      if (id === "registration-open") opening = dates.start;
      if (id === "registration-close") closing = dates.start;
    }
    if (closeLines.length !== 1 || !stages.some(s => s.kind === "exam") || !stages.some(s => s.kind === "result")) fail();
    registrationEvidence = stages.filter(s => s.kind === "registration").map(s => evidence[`calendar_${s.id}`].excerpt).join("; ");
  } else {
    // Fuvest's portal separates the registration range from its two exam panels.
    const main = $("main").length === 1 ? $("main") : $("body");
    main.find("h1,h2,h3,h4,p,div,li").append(" ");
    const text = clean(main.text());
    if (!/(?:FUVEST|VESTIBULAR(?: DA USP)?)\s*(?:[–—-]\s*)?2027/i.test(text)) fail();
    const registration = /(?:Inscriç(?:ão|ões)|Período)\s*:?\s*das\s+(\d{1,2})h\s+de\s+(\d{2}\/\d{2}\/2026)\s+até\s+(?:as|às)\s+(\d{1,2})h\s+de\s+(\d{2}\/\d{2}\/2026)/ig;
    const ranges = [...text.matchAll(registration)];
    if (!ranges.length || new Set(ranges.map(m => m.slice(1).join("|"))).size !== 1) fail();
    const reg = ranges[0];
    opening = time(numericDates(reg[2], "2026").start, reg[1]); closing = time(numericDates(reg[4], "2026").start, reg[3]);
    registrationEvidence = reg[0];
    add("registration-open", "Abertura das inscrições", "registration", { start: opening }, reg[0]);
    add("registration-close", "Encerramento das inscrições", "registration", { start: closing }, reg[0]);
    for (const [id, name, pattern] of [
      ["exam-1", "Prova da 1ª fase", /M[ÚU]LTIPLA ESCOLHA\s+(\d{2}\/\d{2}\/2026)/i],
      ["exam-2-day-1", "Prova da 2ª fase — primeiro dia", /DISSERTATIVA\s+(\d{2}\/\d{2}\/2026)\s+PRIMEIRA PROVA/i],
      ["exam-2-day-2", "Prova da 2ª fase — segundo dia", /(\d{2}\/\d{2}\/2026)\s+SEGUNDA PROVA/i],
    ] as const) {
      const match = pattern.exec(text); if (!match) fail();
      add(id, name, "exam", numericDates(match![1], "2026"), match![0]);
    }
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
    hasRetification: /prorrogad|retificaç/i.test(Object.values(evidence).map(e => e.excerpt).join(" ")) }];
}
