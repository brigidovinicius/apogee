import { adminDeliverables } from "@/lib/deliverables/store";
import { DeliverableEditor } from "@/components/community/deliverable-editor";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import styles from "@/components/community/deliverables.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Trilha inicial" };
export default async function LearningAdmin() {
  const { tracks, modules, activities } = await adminDeliverables();
  return <div className={styles.admin}><AdminPageHeader title="Trilha inicial" description="Conteúdo disponível somente na administração." />
    <h2>Trilhas</h2><details><summary>Nova trilha</summary><DeliverableEditor kind="track" /></details>
    {tracks.map(t => <details key={t.id}><summary>{t.name} · {t.status}</summary><DeliverableEditor kind="track" values={{ id: t.id, revision: t.revision ?? "", name: t.name, description: t.description, status: t.status, sortOrder: String(t.sort_order) }} /></details>)}
    <h2>Módulos</h2>{!tracks.length ? <p>Crie uma trilha antes de incluir módulos.</p> : <details><summary>Novo módulo</summary><DeliverableEditor kind="module" choices={tracks} /></details>}
    {modules.map(m => <details key={m.id}><summary>{m.name} · {m.status}</summary><DeliverableEditor kind="module" choices={tracks} values={{ id: m.id, revision: m.revision ?? "", trackId: m.track_id, name: m.name, description: m.description, deliverable: m.deliverable, status: m.status, sortOrder: String(m.sort_order) }} /></details>)}
    <h2>Atividades</h2>{!modules.length ? <p>Crie um módulo antes de incluir atividades.</p> : <details><summary>Nova atividade</summary><DeliverableEditor kind="activity" choices={modules} /></details>}
    {activities.map(a => <details key={a.id}><summary>{a.name} · {a.status}</summary><DeliverableEditor kind="activity" choices={modules} values={{ id: a.id, revision: a.revision ?? "", moduleId: a.module_id, name: a.name, instructions: a.instructions, resourceUrl: a.resource_url, status: a.status, sortOrder: String(a.sort_order) }} /></details>)}
  </div>;
}
