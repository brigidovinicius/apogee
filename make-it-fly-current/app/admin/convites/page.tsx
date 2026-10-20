import { eq } from "drizzle-orm";
import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { InvitationManager } from "@/components/members/invitation-manager";
import { requireAdmin } from "@/lib/admin/access";
import { getDb } from "@/lib/members/db";
import { user } from "@/lib/members/schema";
import { listInvitations } from "@/lib/members/invitations";
import { memberMailAvailable } from "@/lib/members/mail";

export const dynamic = "force-dynamic";
export default async function InvitationsPage() {
  const admin = await requireAdmin("/admin/convites");
  const [account] = await getDb().select({ canManageAdmins: user.canManageAdmins }).from(user).where(eq(user.id, admin.id));
  const invitations = await listInvitations(admin.id);
  return <div className={styles.content}>
    <AdminPageHeader title="Convites" description="Convide membros e acompanhe a aceitação. Administradores exigem autorização específica para gerenciar administradores." />
    <InvitationManager initialInvitations={invitations} canManageAdmins={account?.canManageAdmins ?? false} mailAvailable={memberMailAvailable()} />
  </div>;
}
