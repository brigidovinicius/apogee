import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";

vi.mock("@/lib/db/client", () => ({ withAdminTransaction: vi.fn() }));
vi.mock("@/lib/ingestion/official-source-registry", () => ({ loadActiveOfficialSources: vi.fn() }));
vi.mock("@/lib/ingestion/persist-candidate", () => ({ lockSource: vi.fn(), persistCandidate: vi.fn() }));
vi.mock("@/lib/discovery/lead-candidate", () => ({ prepareLeadCandidate: vi.fn() }));

import { withAdminTransaction } from "@/lib/db/client";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { lockSource, persistCandidate } from "@/lib/ingestion/persist-candidate";
import { prepareLeadCandidate } from "@/lib/discovery/lead-candidate";
import { finishDiscoveryLead, leadRetryDelayMinutes, runScheduledLeadProcessing, sanitizedLeadReason,
  type ProcessingLead } from "@/lib/discovery/process-leads";

const source: OfficialSource = {
  id: "official-calls", name: "Calls", institutionName: "Institution", institutionAcronym: "INST",
  sourceType: "official_reference", baseUrl: "https://official.example.org/calls/",
  allowedDomains: ["official.example.org"], allowedPathPrefixes: ["/calls/"],
  listingUrls: ["https://official.example.org/calls/"], extractionMode: "html",
  audienceScope: [], geographicScope: [], categories: [], priority: 1, active: true,
};
const lead: ProcessingLead = {
  id: "00000000-0000-4000-8000-000000000001", target_id: "target", url: "https://official.example.org/calls/one",
  title: "Call one", excerpt: "", status: "new", processing_lease_token: "00000000-0000-4000-8000-000000000002",
  processing_attempts: 1, processing_run_id: "00000000-0000-4000-8000-000000000003",
  target_official_url: "https://official.example.org/calls/", target_verified_at: "2026-10-30 10:00:00+00",
  target_enabled: true, target_verified_url: "https://official.example.org/calls/",
};
const candidate: OpportunityCandidate = {
  officialSourceId: source.id, title: lead.title, institution: source.institutionName, sourcePageUrl: lead.url,
  applicantType: "mixed", applicationRoute: "direct_application", benefitType: "academic_scholarship",
  deadlineAt: "2100-12-31", deadlinePrecision: "date_only", requirementsText: "Official requirements",
  amountText: "Official terms", stateCode: null, cityName: null, reviewStatus: "needs_information",
  opportunityStatus: "open", evidenceJson: {
    deadline_at: { source_url: lead.url, excerpt: "Inscrições até 31/12/2100" },
    opportunity_status: { source_url: lead.url, excerpt: "Inscrições abertas" },
  }, extractionMethod: "html", contentHash: "fixture",
};

let current: Record<string, unknown> | null;
let live: Record<string, unknown> | null;
let stored: Record<string, unknown> | null;
let claimed: ProcessingLead[];
const query = vi.fn(async (sql: string) => {
  if (sql.includes("with due as")) return { rows: claimed };
  if (sql.includes("insert into ingestion_runs")) return { rows: [{ id: lead.processing_run_id }] };
  if (sql.includes("select lead.*")) return { rows: current ? [current] : [] };
  if (sql.includes("select allowed_domains")) return { rows: live ? [live] : [] };
  if (sql.includes("select o.deleted_at")) return { rows: stored ? [stored] : [] };
  return { rows: [] };
});

beforeEach(() => {
  current = { ...lead, target_enabled: true, target_current_url: lead.target_official_url,
    target_current_verified_url: lead.target_official_url, target_current_verified_at: lead.target_verified_at };
  live = { allowed_domains: source.allowedDomains, allowed_path_prefixes: source.allowedPathPrefixes,
    extraction_mode: source.extractionMode, base_url: source.baseUrl, listing_urls: source.listingUrls };
  stored = { deleted_at: null, official_source_id: source.id, publication_issue: null,
    published_at: "2026-10-30T10:00:00Z", source_page_url: lead.url };
  claimed = [];
  vi.mocked(withAdminTransaction).mockImplementation(async (work) => work({ query } as never));
  vi.mocked(loadActiveOfficialSources).mockResolvedValue([source]);
  vi.mocked(persistCandidate).mockResolvedValue({ id: "opportunity", saved: 1, published: 1, blocked: 0, created: 1, updated: 0 });
});
afterEach(() => vi.clearAllMocks());

