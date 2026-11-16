import crypto from "node:crypto";
import robotsParser from "robots-parser";
import { safeRequest } from "./safe-request";
import { rateLimit } from "./fetch-source";
import { jobBoard, jobFeedUrl } from "./job-sources";
import type { OfficialSource } from "./types";

/** Documented public GET interfaces only, never a general-purpose crawl bypass.
 * Ashby's API host requires authentication for /robots.txt (401), while its
 * explicitly documented posting-api/job-board endpoint is public. That exact
 * endpoint has a separate API access policy. Explicit robots denials still win.
 * Reference: https://developers.ashbyhq.com/docs/public-job-posting-api
 */
export async function fetchPublicJobApi(source: OfficialSource) {
  const board = jobBoard(source.id), url = jobFeedUrl(source.id);
  if (!board || !source.active || source.extractionMode !== "api" || source.listingUrls.length !== 1 || source.listingUrls[0] !== url) throw Error("Unaudited public job API");
  const parsed = new URL(url), agent = process.env.INGESTION_USER_AGENT ?? "RadarAcademicoBot/1.0";
  const robotsUrl = `${parsed.origin}/robots.txt`;
  await rateLimit(parsed.hostname);
  const robots = await safeRequest(robotsUrl, { "User-Agent": agent }, 128 * 1024);
  if (robots.ok) {
    if (robotsParser(robotsUrl, await robots.text()).isAllowed(url, agent) === false) throw Error("Acesso bloqueado por robots.txt");
  } else if (robots.status !== 404 && !(robots.status === 401 && board.provider === "ashby" && parsed.hostname === "api.ashbyhq.com")) {
    throw Error("robots.txt indisponível para revisão");
  }
  await rateLimit(parsed.hostname);
  const response = await safeRequest(url, { "User-Agent": agent, Accept: "application/json" }, 8 * 1024 * 1024);
  // No redirects, authenticated endpoints, HTML, unbounded bodies or provider credentials.
  if (!response.ok || !/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get("content-type") ?? "")) throw Error("Public job API unavailable");
  const body = Buffer.from(await response.arrayBuffer());
  return { body, contentType: response.headers.get("content-type")!, hash: crypto.createHash("sha256").update(body).digest("hex"), cached: false };
}
