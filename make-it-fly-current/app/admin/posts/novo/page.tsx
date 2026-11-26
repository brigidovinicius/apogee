import Link from "next/link";
import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { PostEditor } from "../post-editor";

export const dynamic = "force-dynamic";

export default async function AdminNewPostPage() {
  await requireAdmin("/admin/posts/novo");
  return <div className={styles.content}>
    <AdminPageHeader title="Novo artigo" aside={<Link className={styles.secondaryButton} href="/admin/posts">Voltar aos artigos</Link>} />
    <PostEditor post={null} />
  </div>;
}
