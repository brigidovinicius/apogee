import { PartnerMark } from "@/components/benefits/partner-mark";
import Link from "next/link";
import { notFound } from "next/navigation";
import { memberBenefitDetail } from "@/lib/benefits/store";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { PROVIDER_ACCESS_LABELS } from "@/lib/benefits/types";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { MonthlyQuota } from "@/components/community/radar-quota";
import { BenefitSaveButton, BenefitStartForm } from "@/components/benefits/member-forms";
import { benefitDate } from "@/components/benefits/workspace";
import { deliverableMember } from "@/lib/deliverables/store";
import { monthlyDetailState } from "@/lib/members/monthly-detail";
import { previewBenefitConditions, previewBenefitTitle } from "@/lib/benefits/preview";
import { openFreeBenefit } from "./actions";
import shared from "@/components/members/members.module.css";
import styles from "@/components/benefits/benefits.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Condições do benefício", robots: { index: false, follow: false } };
export default async function BenefitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<BenefitSearchParams> }) {
  const { id } = await params;
  const filters = await searchParams ?? {};
  const view = filters.origem === "salvos" ? "saved" : filters.origem === "resgates" ? "history" : "catalogue";
  const { listHref, detailSearch, query, category, audience } = benefitNavigation(filters, view);
  const backLabel = { saved: "Voltar aos salvos", history: "Voltar aos meus resgates", catalogue: "Voltar às ofertas" }[view];
  const path = `/membros/beneficios/${encodeURIComponent(id)}${detailSearch}`;
  const { member, access } = await deliverableMember(path);
  if (!access.allowed) {
    const offer = await previewBenefitTitle(id);
    const back = benefitNavigation(filters, "catalogue").listHref;
    const quota = offer ? await monthlyDetailState(member.id, "beneficios") : null;
    const opened = quota?.ids.includes(id) ?? false;
    const conditions = opened ? await previewBenefitConditions(id) : null;
    return <MemberWorkspace member={member} current="beneficios"><div data-ap-benefits="detail" className={`${shared.container} ${styles.root}`}>
      <Link href={`${back}#oferta-${encodeURIComponent(id)}`} className={styles.back}>← Voltar às ofertas</Link>
      <header className={styles.header}><h1>{offer && <PartnerMark partner={offer.partner} offerId={offer.id} />}{offer?.name ?? "Oferta indisponível"}</h1>{offer && <p>{offer.partner}</p>}</header>
      {quota && <MonthlyQuota quota={quota} area="Benefícios" next={path} />}
      {!offer || opened && !conditions ? <p>Esta oferta está indisponível. Consulte as ofertas vigentes no catálogo.</p> : conditions ?
        <article className={`${styles.card} ${styles.detail}`}><h2 data-ap-heading="">Condições da oferta</h2><dl>
          <dt>Quem pode usar</dt><dd>{conditions.eligibility}</dd>
          <dt>Disponibilidade</dt><dd>{conditions.availability}</dd>
          <dt>Última verificação</dt><dd>{benefitDate(new Date(conditions.last_success_at))}</dd>
          {conditions.ends_at && <><dt>Fim da vigência</dt><dd>{benefitDate(new Date(conditions.ends_at))}</dd></>}
        </dl><p>O resgate está disponível para assinantes elegíveis, conforme as condições do parceiro.</p>
          <Link href={`/comunidade?next=${encodeURIComponent(path)}#planos`} prefetch={false}>Conhecer o plano anual</Link></article> :
        Boolean(quota?.remaining) && <section className={`${styles.card} ${styles.detail}`}><h2 data-ap-heading="">Consultar condições</h2>
          <p>Abrir usa uma consulta de Benefícios. Reabrir no mesmo mês não usa outra.</p>
          <form action={openFreeBenefit.bind(null, id, { q: query, categoria: category, publico: audience })}>
            <button type="submit" className={shared.primary}>Usar consulta gratuita</button>
          </form></section>}
    </div></MemberWorkspace>;
  }
  const { benefit: b, redemptionStatus } = await memberBenefitDetail(id);
  if (!b) notFound();
  return <MemberWorkspace member={member} current="beneficios"><div data-ap-benefits="detail" className={`${shared.container} ${styles.root}`}>
    <Link href={`${listHref}#oferta-${encodeURIComponent(id)}`} className={styles.back}>← {backLabel}</Link>
      <header className={styles.header}><p className={styles.eyebrow}>{b.category_name ?? "Benefícios da comunidade"}</p><h1><PartnerMark partner={b.partner} offerId={b.id} />{b.name}</h1><p>{b.partner}{b.provider_label ? ` · Disponibilizado por ${b.provider_label}` : ""}</p></header>
      <article className={`${styles.card} ${styles.detail}`}><div className={styles.cardTop}><p className={styles.description}>{b.description}</p><BenefitSaveButton benefitId={b.id} name={b.name} saved={b.saved} /></div>
        <h2 data-ap-heading="">Antes de resgatar</h2><dl><dt>Quem pode usar</dt><dd>{b.eligibility}</dd><dt>Disponibilidade</dt><dd>{b.availability}</dd><dt>Última verificação</dt><dd>{benefitDate(b.last_success_at)}</dd>{b.ends_at && <><dt>Fim da vigência</dt><dd>{benefitDate(b.ends_at)} (fim exclusivo)</dd></>}<dt>No fornecedor</dt><dd>{PROVIDER_ACCESS_LABELS[b.provider_access]}</dd></dl>
        <h2 data-ap-heading="">Como resgatar</h2><p className={styles.description}>{b.redemption}</p><BenefitStartForm benefitId={b.id} initialStatus={redemptionStatus} />
      </article>
    <p className={styles.support}><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
