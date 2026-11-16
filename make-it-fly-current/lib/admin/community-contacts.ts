import "server-only";
import { requireAdmin } from "./access";
import { getSql } from "@/lib/members/db";

export type CommunityContactRow = { id: string; name: string; email: string; goal: string; consented_at: Date };
export async function listCommunityContacts(rawPage: unknown) {
  await requireAdmin("/admin/comunidade");
  const sql = getSql();
  const [count] = await sql<{ total: number }[]>`select count(*)::int as total from community_contact where campaign='codex'`;
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 50));
  const requested = typeof rawPage === "string" && /^[1-9]\d{0,7}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.min(requested, pageCount);
  const raw = await sql<(Omit<CommunityContactRow, "consented_at"> & {consented_at: Date | string})[]>`select id,name,email,goal,consented_at from community_contact
    where campaign='codex' order by consented_at desc,id desc limit 50 offset ${(page - 1) * 50}`;
  // Drizzle configures this shared driver's timestamp parser to return strings.
  const rows: CommunityContactRow[] = raw.map(row => ({...row, consented_at: typeof row.consented_at === "string" ? new Date(row.consented_at) : row.consented_at}));
  return { rows, page, pageCount, total };
}
