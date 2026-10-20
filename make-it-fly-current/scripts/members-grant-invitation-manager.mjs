// Bootstrap explícito: não concede o papel admin, exige admin já existente e ativo.
// Executar no ambiente alvo somente após autorização própria para banco/permissão.
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

export async function grantInvitationManager(sql, email) {
  return sql.begin(async (tx) => {
    const rows = await tx`select id, role, blocked, can_manage_admins from "user" where lower(email) = lower(${email}) for update`;
    if (rows.length !== 1 || rows[0].role !== "admin" || rows[0].blocked) throw new Error("Exige exatamente um administrador ativo existente.");
    const [account] = rows;
    if (!account.can_manage_admins) await tx`update "user" set can_manage_admins = true, updated_at = now() where id = ${account.id}`;
    return { id: account.id, changed: !account.can_manage_admins, capability: "manage_admin_invitations" };
  });
}
async function main() {
  const email = process.env.MEMBERS_INVITATION_MANAGER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail alvo inválido.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, options);
  try { console.log(JSON.stringify({ ...await grantInvitationManager(sql, email), occurredAt: new Date().toISOString() })); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Não foi possível conceder a autorização. Nenhuma concessão foi confirmada."); process.exitCode = 1; });
}
