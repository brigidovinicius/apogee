import { readFile } from "node:fs/promises";
import { sourceSession } from "./benefit-source-check.mjs";

const day = 24 * 60 * 60 * 1000;
export const loadAutomaticRules = async () => JSON.parse(await readFile(
  new URL("../content/benefit-automatic-rules.json", import.meta.url), "utf8",
));

function comparableUrl(value) {
  if (!value || !URL.canParse(value)) return "";
  const url = new URL(value);
  return url.origin + url.pathname.replace(/\/$/, "") + url.hash;
}

const normalizeName = value => value.normalize("NFD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function duplicateMatcher(rule) {
  const { offer, aliases = {} } = rule;
  const ids = new Set([offer?.id, ...(aliases.ids ?? [])].filter(Boolean));
  const urls = new Set([offer?.source, offer?.redeem, ...(aliases.urls ?? [])].map(comparableUrl).filter(Boolean));
  const names = new Set([offer?.condition, ...(aliases.names ?? [])].filter(Boolean).map(normalizeName));
  const partners = new Set([offer?.partner, ...(aliases.partners ?? [])].filter(Boolean).map(normalizeName));
  return row => ids.has(row.id) ||
    [row.evidence_url, row.redemption_url, row.source_url].some(url => urls.has(comparableUrl(url))) ||
    (names.has(normalizeName(row.name ?? "")) && partners.has(normalizeName(row.partner ?? "")));
}

function publicUrl(value) {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash;
}

export function eligibleRule(offer, at) {
  if (!offer || !publicUrl(offer.source) || !publicUrl(offer.redeem) || !offer.tests?.length) return false;
  const territory = offer.tests.some(test => test.url === offer.source && test.markers?.length && /brasil/i.test(test.brazil ?? ""));
  const redemption = offer.tests.some(test => test.url === offer.redeem && test.markers?.length
    && test.redemption?.markers?.length && Object.keys(test.redemption.query ?? {}).length > 0);
  if (!territory || !redemption) return false;
  if (offer.ongoing === true) return !offer.startsAt && !offer.endsAt;
  return Date.parse(offer.startsAt) <= +at && +at < Date.parse(offer.endsAt);
}

export function automaticTermsMatch(row, offer) {
  const timestamp = value => value ? +new Date(value) : null;
  return row.name === offer.condition && row.description === offer.condition && row.partner === offer.partner &&
    row.eligibility === offer.eligibility && row.availability === offer.availability && row.redemption === offer.instructions &&
    row.audience === offer.audience && timestamp(row.starts_at) === timestamp(offer.startsAt) &&
    timestamp(row.ends_at) === timestamp(offer.endsAt);
}

const matches = (rule, source, candidate) => rule.sourceId === source.id && rule.key === candidate.key &&
  rule.evidenceUrl === candidate.evidenceUrl && rule.sourceUrl === source.sourceUrl;
const recent = (value, at) => { const age = +at - Date.parse(value); return age >= 0 && age < day; };

export async function reviewDiscoveredBenefits(report, rules, { check = sourceSession(), findDuplicate, publish, at = new Date() } = {}) {
  if (report?.status !== "editorial_review" || !recent(report.generatedAt, at) || !Array.isArray(report.sources)) return [];
  const decisions = [];
  for (const source of report.sources) {
    if (!recent(source.checkedAt, at) || !Array.isArray(source.candidates)) continue;
    for (const candidate of source.candidates) {
      const rule = rules.find(rule => matches(rule, source, candidate));
      const record = { source: source.id, candidate: candidate.key };
      if (!rule) { decisions.push({ ...record, outcome: "review", reason: "Sem regra aprovada para essa campanha" }); continue; }
      const isDuplicate = duplicateMatcher(rule);
      if (await findDuplicate(isDuplicate)) { decisions.push({ ...record, outcome: "duplicate" }); continue; }
      if (!["observed", "partial"].includes(source.outcome) || !["new_program", "new_campaign"].includes(candidate.change) || !eligibleRule(rule.offer, at)) {
        decisions.push({ ...record, outcome: "review", reason: "Vigência ou evidência da campanha não confirmada" }); continue;
      }
      const checkedAt = at.toISOString();
      const result = await check(rule.offer);
      if (result.outcome !== "verified") { decisions.push({ ...record, ...result }); continue; }
      const outcome = await publish({ ...rule.offer, checkedAt, result }, isDuplicate);
      decisions.push({ ...record, offer: rule.offer.id, outcome });
    }
  }
  return decisions;
}

export async function publishFromDiscovery(sql, report, rules, editorId) {
  const { publishAutomaticOffer } = await import("./import-benefit-offers.mjs");
  const rows = await sql`select b.id,b.name,b.partner,b.evidence_url,b.redemption_url,o.source_url
    from member_benefit b left join member_benefit_organization o on b.id=o.benefit_id`;
  return reviewDiscoveredBenefits(report, rules, {
    findDuplicate: match => rows.some(match),
    publish: (offer, match) => publishAutomaticOffer(sql, offer, editorId, match),
  });
}
