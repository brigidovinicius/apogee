import { adminDeliverables } from "@/lib/deliverables/store";
import { DeliverableEditor } from "@/components/community/deliverable-editor";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import styles from "@/components/community/deliverables.module.css";
import { adminBenefitWorkspace } from "@/lib/benefits/store";
import { REDEMPTION_LABELS } from "@/lib/benefits/types";
import { BenefitCategoryForm, BenefitRedemptionReview } from "@/components/benefits/admin-forms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios" };
const date = (v: Date | null) => v ? v.toISOString().slice(0, 10) : "";
export default async function BenefitsAdmin() {
  const { benefits } = await adminDeliverables();
  const { categories, organization, redemptions } = await adminBenefitWorkspace();
  const choices = categories.map(c => ({ id: c.id, name: `${c.name} · ${c.status}` }));
  return <div className={styles.admin}><AdminPageHeader title="Benefícios" description="Cadastre apenas acordos comprovados. Rascunhos e benefícios fora da vigência não aparecem para o assinante." />
    <h2>Ofertas</h2><details><summary>Novo benefício</summary><DeliverableEditor kind="benefit" choices={choices} /></details>
    {!benefits.length ? <p>Nenhum benefício cadastrado. Faltam os acordos e as regras concretas para anunciar esta entrega.</p> : benefits.map(b => { const o = organization.find(row => row.benefit_id === b.id); return <details key={b.id}><summary>{b.name} · {b.status}</summary><DeliverableEditor kind="benefit" choices={choices} values={{ id: b.id, revision: b.revision ?? "", name: b.name, partner: b.partner, description: b.description, evidenceUrl: b.evidence_url ?? "", eligibility: b.eligibility, availability: b.availability, startsAt: date(b.starts_at), endsAt: date(b.ends_at), redemption: b.redemption, redemptionUrl: b.redemption_url, status: b.status, sortOrder: String(b.sort_order), categoryId: o?.category_id ?? "", providerLabel: o?.provider_label ?? "", providerAccess: o?.provider_access ?? "unconfirmed", sourceUrl: o?.source_url ?? "" }} /></details>; })}
    <h2>Categorias</h2><details><summary>Nova categoria</summary><BenefitCategoryForm /></details>{categories.map(c => <details key={c.id}><summary>{c.name} · {c.status}</summary><BenefitCategoryForm category={c} /></details>)}
    <h2>Conferência de resgates</h2><p>Últimos 100 pedidos. Abrir uma oferta registra somente o início; confirme o resultado após conferir evidência do parceiro.</p>
    {!redemptions.length ? <p>Nenhum resgate iniciado.</p> : redemptions.map(r => <details key={r.id}><summary>{r.benefit_name} · {REDEMPTION_LABELS[r.status]}</summary><p>Conta: {r.user_id} · Iniciado em {r.started_at.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p><BenefitRedemptionReview redemption={r} /></details>)}
  </div>;
}
