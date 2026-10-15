import type { StudentOpportunity } from "./types";

export type AdmissionGroup = { id: string; title: string; courses: StudentOpportunity[] };

/** Group only metadata supplied by the audited collector. Filter courses before grouping. */
export function groupAdmissionProcesses(opportunities: readonly StudentOpportunity[]) {
  const groups = new Map<string, AdmissionGroup>();
  const standalone: StudentOpportunity[] = [];
  for (const item of opportunities) {
    if (!item.admissionProcess || item.kind !== "Curso") { standalone.push(item); continue; }
    const { id, title } = item.admissionProcess;
    const key = id;
    const group = groups.get(key) ?? { id: key, title, courses: [] };
    group.courses.push(item);
    groups.set(key, group);
  }
  return { standalone, groups: [...groups.values()], total: standalone.length + groups.size };
}
