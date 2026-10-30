import crypto from "node:crypto";
import type { OfficialSource, OpportunityCandidate } from "./types";

const months: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isoDate(month: string, day: string, year: string) {
  const number = months[month.toLowerCase()];
  if (!number) return null;
  const iso = `${year}-${String(number).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function normalizeSpaceApps(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "nasa-space-apps-2026" || input.url !== "https://www.spaceappschallenge.org/2026/") return null;
  const text = input.text.replace(/\s+/g, " ").trim();
  const title = /Welcome to the (20\d{2}) NASA Space Apps Challenge!/i.exec(text);
  const start = /REGISTER FOR THE HACKATHON\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})/i.exec(text);
  const end = /You can register up until the hackathon closes on\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i.exec(text);
  const global = /choose the virtual Universal Event/i.exec(text);
  if (!title || !start || !end || !global || title[1] !== start[3]) return null;
  const startsOn = isoDate(start[1], start[2], start[3]);
  const deadlineAt = isoDate(end[1], end[2], title[1]);
  if (!startsOn || !deadlineAt || deadlineAt < startsOn) return null;
  // The edition page announces the global dates separately from registration.
  // Local-event hours must never become a timezone for the worldwide event.
  const event = /Register to join us on\s+([A-Za-z]+)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})(?:,\s*(20\d{2}))?[.!]/i.exec(text);
  const eventStartsAt = event ? isoDate(event[1], event[2], title[1]) : null;
  const eventEndsAt = event ? isoDate(event[1], event[3], title[1]) : null;
  if (event && (!eventStartsAt || !eventEndsAt || eventEndsAt < eventStartsAt || event[4] && event[4] !== title[1])) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const opportunityStatus = deadlineAt < today ? "closed" : startsOn > today ? "upcoming" : "open";
  const registerExcerpt = text.slice(start.index, Math.min(text.length, end.index + end[0].length));
  const scopeExcerpt = text.slice(Math.max(0, global.index - 130), global.index + global[0].length + 100);
  const evidence = { source_url: input.url, excerpt: registerExcerpt.slice(0, 1000) };
  const stages = [{ id: "registration", name: "Inscrições no hackathon", kind: "registration" as const,
    start: startsOn, end: deadlineAt, sourceUrl: input.url, checkedAt: now.toISOString() },
    ...(eventStartsAt && eventEndsAt ? [{ id: "hackathon", name: "Realização do hackathon", kind: "event" as const,
      start: eventStartsAt, end: eventEndsAt, sourceUrl: input.url, checkedAt: now.toISOString() }] : [])];
  return {
    officialSourceId: input.source.id,
    title: `NASA Space Apps Challenge ${title[1]}`,
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType: "mixed",
    applicationRoute: "direct_student_application",
    benefitType: "unpaid_opportunity",
    categories: ["competicoes", "eventos"],
    isCourse: false,
    nationallyEligible: false,
    geographicScopeKind: "global",
    countryCode: null,
    ...(eventStartsAt ? { eventStartsAt } : {}),
    discovery: { primaryType: "competicoes", subtype: "hackathon", areas: [],
      editions: [{ id: `space-apps-${title[1]}`, name: `NASA Space Apps ${title[1]}`, stages }] },
    deadlineAt,
    deadlinePrecision: "date_only",
    requirementsText: "Registre-se na página oficial e escolha um evento local ou o Universal Event virtual.",
    amountText: "Consulte a página oficial para as condições de participação.",
    stateCode: null,
    cityName: null,
    reviewStatus: "needs_information",
    opportunityStatus,
    evidenceJson: {
      deadline_at: evidence,
      opportunity_status: evidence,
      application_route: evidence,
      requirements: { source_url: input.url, excerpt: scopeExcerpt.slice(0, 1000) },
      ...(event ? { event_start: { source_url: input.url, excerpt: event[0] } } : {}),
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(JSON.stringify(["space-apps-v2", title[1], startsOn, deadlineAt, eventStartsAt, eventEndsAt])).digest("hex"),
  };
}
