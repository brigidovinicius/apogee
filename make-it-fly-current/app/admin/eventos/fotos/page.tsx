import { and, eq, inArray } from "drizzle-orm";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import { WORKSHOP, WORKSHOP_REFERENCES_PATH } from "@/lib/eventos/catalogo";
import { albumConfig, albumWorker, canAccessAlbum, readAlbum } from "@/lib/eventos/fotos";
import { requireAdmin } from "@/lib/members/dal";
import { getDb } from "@/lib/members/db";
import { user } from "@/lib/members/schema";
import { ReferenceEditor } from "./reference-editor";

export const metadata = { title: "Marcações de fotos", referrer: "no-referrer" as const };

async function referenceData() {
  const config = albumConfig();
  if (!config?.selfie) return null;
  const [album, response] = await Promise.all([readAlbum(config, true), albumWorker(config, "/references")]);
  if (!album || !response.ok) return null;
  const { members } = await response.json();
  if (!Array.isArray(members)) return null;
  const ids = [...new Set<string>(members.filter((id: unknown): id is string =>
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id) && canAccessAlbum(id, config)
  ))];
  const participants = ids.length ? await getDb().select({ id: user.id, name: user.name, username: user.username })
    .from(user).where(and(inArray(user.id, ids), eq(user.blocked, false))).orderBy(user.name) : [];
  return { photos: album.photos.map(photo => photo.id), participants };
}

export default async function WorkshopReferencesPage() {
  await requireAdmin(WORKSHOP_REFERENCES_PATH);
  const data = await referenceData().catch(() => null);
  return <div className={adminStyles.content}>
    <AdminPageHeader title="Marcações de fotos" description={WORKSHOP.title} />
    {data ? <ReferenceEditor {...data} /> :
      <p role="status">As marcações estão indisponíveis no momento.</p>}
  </div>;
}
