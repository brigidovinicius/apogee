import Link from "next/link";
import { memberBenefits } from "@/lib/deliverables/store";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { AnnualAccessNotice } from "@/components/community/annual-access-notice";
import styles from "@/components/members/members.module.css";
import local from "@/components/community/deliverables.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios", robots: { index: false, follow: false } };
const date = (v: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(v);
export default async function BenefitsPage() {
  const { member, access, benefits } = await memberBenefits();
  return <MemberWorkspace member={member} current="beneficios"><div className={styles.container}>
    <header className={styles.pageHead}><div><p className={styles.eyebrow}>Comunidade Apogee</p><h1 className={styles.title}>Benefícios.</h1><p className={styles.lead}>Ofertas de parceiros e condições de acesso.</p></div></header>
    <div className={local.section}>{!access.allowed ? <AnnualAccessNotice title="Benefícios" next="/membros/beneficios" /> : !benefits.length ? <section className={local.card}><h2>Benefícios em preparação</h2><p>Ainda não há ofertas disponíveis. As condições e o resgate aparecerão aqui quando forem confirmados.</p><Link href="/membros/trilha">Continuar na Trilha inicial</Link></section> : benefits.map(b => <article className={local.card} key={b.id}>
      <h2>{b.name}</h2><p>Parceiro: {b.partner}</p><p className={local.instructions}>{b.description}</p>
      <h3>Condições</h3><p className={local.instructions}>Elegibilidade: {b.eligibility}</p><p className={local.instructions}>Disponibilidade: {b.availability}</p>
      <p>Vigência: {b.starts_at ? date(b.starts_at) : "A confirmar"} até {b.ends_at ? date(b.ends_at) : "A confirmar"}.</p>
      <h3>Como resgatar</h3><p className={local.instructions}>{b.redemption}</p>{b.redemption_url ? <a href={b.redemption_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir resgate no parceiro (nova aba)</a> : null}
    </article>)}</div><p><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
