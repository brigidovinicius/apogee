import { NextRequest, NextResponse } from "next/server";

const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
};

const safeJsonParse = (value: string | null) => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.SUPABASE_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        reason: "SUPABASE_WEBHOOK_URL não configurada",
      },
      { status: 503 }
    );
  }

  const requestBody = safeJsonParse(await request.text());

  const payload = {
    ...requestBody,
    event: "participacao_click",
    source: "landing_page",
    receivedAt: new Date().toISOString(),
    ip: getClientIp(request),
  };

  const upstreamResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Falha no retorno do destino",
        details: responseBody,
        status: upstreamResponse.status,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: 200,
    details: responseBody ? safeJsonParse(responseBody) : {},
  });
}
