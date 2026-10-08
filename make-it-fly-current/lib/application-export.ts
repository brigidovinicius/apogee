import "server-only";

import { adminAuthorized } from "@/lib/admin-auth";
import { ApplicationError, readApplicationConfig } from "@/lib/applications";

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;

type ExportApplication = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  has_idea: boolean;
  idea_description: string | null;
  uses_paid_ai: boolean;
  eligible: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  age: number | null;
  profession: string | null;
  has_laptop: boolean | null;
};

const EXPORT_FIELDS = [
  "id", "created_at", "name", "email", "phone", "has_idea",
  "idea_description", "uses_paid_ai", "eligible", "utm_source",
  "utm_medium", "utm_campaign", "utm_content", "referrer", "age",
  "profession", "has_laptop",
].join(",");

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function databaseHeaders(databaseKey: string) {
  const headers: Record<string, string> = { apikey: databaseKey, Accept: "application/json" };
  if (!databaseKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${databaseKey}`;
  return headers;
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max ? value : null;
}

function validateRows(value: unknown): ExportApplication[] {
  if (!Array.isArray(value) || value.length > 1000) throw new ApplicationError(503, "Exportação indisponível.");
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new ApplicationError(503, "Exportação indisponível.");
    const item = row as Record<string, unknown>;
    const createdAt = text(item.created_at, 40);
    const validAge = item.age === null || (typeof item.age === "number" && Number.isInteger(item.age) && item.age >= 1 && item.age <= 120);
    if (
      !/^[0-9a-f-]{36}$/i.test(String(item.id)) ||
      !createdAt || Number.isNaN(Date.parse(createdAt)) ||
      text(item.name, 120) === null || text(item.email, 254) === null || text(item.phone, 15) === null ||
      typeof item.has_idea !== "boolean" || typeof item.uses_paid_ai !== "boolean" || typeof item.eligible !== "boolean" ||
      !validAge || (item.profession !== null && text(item.profession, 160) === null) ||
      (item.has_laptop !== null && typeof item.has_laptop !== "boolean") ||
      (item.idea_description !== null && text(item.idea_description, 2000) === null) ||
      (item.utm_source !== null && text(item.utm_source, 200) === null) ||
      (item.utm_medium !== null && text(item.utm_medium, 200) === null) ||
      (item.utm_campaign !== null && text(item.utm_campaign, 200) === null) ||
      (item.utm_content !== null && text(item.utm_content, 200) === null) ||
      (item.referrer !== null && text(item.referrer, 2048) === null)
    ) throw new ApplicationError(503, "Exportação indisponível.");
    return item as ExportApplication;
  });
}

function spreadsheetSafe(value: string) {
  const singleLine = value.replace(/[\r\n]+/g, " ").trim();
  return /^[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
}

function csvCell(value: string) {
  return `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
}

export function applicationsToCsv(rows: ExportApplication[]) {
  const output = [[
    "ID", "Data de envio", "Nome", "E-mail", "Telefone", "Tem uma ideia?",
    "Ideia ou projeto", "Usa IA paga?", "Compatibilidade", "Origem", "Mídia",
    "Campanha", "Conteúdo", "Referência", "Idade", "Profissão ou área",
    "Leva computador?",
  ]];

  const operationalRows = rows.filter((row) => !(
    /^TESTE INTERNO\b/i.test(row.name) && row.email.toLowerCase().endsWith("@example.com")
  ));

  for (const row of operationalRows) output.push([
    row.id,
    new Date(row.created_at).toISOString(),
    row.name,
    row.email,
    row.phone,
    row.has_idea ? "Sim" : "Não",
    row.idea_description ?? "",
    row.uses_paid_ai ? "Sim" : "Não",
    row.eligible ? "Alinhado" : "Revisar",
    row.utm_source ?? "",
    row.utm_medium ?? "",
    row.utm_campaign ?? "",
    row.utm_content ?? "",
    row.referrer ?? "",
    row.age === null ? "" : String(row.age),
    row.profession ?? "",
    row.has_laptop === null ? "" : row.has_laptop ? "Sim" : "Não",
  ]);

  return `${output.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

type HandlerOptions = { env?: Environment; fetcher?: Fetcher };

export async function handleApplicationsExportGet(request: Request, options: HandlerOptions = {}) {
  try {
    const env = options.env ?? process.env;
    if (!adminAuthorized(request, env)) {
      return new Response("Não encontrado.", { status: 404, headers: RESPONSE_HEADERS });
    }
    const config = readApplicationConfig(env);

    const response = await (options.fetcher ?? fetch)(
      `${config.supabaseUrl}/rest/v1/applications?select=${EXPORT_FIELDS}&order=created_at.asc&limit=1000`,
      {
        headers: databaseHeaders(config.databaseKey),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new ApplicationError(503, "Exportação indisponível.");
    const csv = applicationsToCsv(validateRows(await response.json()));
    return new Response(csv, {
      status: 200,
      headers: { ...RESPONSE_HEADERS, "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch {
    return new Response("Exportação indisponível.", { status: 503, headers: RESPONSE_HEADERS });
  }
}
