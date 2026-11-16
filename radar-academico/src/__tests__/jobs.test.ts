import { describe, expect, it } from "vitest";
import { parseJobFeed, brazilEligibility, roleFamily } from "@/lib/ingestion/job-feed";
import { jobSource, jobFeedUrl, jobPostingUrl } from "@/lib/ingestion/job-sources";
import { publicationIssue } from "@/lib/ingestion/publication";
import { readEmployment } from "../../contracts/employment";

export const jobFixture = (patch: Record<string, unknown> = {}) => ({
  id: "8013f907-e90f-4e3d-92c2-d14808891efb", title: "Forward Deployed Engineer (Brazil)",
  jobUrl: "https://jobs.ashbyhq.com/whippy/8013f907-e90f-4e3d-92c2-d14808891efb", isListed: true,
  applyUrl: "https://jobs.ashbyhq.com/whippy/8013f907-e90f-4e3d-92c2-d14808891efb/application",
  workplaceType: "Remote", isRemote: true, location: "Remote - Latin America", employmentType: "FullTime",
  publishedAt: "2026-11-13T20:56:12Z",
  descriptionPlain: "Remote, based in Brazil, working with US customers in overlapping hours. 2+ years of experience in software engineering. Build production integrations with customers.",
  compensation: { compensationTierSummary: null, compensationTiers: [], summaryComponents: [] }, ...patch,
});
const source = { ...jobSource("jobs-whippy"), active: true };
const parse = (patch: Record<string, unknown> = {}) => parseJobFeed({ apiVersion: "1", jobs: [jobFixture(patch)] }, source).candidates[0];
describe("official job feeds", () => {
  it("isolates each newly audited tenant, including canonical case, from foreign posting URLs", () => {
    for (const [id,tenant,provider] of [["latamcent","latamcent","ashby"],["truelogic","truelogic","ashby"],
      ["oscilar","oscilar","ashby"],["elevenlabs","ElevenLabs","ashby"],["telnyx","telnyx54","greenhouse"]]) {
      const s=jobSource(`jobs-${id}`);const uuid="8013f907-e90f-4e3d-92c2-d14808891efb";
      const page=provider==="ashby"?`https://jobs.ashbyhq.com/${tenant}/${uuid}`:`https://job-boards.greenhouse.io/${tenant}/jobs/123`;
      expect(s.active).toBe(false);expect(s.geographicScope).toEqual([]);
      expect(jobPostingUrl(s.id,page)).toBe(true);
      expect(jobPostingUrl(s.id,page.replace(`/${tenant}/`,`/${tenant}-other/`))).toBe(false);
      expect(jobPostingUrl(s.id,page+"?redirect=https://example.test")).toBe(false);
      expect(jobPostingUrl(s.id,page.replace("https:","http:"))).toBe(false);
    }
  });

  it("confirms Brazilian residence, preserves employment evidence and keeps unknown pay unknown", () => {
    const c = parse(); expect(c.employment).toMatchObject({ workplace: "remote", brazilEligibility: "confirmed", salary: null, experienceYears: 2 });
    expect(c.deadlinePrecision).toBe("not_informed"); expect(c.deadlineAt).toBeUndefined();
    expect(publicationIssue(c, source)).toBeNull(); expect(c.nationallyEligible).toBe(false);
  });
  it("does not label hybrid jobs remote from isRemote=true", () => {
    const c = parse({ workplaceType: "Hybrid" }); expect(c.employment?.workplace).toBe("hybrid");
    expect(publicationIssue(c, source)).toBe("job_remote_unconfirmed");
  });
  it("keeps onsite and conflicting workplace announcements out of remote publication", () => {
    expect(publicationIssue(parse({ workplaceType: "OnSite" }), source)).toBe("job_remote_unconfirmed");
    expect(publicationIssue(parse({ descriptionPlain: "Remote, based in Brazil. You must be on-site every week." }), source)).toBe("source_conflict");
  });
  it("never equates remote or LATAM with confirmed Brazilian eligibility", () => {
    const c = parse({ title: "Forward Deployed Engineer", descriptionPlain: "Work remotely with customers in LATAM." });
    expect(c.employment?.brazilEligibility).toBe("unknown"); expect(publicationIssue(c, source)).toBe("job_brazil_unconfirmed");
  });
  it("honors country exclusions before worldwide text", () => {
    expect(brazilEligibility("We hire worldwide. This role is US-only.").value).toBe("excluded");
    expect(brazilEligibility("Candidates may work anywhere in the world.").value).toBe("confirmed");
    expect(brazilEligibility("Remote role serving Brazil customers.").value).toBe("unknown");
    expect(brazilEligibility("Our engineers work with clients based in Brazil.").value).toBe("unknown");
    expect(brazilEligibility("Our company is based in Brazil.").value).toBe("unknown");
  });
  it("omits hidden posts and rejects missing visibility", () => {
    expect(parseJobFeed({ apiVersion: "1", jobs: [jobFixture({ isListed: false })] }, source).candidates).toEqual([]);
    expect(() => parse({ isListed: undefined })).toThrow("visibility");
  });
  it("rejects truncated, oversized and malformed boards before persistence", () => {
    expect(() => parseJobFeed({ jobs: [] }, source)).toThrow();
    expect(() => parseJobFeed({ apiVersion: "1", jobs: Array(2001).fill(jobFixture()) }, source)).toThrow();
    expect(() => parseJobFeed({ apiVersion: "1", jobs: [null] }, source)).toThrow();
  });
  it("does not authorize another tenant on the same ATS hostname", () => {
    expect(() => parse({ jobUrl: "https://jobs.ashbyhq.com/other/8013f907-e90f-4e3d-92c2-d14808891efb" })).toThrow();
    expect(jobPostingUrl(source.id, "https://jobs.ashbyhq.com/whippy-other/8013f907-e90f-4e3d-92c2-d14808891efb")).toBe(false);
  });
  it("accepts related implementation roles only with customer and production responsibilities", () => {
    expect(roleFamily("AI Solutions Engineer", "Build production integrations for enterprise customers.")).toBe("ai_implementation");
    expect(roleFamily("AI Solutions Engineer", "Run marketing demos.")).toBeNull();
    expect(roleFamily("Deployment Engineer", "Maintain infrastructure.")).toBeNull();
  });
  it("does not fabricate a universal salary from multiple tiers", () => {
    const salary = { compensationType: "Salary", currencyCode: "USD", interval: "1 YEAR", minValue: 60000, maxValue: 80000 };
    expect(parse({ compensation: { summaryComponents: [salary] } }).employment?.salary).toEqual({ min: 60000, max: 80000, currency: "USD", interval: "1 YEAR" });
    expect(parse({ compensation: { summaryComponents: [salary, salary] } }).employment?.salary).toBeNull();
    expect(readEmployment({ ...parse().employment, salary: { min: 20, max: 10, currency: "USD", interval: "year" } })).toBeNull();
  });
  it("honors explicit application deadlines and rejects invented continuous intake", () => {
    const future = parse({ application_deadline: "2099-11-20T12:00:00Z" });
    expect(future.deadlineAt).toBe("2099-11-20T12:00:00Z"); expect(publicationIssue(future, source)).toBeNull();
    expect(parse({ application_deadline: "2000-01-01T12:00:00Z" }).opportunityStatus).toBe("closed");
    expect(publicationIssue(parse({ application_deadline: "soon" }), source)).toBe("source_conflict");
    expect(publicationIssue({ ...parse(), deadlinePrecision: "continuous_flow" }, source)).toBe("invalid_deadline");
  });
  it("groups Greenhouse posting variants by stable requisition and prefers Brazilian remote conditions", () => {
    const s = { ...jobSource("jobs-nortal"), active: true };
    const job = { id: 123, internal_job_id: 99, title: "Forward Deployed Engineer", absolute_url: "https://job-boards.greenhouse.io/nortal/jobs/123", location: { name: "Remote Brazil" }, content: "Build production integrations with customers." };
    const feed = parseJobFeed({ jobs: [{ ...job, id: 124, absolute_url: "https://job-boards.greenhouse.io/nortal/jobs/124", location: { name: "Remote US-only" } }, job], meta: { total: 2 } }, s);
    expect(feed.candidates).toHaveLength(1); expect(feed.candidates[0].employment?.postingId).toBe("123");
    expect(feed.candidates[0].employment?.requisitionId).toBe("99");
    expect(() => parseJobFeed({ jobs: [job], meta: { total: 2 } }, s)).toThrow();
    expect(jobFeedUrl(s.id)).toContain("content=true");
  });
});