it("does not write through a lost or expired lease", async () => {
  current = null;
  expect(await finishDiscoveryLead(lead, { source, candidate })).toBeNull();
  expect(persistCandidate).not.toHaveBeenCalled();
  expect(query.mock.calls.some(([sql]) => sql.includes("update discovery_leads set processing_status"))).toBe(false);
});

it("preserves a human dismissal made during extraction", async () => {
  current!.status = "dismissed";
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "ignored", reason: "previously_reviewed" });
  expect(persistCandidate).not.toHaveBeenCalled();
});

it.each(["disabled", "verification", "url"])("refuses a target whose %s changed during extraction", async (change) => {
  if (change === "disabled") current!.target_enabled = false;
  if (change === "verification") current!.target_current_verified_at = null;
  if (change === "url") current!.target_current_url = "https://other.example.org/";
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "blocked" });
  expect(persistCandidate).not.toHaveBeenCalled();
});

it("refuses a source whose authorized path changed during extraction", async () => {
  live!.allowed_path_prefixes = ["/other/"];
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "blocked", reason: "source_changed" });
  expect(persistCandidate).not.toHaveBeenCalled();
});

it("does not publish an expired candidate or one requiring human review", async () => {
  expect(await finishDiscoveryLead(lead, { source, candidate: { ...candidate, deadlineAt: "2000-01-01" } }))
    .toMatchObject({ state: "blocked", reason: "invalid_deadline" });
  expect(await finishDiscoveryLead(lead, { source, candidate: { ...candidate, requiresManualReview: true } }))
    .toMatchObject({ state: "blocked", reason: "candidate_unconfirmed" });
  expect(persistCandidate).not.toHaveBeenCalled();
});

it("marks a persisted public candidate as mapped only after using the existing source and identity locks", async () => {
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "completed", reason: "published", created: 1, published: 1 });
  expect(lockSource).toHaveBeenCalledWith(expect.anything(), source);
  expect(persistCandidate).toHaveBeenCalledWith(expect.anything(), source, candidate, { mode: "automatic" });
  const updates = query.mock.calls.filter(([sql]) => sql.includes("update discovery_leads set processing_status"));
  expect(updates).toHaveLength(1);
});

it("keeps an unchanged opportunity idempotent and does not claim a new publication", async () => {
  vi.mocked(persistCandidate).mockResolvedValue({ id: "opportunity", saved: 0, published: 0, blocked: 0, created: 0, updated: 0 });
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "completed", reason: "unchanged", created: 0, published: 0 });
});

it("retains a tombstone without reopening or mapping its lead", async () => {
  stored!.deleted_at = "2026-10-29T10:00:00Z";
  vi.mocked(persistCandidate).mockResolvedValue({ id: "opportunity", saved: 0, published: 0, blocked: 0, created: 0, updated: 0 });
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "ignored", reason: "deleted", published: 0 });
});

it("does not map an identity belonging to a different source or a manual URL override", async () => {
  stored!.official_source_id = "another-source";
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "blocked", reason: "identity_conflict" });
  stored!.official_source_id = source.id;
  stored!.source_page_url = "https://official.example.org/calls/manual";
  expect(await finishDiscoveryLead(lead, { source, candidate })).toMatchObject({ state: "blocked", reason: "manual_override" });
});

it("retries only bounded transient failures and stops after four attempts", async () => {
  expect(await finishDiscoveryLead(lead, { reason: "request_timeout", retry: true })).toMatchObject({ state: "retry", reason: "request_timeout" });
  expect(await finishDiscoveryLead({ ...lead, processing_attempts: 4 }, { reason: "request_timeout", retry: true }))
    .toMatchObject({ state: "blocked", reason: "retry_exhausted" });
  expect(await finishDiscoveryLead(lead, { reason: "scope_unverified", retry: true })).toMatchObject({ state: "blocked", reason: "scope_unverified" });
  expect(leadRetryDelayMinutes(1)).toBe(60);
  expect(leadRetryDelayMinutes(4)).toBe(480);
  expect(leadRetryDelayMinutes(100)).toBe(1440);
  expect(sanitizedLeadReason("secret or arbitrary upstream text")).toBe("candidate_unconfirmed");
});

it("does not fetch a lead whose discovery target is disabled", async () => {
  claimed = [{ ...lead, target_enabled: false }];
  current!.target_enabled = false;
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, blocked: 1, published: 0, reasons: { target_unavailable: 1 } });
  expect(prepareLeadCandidate).not.toHaveBeenCalled();
});
