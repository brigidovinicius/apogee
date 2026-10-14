import type { OpportunityCandidate, OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";

export function deadlineIsCurrent(candidate: Pick<OpportunityCandidate, "deadlineAt" | "deadlinePrecision">, now = new Date()) {
  if (candidate.deadlinePrecision === "continuous_flow") return !candidate.deadlineAt;
  if (!candidate.deadlineAt) return false;
  const time = Date.parse(candidate.deadlineAt);
  if (!Number.isFinite(time)) return false;
  if (candidate.deadlinePrecision === "date_only") {
    const date = candidate.deadlineAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return false;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    return date >= today;
  }
  return candidate.deadlinePrecision === "exact_datetime" && time >= now.getTime();
}

export function publicationIssue(candidate: OpportunityCandidate, source: OfficialSource, now = new Date()): string | null {
  if (!source.active || candidate.officialSourceId !== source.id || !isOfficialSourceUrl(candidate.sourcePageUrl, [source])) return "invalid_source";
  if (candidate.sourceConflict) return "source_conflict";
  if (!["open", "upcoming"].includes(candidate.opportunityStatus)) return "status_unconfirmed";
  if (!deadlineIsCurrent(candidate, now)) return "invalid_deadline";
  if (candidate.applicationRoute === "unclear") return "application_route_unconfirmed";
  for (const field of ["deadline_at", "opportunity_status"]) {
    const evidence = candidate.evidenceJson[field];
    if (!evidence?.excerpt.trim() || !isOfficialSourceUrl(evidence.source_url, [source])) return "missing_evidence";
  }
  if (candidate.nationallyEligible && (candidate.stateCode || candidate.cityName || !candidate.evidenceJson.national_scope)) return "national_scope_unconfirmed";
  return null;
}

export function detectOpportunityStatus(text: string, now = new Date()): OpportunityCandidate["opportunityStatus"] {
  if (/inscriç(?:ão|ões).{0,35}(?:encerrad|finalizad)|prazo.{0,15}encerrad/i.test(text)) return "closed";
  const range = /inscriç(?:ão|ões)\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+a\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text);
  if (range) {
    const date = (day: string, month: string, year: string) => {
      const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const parsed = new Date(`${iso}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
    };
    const start = date(range[1], range[2], range[3]);
    const end = date(range[4], range[5], range[6]);
    if (!start || !end || end < start) return "unknown";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    return end < today ? "closed" : start > today ? "upcoming" : "open";
  }
  // An explicit start date takes precedence over generic promotional copy.
  const starts = /inscriç(?:ão|ões)\s+(?:de|a partir de|a partir do dia|abrem em|iniciam em)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text);
  if (starts) {
    const date = `${starts[3]}-${starts[2].padStart(2, "0")}-${starts[1].padStart(2, "0")}`;
    const parsed = new Date(`${date}T00:00:00-03:00`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "unknown";
    return parsed > now ? "upcoming" : "open";
  }
  if (/inscriç(?:ão|ões)\s+(?:(?:estão|seguem|continuam|permanecem)\s+)?abertas|inscriç(?:ão|ões).{0,30}fluxo contínuo/i.test(text)) return "open";
  return "unknown";
}
