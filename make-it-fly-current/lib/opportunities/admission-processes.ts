import type { StudentOpportunity } from "./types";

export type AdmissionGroup = { id: string; title: string; courses: StudentOpportunity[] };

export type OpportunityEntry =
  | { type: "opportunity"; id: string; opportunity: StudentOpportunity }
  | { type: "admission"; id: string; group: AdmissionGroup };

/** Group only metadata supplied by the audited collector. Filter courses before grouping. */
export function groupAdmissionProcesses(opportunities: readonly StudentOpportunity[]) {
  const groups = new Map<string, AdmissionGroup>();
  const entries: OpportunityEntry[] = [];
  const standalone: StudentOpportunity[] = [];
  for (const item of opportunities) {
    if (!item.admissionProcess || item.kind !== "Curso") {
      standalone.push(item);
      entries.push({ type: "opportunity", id: `opportunity:${item.id}`, opportunity: item });
      continue;
    }
    const { id, title } = item.admissionProcess;
    const key = id;
    const group = groups.get(key) ?? { id: key, title, courses: [] };
    if (!groups.has(key)) entries.push({ type: "admission", id: `admission:${key}`, group });
    group.courses.push(item);
    groups.set(key, group);
  }
  return { standalone, entries, groups: [...groups.values()], total: standalone.length + groups.size };
}
