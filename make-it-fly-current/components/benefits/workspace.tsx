import Link from "next/link";
import { Gift, ArrowRight, Search, Bookmark, Clock3 } from "lucide-react";
import { memberBenefitWorkspace } from "@/lib/benefits/store";
import { BENEFIT_PATHS, REDEMPTION_LABELS, type BenefitView } from "@/lib/benefits/types";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { AnnualAccessNotice } from "@/components/community/annual-access-notice";
import { BenefitCard } from "./benefit-card";
import shared from "@/components/members/members.module.css";
import styles from "./benefits.module.css";
export type BenefitSearchParams = Record<string, string | string[] | undefined>;
const titles = { catalogue: "Catálogo", saved: "Salvos", history: "Meus resgates" };
const icons = { catalogue: Gift, saved: Bookmark, history: Clock3 };
export const benefitDate = (v: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(v);
export async function BenefitsWorkspace({ view = "catalogue", params = {} }: { view?: BenefitView; params?: BenefitSearchParams }) {
  const query = typeof params.q === "string" ? params.q.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100) : "";
  const category = typeof params.categoria === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.categoria) ? params.categoria.slice(0, 80) : "";
  const { member, access, categories, benefits, history, totals } = await memberBenefitWorkspace(view, { query, category });
  return <MemberWorkspace member={member} current="beneficios"><div className={`${shared.container} ${styles.root}`}>
    <header className={styles.header}><h1>Benefícios</h1><p>Encontre descontos, créditos e licenças de software e confira quem pode resgatar cada oferta.</p></header>
    {!access.allowed ? <AnnualAccessNotice title="Benefícios" next={BENEFIT_PATHS[view]} /> : <>
      <nav aria-label="Navegação de benefícios" className={styles.tabs}>{(Object.keys(BENEFIT_PATHS) as BenefitView[]).map(key => { const Icon = icons[key]; return <Link href={BENEFIT_PATHS[key]} key={key} aria-current={view === key ? "page" : undefined}><Icon size={17} aria-hidden="true" />{titles[key]} {key !== "catalogue" && <span>{totals[key]}</span>}</Link>; })}</nav>
      {view !== "history" ? <section aria-labelledby="benefit-offers-title">
        <h2 id="benefit-offers-title" className={styles.offerHeading}>{view === "catalogue" ? "Ofertas cadastradas pela Apogee" : "Ofertas salvas"}</h2>
        <form action={BENEFIT_PATHS[view]} method="get" className={styles.filters} role="search" aria-label="Buscar benefícios">
          <label>Buscar oferta<div className={styles.searchInput}><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={query} placeholder="Ferramenta, parceiro ou finalidade" maxLength={100} /></div></label>
          <label>Categoria<select name="categoria" defaultValue={category}><option value="">Todas as categorias</option>{categories.map(c => <option key={c.id} value={c.slug}>{c.name} ({c.count})</option>)}</select></label>
          <button type="submit" className={styles.primary}>Buscar</button>{query || category ? <Link href={BENEFIT_PATHS[view]}>Limpar filtros</Link> : null}
        </form>
        <p className={styles.result} role="status">{benefits.length} {benefits.length === 1 ? "oferta encontrada" : "ofertas encontradas"}{query ? ` para “${query}”` : ""}.</p>
        {!benefits.length ? <section className={styles.empty}><Gift size={26} aria-hidden="true" /><h3>{query || category ? "Nenhuma oferta com esses filtros" : view === "saved" ? "Suas ofertas salvas ficam aqui" : "Benefícios em preparação"}</h3><p>{query || category ? "Experimente outro termo ou consulte todas as categorias." : view === "saved" ? "Salve uma oferta do catálogo para encontrá-la com facilidade depois." : "Ainda não há ofertas disponíveis. Elas aparecerão quando os acordos, as condições e o resgate estiverem confirmados."}</p><Link href={view === "catalogue" && !query && !category ? "/membros/ferramentas" : "/membros/beneficios"}>{view === "catalogue" && !query && !category ? "Explorar a Caixa de ferramentas" : "Ver catálogo"}</Link></section> : <div className={styles.cards}>{benefits.map(benefit => {
          const validity = benefit.verified_at ? `Verificada em ${benefitDate(benefit.verified_at)}` : benefit.ends_at ? `Até ${benefitDate(benefit.ends_at)} (fim exclusivo)` : "Confira a vigência";
          return <BenefitCard key={benefit.id} benefit={benefit} validity={validity} />;
        })}</div>}
      </section> : <>
        <p className={styles.explanation}>Iniciar um resgate registra sua intenção. O desconto ou crédito só aparece como confirmado após conferência do resultado no parceiro.</p>
        {!history.length ? <section className={styles.empty}><Clock3 size={26} aria-hidden="true" /><h2>Você ainda não iniciou resgates</h2><p>Abra uma oferta do catálogo, confira os requisitos e inicie o resgate. O acompanhamento ficará aqui.</p><Link href="/membros/beneficios">Explorar ofertas</Link></section> : <ol className={styles.history}>{history.map(r => <li key={r.id} className={styles.card}><div className={styles.cardTop}><span className={styles.category}>{REDEMPTION_LABELS[r.status]}</span><span className={styles.historyDate}>{benefitDate(r.started_at)}</span></div><p className={styles.partner}>{r.partner_name}</p><h2>{r.benefit_name}</h2><p>{r.status === "started" ? "Aguardando confirmação do resultado no parceiro." : r.status === "confirmed" ? "Resultado confirmado pela conferência administrativa." : "O parceiro não aprovou este resgate. Fale com o suporte se precisar de ajuda."}</p>{r.reviewed_at ? <p className={styles.condition}>Conferência em {benefitDate(r.reviewed_at)}.</p> : null}{r.available ? <Link className={styles.textLink} href={`/membros/beneficios/${r.benefit_id}`}>Reabrir oferta e instruções <ArrowRight size={17} aria-hidden="true" /></Link> : <p className={styles.condition}>Esta oferta não está disponível para novos resgates. Seu histórico foi preservado.</p>}</li>)}</ol>}
      </>}
      <p className={styles.footer}>As ofertas seguem requisitos próprios. A assinatura Apogee inclui os benefícios expressamente formalizados, conforme suas condições; não inclui automaticamente planos pagos ou créditos de todas as ferramentas.</p>
    </>}<p className={styles.support}><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
