import { createHmac } from "node:crypto";
import { memberClientIp } from "@/lib/members/client-ip";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";
import { surveySlug } from "@/lib/surveys/contract";
import { recordSurveyProgress, recordSurveyResponse, surveysEnabled } from "@/lib/surveys/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

async function handle(request: Request, { params }: Context, progress: boolean) {
  const { slug } = await params;
  const response = (status: number) => Response.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } });
  if (!surveysEnabled() || !surveySlug.safeParse(slug).success) return response(404);
  try {
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return response(403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return response(415);
    const member = await getMemberFromHeaders(request.headers);
    if (!member) return response(401);
    const keySource = progress ? member.id : memberClientIp(request.headers);
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!keySource || !secret) return response(503);
    const body: unknown = JSON.parse((await readRequestBody(request, progress ? 1024 : 64 * 1024)).toString("utf8"));
    const scope = progress ? "survey-progress" : "survey";
    const key = createHmac("sha256", secret).update(`${scope}:${slug}:`).update(keySource).digest("hex");
    if (!await consumeRateLimit(`${scope}:${key}`, 120, 10 * 60)) return response(429);
    return response(progress ? await recordSurveyProgress(slug, body) : await recordSurveyResponse(slug, body, member.id));
  } catch (error) {
    return response(error instanceof RequestBodyError ? error.status : error instanceof SyntaxError ? 400 : 503);
  }
}

export async function POST(request: Request, context: Context) {
  return handle(request, context, false);
}

export async function PUT(request: Request, context: Context) {
  return handle(request, context, true);
}
