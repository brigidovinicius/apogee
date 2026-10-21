import "server-only";
import { count, desc, ilike, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/access";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { getDb } from "@/lib/members/db";
import { storeDropSignup } from "@/lib/members/schema";

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10_000;
const columns = {
  id: storeDropSignup.id,
  name: storeDropSignup.name,
  phone: storeDropSignup.phone,
  email: storeDropSignup.email,
  consentedAt: storeDropSignup.consentedAt,
};

export type DropSignupRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  consentedAt: Date;
};

export type DropSignupList = {
  rows: DropSignupRow[];
  search: string;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export function normalizeDropSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function searchCondition(search: string) {
  if (!search) return undefined;
  // Treat SQL wildcard characters as literal search text; values stay parameterized.
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const digits = /^[+\d\s().-]+$/.test(search) ? search.replace(/\D/g, "") : "";
  return or(
    ilike(storeDropSignup.name, pattern),
    ilike(storeDropSignup.email, pattern),
    ilike(storeDropSignup.phone, digits ? `%${digits}%` : pattern),
  );
}

export async function listDropSignups(rawSearch: unknown, rawPage: unknown): Promise<DropSignupList> {
  await requireAdmin("/admin/loja/drops");
  const search = normalizeDropSearch(rawSearch);
  const db = getDb();
  const where = searchCondition(search);
  const [totals] = await db.select({ value: count() }).from(storeDropSignup).where(where);
  const total = totals?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = typeof rawPage === "string" && /^[1-9]\d{0,8}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.min(requested, pageCount);
  const rows = await db.select(columns).from(storeDropSignup).where(where)
    .orderBy(desc(storeDropSignup.consentedAt), desc(storeDropSignup.id))
    .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  return { rows, total, search, page, pageCount, pageSize: PAGE_SIZE };
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function csvCell(value: string, forceText = false) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  // Prevent formula execution and preserve phone prefixes/leading zeroes in spreadsheets.
  const safe = forceText || /^[\s]*[=+@-]/u.test(clean) ? `'${clean}` : clean;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function dropSignupsToCsv(rows: DropSignupRow[]): string {
  const lines = [["Nome", "Telefone", "E-mail", "Data do cadastro (Brasília)"].map(value => csvCell(value)).join(";")];
  for (const row of rows) {
    lines.push([csvCell(row.name), csvCell(row.phone, true), csvCell(row.email), csvCell(dateTime.format(row.consentedAt))].join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const exportHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function exportDropSignups(request: Request): Promise<Response> {
  const failure = (message: string, status: number) => Response.json({ message }, { status, headers: exportHeaders });
  try {
    const member = await getMemberFromHeaders(request.headers);
    if (!member) return failure("Entre novamente para exportar os cadastros.", 401);
    if (member.role !== "admin") return failure("Acesso restrito a administradores.", 403);
    const search = normalizeDropSearch(new URL(request.url).searchParams.get("busca"));
    const rows = await getDb().select(columns).from(storeDropSignup).where(searchCondition(search))
      .orderBy(desc(storeDropSignup.consentedAt), desc(storeDropSignup.id)).limit(EXPORT_LIMIT + 1);
    if (rows.length > EXPORT_LIMIT) return failure("Há mais de 10.000 cadastros. Refine a busca para exportar todos os resultados do filtro.", 413);
    return new Response(dropSignupsToCsv(rows), { headers: {
      ...exportHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cadastros-drops-apogee.csv"',
    } });
  } catch {
    return failure("Não foi possível exportar os cadastros. Tente novamente.", 503);
  }
}
