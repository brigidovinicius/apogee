/** Versioned public contract. Missing eligibility is never interpreted as permission. */
export type Employment = {
  version: 1;
  provider: "ashby" | "greenhouse";
  postingId: string;
  requisitionId: string;
  roleFamily: "fde" | "ai_implementation";
  workplace: "remote" | "hybrid" | "onsite" | "unknown";
  brazilEligibility: "confirmed" | "excluded" | "unknown";
  locationText: string;
  employmentType: string | null;
  experienceYears: number | null;
  languages: string[];
  travelText: string | null;
  publishedAt: string | null;
  salary: { min: number; max: number; currency: string; interval: string } | null;
};

export function readEmployment(value: unknown): Employment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const text = (s: unknown, max = 500): s is string => typeof s === "string" && s.length > 0 && s.length <= max;
  if (v.version !== 1 || !["ashby", "greenhouse"].includes(String(v.provider)) ||
    !text(v.postingId, 120) || !text(v.requisitionId, 120) ||
    !["fde", "ai_implementation"].includes(String(v.roleFamily)) ||
    !["remote", "hybrid", "onsite", "unknown"].includes(String(v.workplace)) ||
    !["confirmed", "excluded", "unknown"].includes(String(v.brazilEligibility)) || !text(v.locationText) ||
    !(v.employmentType === null || text(v.employmentType, 80)) ||
    !(v.experienceYears === null || Number.isInteger(v.experienceYears) && Number(v.experienceYears) >= 0 && Number(v.experienceYears) <= 60) ||
    !Array.isArray(v.languages) || v.languages.length > 10 || !v.languages.every(s => text(s, 80)) ||
    !(v.travelText === null || text(v.travelText, 1000)) ||
    !(v.publishedAt === null || text(v.publishedAt, 50) && Number.isFinite(Date.parse(v.publishedAt)))) return null;
  let salary: Employment["salary"] = null;
  if (v.salary !== null) {
    if (!v.salary || typeof v.salary !== "object" || Array.isArray(v.salary)) return null;
    const s = v.salary as Record<string, unknown>;
    if (typeof s.min !== "number" || !Number.isFinite(s.min) || typeof s.max !== "number" || !Number.isFinite(s.max) ||
      s.min < 0 || s.max < s.min || !text(s.currency, 3) || !/^[A-Z]{3}$/.test(s.currency) || !text(s.interval, 50)) return null;
    salary = { min: s.min, max: s.max, currency: s.currency, interval: s.interval };
  }
  return { version: 1, provider: v.provider as Employment["provider"], postingId: v.postingId,
    requisitionId: v.requisitionId, roleFamily: v.roleFamily as Employment["roleFamily"],
    workplace: v.workplace as Employment["workplace"], brazilEligibility: v.brazilEligibility as Employment["brazilEligibility"],
    locationText: v.locationText, employmentType: v.employmentType as string | null,
    experienceYears: v.experienceYears as number | null, languages: v.languages as string[],
    travelText: v.travelText as string | null, publishedAt: v.publishedAt as string | null, salary };
}
