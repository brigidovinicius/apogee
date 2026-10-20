// Bootstrap explícito: não concede o papel admin, exige admin já existente e ativo.
// Executar no ambiente alvo somente após autorização própria para banco/permissão.
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { AdminRoleError, bootstrapTarget, databaseOptions, verifiedBootstrapAccount } from "./members-grant-admin.mjs";

export async function grantInvitationManager(sql, email, expectedUserId) {
  const target = bootstrapTarget(email, expectedUserId);
  return sql.begin(async (tx) => {
    const account = await verifiedBootstrapAccount(tx, target);
    if (account.role !== "admin") throw new AdminRoleError("Exige um administrador ativo existente.");
    if (account.can_manage_admins !== true && account.can_manage_admins !== false) throw new AdminRoleError("Capacidade atual inválida.");
    if (!account.can_manage_admins) {
      const updated = await tx`update "user" set can_manage_admins = true, updated_at = now()
        where id = ${account.id} and role = 'admin' and email_verified = true and blocked = false and can_manage_admins = false
        returning can_manage_admins`;
      if (updated.length !== 1 || updated[0].can_manage_admins !== true) throw new AdminRoleError("A concessão não alterou exatamente a conta alvo.");
    }
    return { id: account.id, changed: !account.can_manage_admins, capability: "manage_admin_invitations" };
  });
}
async function main() {
  const target = bootstrapTarget(process.env.MEMBERS_INVITATION_MANAGER_EMAIL, process.env.MEMBERS_INVITATION_MANAGER_USER_ID);
  const { url, options } = databaseOptions();
  const sql = postgres(url, options);
  try { console.log(JSON.stringify({ ...await grantInvitationManager(sql, target.email, target.userId), occurredAt: new Date().toISOString() })); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Não foi possível conceder a autorização. Nenhuma concessão foi confirmada."); process.exitCode = 1; });
}
