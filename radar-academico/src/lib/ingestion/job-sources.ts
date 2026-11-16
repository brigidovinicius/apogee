import type { OfficialSource } from "./types";

const boards = {
  "jobs-whippy": { company: "Whippy", board: "whippy", provider: "ashby" },
  "jobs-n8n": { company: "n8n", board: "n8n", provider: "ashby" },
  "jobs-nortal": { company: "Nortal", board: "nortal", provider: "greenhouse" },
  "jobs-gitlab": { company: "GitLab", board: "gitlab", provider: "greenhouse" },
  "jobs-latamcent": { company: "LatamCent", board: "latamcent", provider: "ashby" },
  "jobs-truelogic": { company: "Truelogic", board: "truelogic", provider: "ashby" },
  "jobs-elevenlabs": { company: "ElevenLabs", board: "ElevenLabs", provider: "ashby" },
  "jobs-telnyx": { company: "Telnyx", board: "telnyx54", provider: "greenhouse" },
  "jobs-oscilar": { company: "Oscilar", board: "oscilar", provider: "ashby" },
} as const;

export function jobSourceIds() { return Object.keys(boards); }
export function jobBoard(id: string) { return boards[id as keyof typeof boards] ?? null; }
export function jobFeedUrl(id: string) {
  const b = jobBoard(id);
  if (!b) throw Error("Unknown job board");
  return b.provider === "ashby" ? `https://api.ashbyhq.com/posting-api/job-board/${b.board}?includeCompensation=true`
    : `https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs?content=true`;
}
/** No hostname-wide trust for multi-tenant platforms. */
export function jobPostingUrl(id: string, input: string) {
  const b = jobBoard(id);
  if (!b) return false;
  try {
    const u = new URL(input);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.search && !u.hash &&
      (b.provider === "ashby" ? u.hostname === "jobs.ashbyhq.com" &&
        new RegExp(`^/${b.board}/[a-f0-9-]{36}(?:/application)?$`).test(u.pathname)
        : u.hostname === "job-boards.greenhouse.io" && new RegExp(`^/${b.board}/jobs/[0-9]+$`).test(u.pathname));
  } catch { return false; }
}
export function jobUrlPostingId(id: string, input: string) {
  if (!jobPostingUrl(id, input)) return null;
  const parts = new URL(input).pathname.split("/").filter(Boolean);
  return jobBoard(id)?.provider === "ashby" ? parts[1] : parts[2];
}
export function jobSource(id: string): OfficialSource {
  const b = jobBoard(id);
  if (!b) throw Error("Unknown job board");
  const ashby = b.provider === "ashby";
  return { id, name: `${b.company} — empregos`, institutionName: b.company, institutionAcronym: "",
    sourceType: "corporate_organizer", baseUrl: jobFeedUrl(id), listingUrls: [jobFeedUrl(id)],
    allowedDomains: ashby ? ["api.ashbyhq.com", "jobs.ashbyhq.com"] : ["boards-api.greenhouse.io", "job-boards.greenhouse.io"],
    allowedPathPrefixes: ashby ? [`/posting-api/job-board/${b.board}`, `/${b.board}/`]
      : [`/v1/boards/${b.board}/jobs`, `/${b.board}/jobs/`],
    extractionMode: "api", audienceScope: ["mixed"], geographicScope: [], categories: ["carreira"], priority: id === "jobs-whippy" ? 90 : 70,
    active: false };
}
