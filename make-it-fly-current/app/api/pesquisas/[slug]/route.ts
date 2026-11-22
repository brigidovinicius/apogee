import { createHmac } from "node:crypto";
import { memberClientIp } from "@/lib/members/client-ip";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";
import { surveySlug } from "@/lib/surveys/contract";
import { recordSurveyResponse, surveysEnabled } from "@/lib/surveys/store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = (status: number) => Response.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } });
  if (!surveysEnabled() || !surveySlug.safeParse(slug).success) return response(404);
  try {
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return response(403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return response(415);
    const ip = memberClientIp(request.headers);
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!ip || !secret) return response(503);
    const body: unknown = JSON.parse((await readRequestBody(request, 64 * 1024)).toString("utf8"));
    const key = createHmac("sha256", secret).update(`survey:${slug}:`).update(ip).digest("hex");
    if (!await consumeRateLimit(`survey:${key}`, 120, 10 * 60)) return response(429);
    return response(await recordSurveyResponse(slug, body));
  } catch (error) {
    return response(error instanceof RequestBodyError ? error.status : error instanceof SyntaxError ? 400 : 503);
  }
}
