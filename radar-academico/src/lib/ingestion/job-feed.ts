import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { readEmployment, type Employment } from "../../../contracts/employment";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { jobBoard, jobFeedUrl, jobPostingUrl, jobUrlPostingId } from "./job-sources";

const object = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const str = (v: unknown, cap = 30_000) => typeof v === "string" ? v.trim().slice(0, cap) : "";
function plain(value: unknown) {
  const $ = cheerio.load(str(value)); $("script,style,noscript").remove();
  return $.text().replace(/\s+/g, " ").trim();
}
export function roleFamily(title: string, description: string): Employment["roleFamily"] | null {
  if (/\bforward[ -]deployed (?:software )?engineer\b/i.test(title)) return "fde";
  return /\b(?:applied ai|ai solutions?|ai implementation|agent deployment) engineer\b/i.test(title) &&
    /\b(?:customers?|clients?|enterprise)\b/i.test(description) && /\b(?:production|integrat\w*|deploy\w*)\b/i.test(description) ? "ai_implementation" : null;
}
export function brazilEligibility(text: string): { value: Employment["brazilEligibility"]; excerpt: string } {
  // Explicit exclusions take precedence over generic worldwide marketing language.
  const excluded = /(?:not (?:available|open|hiring|hire)|exclud(?:e|es|ing))[^.!?]{0,50}\b(?:brazil|brasil)\b|\b(?:only|must (?:reside|live|be (?:based|located|resident))|residen(?:ts|ce) (?:of|in))[^.!?]{0,45}\b(?:united states|usa|us|canada|europe|european union|uk|united kingdom|india|emea)\b|\b(?:us|usa|uk|eu|emea)[ -]only\b/i.exec(text);
  if (excluded) return { value: "excluded", excerpt: excluded[0] };
  const positive = [
    /\b(?:remote|remot[oa])(?:[\s,|:–—-]+(?:(?:based|located|resident)\s+)?(?:in|from|within|no|na|em))?[\s,|:–—-]+(?:brazil|brasil)\b/i,
    /\b(?:you (?:must|should|can|may) be|(?:candidates?|applicants?) (?:must|should|may) be|must be|need to be)\s+(?:based|located|resident)\s+in\s+(?:brazil|brasil)\b/i,
    /\b(?:brazil|brasil)\s*[-–—,|/]\s*(?:remote|remot[oa])\b/i,
    /\b(?:we (?:hire|are hiring)|(?:you|candidates?|applicants?) (?:may|can) work)[^.!?]{0,20}\b(?:worldwide|anywhere in the world)\b/i,
    /\b(?:open to|available to) (?:candidates?|applicants?)\s+(?:from\s+)?(?:all countries|worldwide)\b/i,
  ].map(pattern => pattern.exec(text)).find(Boolean);
  return positive ? { value: "confirmed", excerpt: positive[0] } : { value: "unknown", excerpt: "Residência permitida no Brasil não confirmada no anúncio." };
}
function salaryOf(job: Record<string, unknown>): Employment["salary"] {
  const c = object(job.compensation);
  const components = c?.summaryComponents;
  if (!Array.isArray(components)) return null;
  const values = components.map(object).filter(c => c?.compensationType === "Salary" &&
    typeof c.minValue === "number" && typeof c.maxValue === "number" && str(c.currencyCode) && str(c.interval));
  // Multiple geographic tiers must not become a fabricated universal range.
  if (values.length !== 1) return null;
  const s = values[0]!;
  return { min: Number(s.minValue), max: Number(s.maxValue), currency: str(s.currencyCode), interval: str(s.interval) };
}
export type JobFeed = { candidates: OpportunityCandidate[]; listedRequisitions: string[]; hiddenRequisitions: string[] };
/** A complete, bounded official snapshot. Malformed/partial feeds never prove closure. */
export function parseJobFeed(payload: unknown, source: OfficialSource): JobFeed {
  const b = jobBoard(source.id), data = object(payload);
  if (!b || source.extractionMode !== "api" || source.listingUrls.length !== 1 || source.listingUrls[0] !== jobFeedUrl(source.id) ||
    !data || !Array.isArray(data.jobs) || data.jobs.length > 2000 ||
    (b.provider === "ashby" && data.apiVersion !== "1") ||
    (b.provider === "greenhouse" && object(data.meta)?.total !== data.jobs.length)) throw Error("Incomplete job feed");
  const candidates: OpportunityCandidate[] = [], listedRequisitions: string[] = [], hiddenRequisitions: string[] = [];
  for (const raw of data.jobs) {
    const j = object(raw);
    if (!j || !str(j.title, 500) || !/^[a-zA-Z0-9-]{1,120}$/.test(String(j.id))) throw Error("Malformed job posting");
    if (b.provider === "ashby" && typeof j.isListed !== "boolean") throw Error("Unknown listing visibility");
    if (b.provider === "ashby" && !j.isListed) { hiddenRequisitions.push(String(j.id)); continue; }
    const title = str(j.title, 500), postingId = String(j.id);
    const requisitionId = b.provider === "greenhouse" && j.internal_job_id != null ? String(j.internal_job_id) : postingId;
    if (!/^[a-zA-Z0-9-]{1,120}$/.test(requisitionId)) throw Error("Invalid requisition identity");
    listedRequisitions.push(requisitionId);
    const description = b.provider === "ashby" ? str(j.descriptionPlain) : plain(plain(j.content));
    const family = roleFamily(title, description);
    if (!family) continue;
    const page = new URL(b.provider === "ashby" ? str(j.jobUrl) : str(j.absolute_url));
    page.search = ""; page.hash = "";
    if (jobUrlPostingId(source.id, page.href) !== postingId) throw Error("Posting outside audited board or identity mismatch");
    const primaryLocation = str(b.provider === "ashby" ? j.location : object(j.location)?.name, 500);
    const secondary = b.provider === "ashby" && Array.isArray(j.secondaryLocations) ? j.secondaryLocations.slice(0, 50).map(v => str(object(v)?.location, 120)).filter(Boolean) : [];
    const location = [primaryLocation, ...secondary].filter(Boolean).join("; ").slice(0, 500) || "Local não informado";
    const combined = `${title}. ${location}. ${description}`;
    const workplace: Employment["workplace"] = b.provider === "ashby"
      ? ({ Remote: "remote", Hybrid: "hybrid", OnSite: "onsite" } as const)[String(j.workplaceType) as "Remote"] ?? "unknown"
      : /\bhybrid|h[ií]brid[oa]\b/i.test(location) ? "hybrid" : /\bremote|remot[oa]\b/i.test(location) ? "remote" : "unknown";
    const foreignRemote = /\bremote\b[^.,]{0,20}\b(?:united states|usa|us|canada|europe|emea|united kingdom|uk|india)\b/i.test(location) && !/\b(?:brazil|brasil)\b/i.test(location);
    const eligibility = foreignRemote ? { value: "excluded" as const, excerpt: location } : brazilEligibility(combined);
    if (eligibility.value === "unknown" && workplace === "remote" && /\b(?:brazil|brasil)\b/i.test(location)) {
      eligibility.value = "confirmed"; eligibility.excerpt = `Localidade remota anunciada: ${location}`;
    }
    const applicationUrl = b.provider === "ashby" ? str(j.applyUrl) : page.href;
    if (!jobPostingUrl(source.id, applicationUrl) || jobUrlPostingId(source.id, applicationUrl) !== postingId) throw Error("Application outside audited board");
    const conflict = workplace === "remote" && /\b(?:must|mandatory|required to) (?:work |be )?(?:on[ -]site|in (?:the )?office)|\bhybrid (?:role|position|work)\b/i.test(description);
    const experience = /\b(\d{1,2})\+\s*(?:years|anos) (?:of )?(?:experience|in (?:software|engineering))/i.exec(description);
    const date = b.provider === "ashby" ? j.publishedAt : j.first_published;
    const employment = readEmployment({ version: 1, provider: b.provider, postingId, requisitionId, roleFamily: family,
      workplace: conflict ? "unknown" : workplace, brazilEligibility: eligibility.value, locationText: location,
      employmentType: str(j.employmentType, 80) || null, experienceYears: experience ? Number(experience[1]) : null,
      languages: /\b(?:fluent|fluency|proficien\w*|english level)[^.!?]{0,35}\benglish\b|\benglish (?:fluency|proficien\w*)/i.test(description) ? ["English"] : [],
      travelText: description.match(/[^.!?]{0,70}\b(?:travel|on-site engagements)\b[^.!?]{0,160}/i)?.[0]?.trim() ?? null,
      publishedAt: typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : null,
      salary: salaryOf(j) });
    if (!employment) throw Error("Invalid employment data");
    const evidence = (excerpt: string) => ({ source_url: page.href, excerpt });
    const rawDeadline = str(j.application_deadline, 100);
    const validDeadline = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(rawDeadline) && Number.isFinite(Date.parse(rawDeadline));
    const expired = validDeadline && Date.parse(rawDeadline) <= Date.now();
    const amount = employment.salary ? `${employment.salary.currency} ${employment.salary.min}–${employment.salary.max} / ${employment.salary.interval}` : "Remuneração não informada na fonte oficial.";
    candidates.push({ officialSourceId: source.id, title, institution: b.company, sourcePageUrl: page.href,
      applicationUrl, applicantType: "mixed", applicationRoute: "direct_application", benefitType: "employment",
      categories: ["carreira"], employment, isCourse: false, nationallyEligible: false, geographicScopeKind: "unknown",
      deadlinePrecision: validDeadline ? "exact_datetime" : "not_informed", ...(validDeadline ? { deadlineAt: rawDeadline } : {}),
      requirementsText: description.slice(0, 6000) || "Requisitos não informados.", amountText: amount,
      stateCode: null, cityName: null, reviewStatus: "needs_information", opportunityStatus: expired ? "closed" : "open", extractionMethod: "api",
      sourceConflict: conflict || Boolean(rawDeadline && !validDeadline), evidenceJson: { opportunity_status: evidence(expired ? `Prazo de candidatura encerrado: ${rawDeadline}` : "Anúncio público presente no quadro oficial de vagas."),
        ...(validDeadline ? { deadline_at: evidence(rawDeadline) } : {}),
        registration_availability: evidence("Anúncio listado com destino oficial de candidatura."),
        employment: evidence(`${title}; ${location}`), workplace: evidence(`${String(j.workplaceType ?? location)}; ${location}`),
        brazil_eligibility: evidence(eligibility.excerpt) },
      contentHash: crypto.createHash("sha256").update(JSON.stringify({ title, employment, description, amount, rawDeadline })).digest("hex") });
  }
  const priority = (c: OpportunityCandidate) => Number(c.employment?.workplace === "remote") * 4 + Number(c.employment?.brazilEligibility === "confirmed") * 2 + Number(c.employment?.roleFamily === "fde");
  candidates.sort((a, b) => priority(b) - priority(a) || a.sourcePageUrl.localeCompare(b.sourcePageUrl));
  const seen = new Set<string>();
  return { candidates: candidates.filter(c => { const id = c.employment!.requisitionId; if (seen.has(id)) return false; seen.add(id); return true; }),
    listedRequisitions: [...new Set(listedRequisitions)], hiddenRequisitions };
}
