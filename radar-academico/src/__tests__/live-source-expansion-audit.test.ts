import { readFile, writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { prepareSourceExpansion, type ExpansionLead } from "@/lib/discovery/source-expansion";

// Explicit operator audit: fetches public evidence only. Never registers sources,
// persists opportunities, runs the scheduler or uses a database credential.
it.skipIf(!process.env.RADAR_SOURCE_EXPANSION_SAMPLE)("audits a bounded sample of real blocked links without publication", async () => {
  const leads = JSON.parse(await readFile(process.env.RADAR_SOURCE_EXPANSION_SAMPLE!, "utf8")) as ExpansionLead[];
  expect(leads.length).toBeGreaterThan(0);
  expect(leads.length).toBeLessThanOrEqual(8);
  const results = [];
  for (const lead of leads) {
    try {
      const result = await prepareSourceExpansion(lead);
      results.push("reason" in result ? { url: lead.url, reason: result.reason } : {
        url: lead.url, candidateValidated: true, title: result.candidate.title,
        institution: result.candidate.institution, deadline: result.candidate.deadlineAt ?? null,
        eventStartsAt: result.candidate.eventStartsAt ?? null, evidence: result.registration,
      });
    } catch (error) {
      results.push({ url: lead.url, error: error instanceof Error ? error.message : "fetch_failed" });
    }
  }
  const report = { checkedAt: new Date().toISOString(), readOnly: true, results };
  if (process.env.RADAR_SOURCE_EXPANSION_REPORT) await writeFile(process.env.RADAR_SOURCE_EXPANSION_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}, 240_000);
