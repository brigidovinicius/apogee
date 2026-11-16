import { adminDeliverables } from "@/lib/deliverables/store";
import { DeliverableEditor } from "@/components/community/deliverable-editor";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import styles from "@/components/community/deliverables.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios" };
const date = (v: Date | null) => v ? v.toISOString().slice(0, 10) : "";
export default async function BenefitsAdmin() {
  const { benefits } = await adminDeliverables();
  return <div className={styles.admin}><AdminPageHeader title="Benefícios" description="Cadastre apenas acordos comprovados. Rascunhos e benefícios fora da vigência não aparecem para o assinante." />
    <details><summary>Novo benefício</summary><DeliverableEditor kind="benefit" /></details>
    {!benefits.length ? <p>Nenhum benefício cadastrado. Faltam os acordos e as regras concretas para anunciar esta entrega.</p> : benefits.map(b => <details key={b.id}><summary>{b.name} · {b.status}</summary><DeliverableEditor kind="benefit" values={{ id: b.id, revision: b.revision ?? "", name: b.name, partner: b.partner, description: b.description, evidenceUrl: b.evidence_url ?? "", eligibility: b.eligibility, availability: b.availability, startsAt: date(b.starts_at), endsAt: date(b.ends_at), redemption: b.redemption, redemptionUrl: b.redemption_url, status: b.status, sortOrder: String(b.sort_order) }} /></details>)}
  </div>;
}
