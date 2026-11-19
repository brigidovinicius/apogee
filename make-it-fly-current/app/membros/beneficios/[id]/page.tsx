import Link from "next/link";
import { notFound } from "next/navigation";
import { memberBenefitDetail } from "@/lib/benefits/store";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { PROVIDER_ACCESS_LABELS } from "@/lib/benefits/types";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { AnnualAccessNotice } from "@/components/community/annual-access-notice";
import { BenefitSaveButton, BenefitStartForm } from "@/components/benefits/member-forms";
import { benefitDate } from "@/components/benefits/workspace";
import shared from "@/components/members/members.module.css";
import styles from "@/components/benefits/benefits.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Condições do benefício", robots: { index: false, follow: false } };
export default async function BenefitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<BenefitSearchParams> }) {
  const { id } = await params, { member, access, benefit: b, redemptionStatus } = await memberBenefitDetail(id);
  const filters = await searchParams ?? {};
  const view = filters.origem === "salvos" ? "saved" : filters.origem === "resgates" ? "history" : "catalogue";
  const { listHref } = benefitNavigation(filters, view);
  const backLabel = { saved: "Voltar aos salvos", history: "Voltar aos meus resgates", catalogue: "Voltar às ofertas" }[view];
  if (access.allowed && !b) notFound();
  return <MemberWorkspace member={member} current="beneficios"><div className={`${shared.container} ${styles.root}`}>
    <Link href={`${listHref}#oferta-${encodeURIComponent(id)}`} className={styles.back}>← {backLabel}</Link>
    {!access.allowed || !b ? <><header className={styles.header}><h1>Benefícios</h1></header><AnnualAccessNotice title="Benefícios" next="/membros/beneficios" /></> : <>
      <header className={styles.header}><p className={styles.eyebrow}>{b.category_name ?? "Benefícios da comunidade"}</p><h1>{b.name}</h1><p>{b.partner}{b.provider_label ? ` · Disponibilizado por ${b.provider_label}` : ""}</p></header>
      <article className={`${styles.card} ${styles.detail}`}><div className={styles.cardTop}><p className={styles.description}>{b.description}</p><BenefitSaveButton benefitId={b.id} name={b.name} saved={b.saved} /></div>
        <h2>Antes de resgatar</h2><dl><dt>Quem pode usar</dt><dd>{b.eligibility}</dd><dt>Disponibilidade</dt><dd>{b.availability}</dd><dt>{b.verified_at ? "Última verificação" : "Vigência"}</dt><dd>{b.verified_at ? `${benefitDate(b.verified_at)}. O fornecedor não anunciou uma data de encerramento.` : <>{b.starts_at ? benefitDate(b.starts_at) : "A confirmar"} até {b.ends_at ? `${benefitDate(b.ends_at)} (fim exclusivo)` : "A confirmar"}</>}</dd><dt>No fornecedor</dt><dd>{PROVIDER_ACCESS_LABELS[b.provider_access]}</dd></dl>
        <h2>Como resgatar</h2><p className={styles.description}>{b.redemption}</p><BenefitStartForm benefitId={b.id} initialStatus={redemptionStatus} />
      </article>
    </>}<p className={styles.support}><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
