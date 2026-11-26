import { PartnerMark } from "@/components/benefits/partner-mark";
import { WorkshopVoucherCard } from "@/components/workshop-voucher/card";
import Link from "next/link";
import { Gift, Search, Bookmark, Clock3 } from "lucide-react";
import { memberBenefitWorkspace } from "@/lib/benefits/store";
import { BENEFIT_AUDIENCES, BENEFIT_PATHS, REDEMPTION_LABELS, type BenefitView, type CatalogueBenefit } from "@/lib/benefits/types";
import { orderCatalogueOffers } from "@/lib/benefits/catalogue-order";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { memberResourceAvailability } from "@/lib/members/resource-availability";
import { ResourceHeader } from "@/components/members/resource-header";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { BenefitCard } from "./benefit-card";
import navigation from "@/components/members/resource-header.module.css";
import shared from "@/components/members/members.module.css";
import styles from "./benefits.module.css";
export type { BenefitSearchParams } from "@/lib/benefits/navigation";
const titles = { catalogue: "Catálogo", saved: "Salvos", history: "Meus resgates" };
const icons = { catalogue: Gift, saved: Bookmark, history: Clock3 };
const quickCategories = ["desenvolvimento", "produtividade", "hospedagem", "design", "dados"];
export const benefitDate = (v: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(v);
function offerCard(benefit: CatalogueBenefit, detailSearch: string) {
  const validity = `Verificada em ${benefitDate(benefit.last_success_at)}`;
  return <BenefitCard key={benefit.id} benefit={benefit} validity={validity} detailSearch={detailSearch} />;
}
export async function BenefitsWorkspace({ view = "catalogue", params = {} }: { view?: BenefitView; params?: BenefitSearchParams }) {
  const { query, category, audience, detailSearch } = benefitNavigation(params, view);
  const { member, access, categories, benefits, history, totals } = await memberBenefitWorkspace(view, { query, category, audience });
  const resources = access.allowed ? await memberResourceAvailability(member.id, member.role) : null;
  const filtered = Boolean(query || category || audience);
  const ordered = view === "catalogue" ? orderCatalogueOffers(benefits) : benefits;
  const featured = view === "catalogue" && !filtered ? ordered.slice(0, 4) : [];
  const remaining = ordered.slice(featured.length);
  return <MemberWorkspace member={member} current="beneficios"><div data-ap-benefits="catalogue" className={`${shared.container} ${styles.root}`}>
    <ResourceHeader area="beneficios" showRelated={resources?.ferramentas === true} />
    {view === "catalogue" && <WorkshopVoucherCard />}
    {!access.allowed ? <LockedMemberArea kind="beneficios" next={BENEFIT_PATHS[view]} /> : <>
      <nav aria-label="Navegação de benefícios" className={navigation.tabs}>{(Object.keys(BENEFIT_PATHS) as BenefitView[]).map(key => { const Icon = icons[key]; return <Link href={BENEFIT_PATHS[key]} key={key} aria-current={view === key ? "page" : undefined}><Icon size={17} aria-hidden="true" />{titles[key]} {key !== "catalogue" && <span>{totals[key]}</span>}</Link>; })}</nav>
      {view !== "history" ? <section aria-labelledby="benefit-offers-title">
        <h2 data-ap-heading="" id="benefit-offers-title" className={styles.offerHeading}>{view === "catalogue" ? "Ofertas da Apogee" : "Ofertas salvas"}</h2>
        <form key={JSON.stringify([query, category, audience])} action={BENEFIT_PATHS[view]} method="get" className={navigation.filters} role="search" aria-label="Buscar benefícios">
          <label>{view === "catalogue" ? "Buscar oferta" : "Buscar nos salvos"}<div className={navigation.searchInput}><Search size={18} aria-hidden="true" /><input id="benefit-search" type="search" name="q" defaultValue={query} placeholder="Ferramenta ou fornecedor" maxLength={100} /></div></label>
          <label>Categoria<select name="categoria" defaultValue={category}><option value="">Todas as categorias</option>{categories.map(c => <option key={c.id} value={c.slug}>{c.name} ({c.count})</option>)}</select></label>
          <label>Público<select name="publico" defaultValue={audience}><option value="">Todos os públicos</option>{Object.entries(BENEFIT_AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit">Buscar</button>{filtered && benefits.length > 0 && <Link href={BENEFIT_PATHS[view]}>Limpar filtros</Link>}
        </form>
        {view === "catalogue" && categories.length > 0 && <nav aria-label="Acesso rápido por categoria" className={styles.quickCategories}>
          <Link href={benefitNavigation({ q: query, publico: audience }, view).listHref} aria-current={!category ? "page" : undefined}>Todas</Link>
          {quickCategories.map(slug => categories.find(option => option.slug === slug)).filter(option => option !== undefined).map(option =>
            <Link key={option.id} href={benefitNavigation({ q: query, categoria: option.slug, publico: audience }, view).listHref}
              aria-current={category === option.slug ? "page" : undefined}>{option.name}</Link>)}
        </nav>}
        {featured.length > 0 && <section aria-labelledby="featured-offer-heading" className={styles.featuredSection}>
          <h2 data-ap-heading="" id="featured-offer-heading" className={styles.offerHeading}>Ofertas em destaque</h2>
          <div className={styles.featuredGrid}>{featured.map(benefit => offerCard(benefit, detailSearch))}</div>
        </section>}
        {(!featured.length || remaining.length > 0) && <p className={styles.result} role="status">{featured.length ? "Mais ofertas" : "Ofertas encontradas"} ({remaining.length}){query ? ` para “${query}”` : ""}.</p>}
        {!benefits.length ? <section className={styles.empty}><h3 data-ap-heading="">{filtered ? "Nenhuma oferta com esses filtros" : view === "saved" ? "Nenhuma oferta salva" : "Benefícios em preparação"}</h3><p>{filtered ? "Experimente outro termo ou consulte todas as categorias." : view === "saved" ? "Salve ofertas pelo catálogo." : "As ofertas entram no catálogo após a validação dos acordos, condições e formas de resgate."}</p>{filtered ? <Link href={BENEFIT_PATHS[view]}>Limpar filtros</Link> : view === "saved" ? <Link href={BENEFIT_PATHS.catalogue}>Explorar ofertas</Link> : <Link href="/membros/oportunidades">Explorar o Radar</Link>}</section> : remaining.length > 0 && <div className={styles.cards}>{remaining.map(benefit => offerCard(benefit, detailSearch))}</div>}
      </section> : <>
        <p className={styles.explanation}>O desconto ou crédito só é confirmado após verificar o resultado no parceiro.</p>
        {!history.length ? <section className={styles.empty}><h2 data-ap-heading="">Você ainda não iniciou resgates</h2><p>Inicie o resgate na página da oferta.</p><Link href="/membros/beneficios">Explorar ofertas</Link></section> : <ol className={styles.history}>{history.map(r => <li key={r.id} id={`oferta-${r.benefit_id}`} tabIndex={-1} data-ap-card="" className={styles.card}><div className={styles.cardTop}><span className={styles.category}>{REDEMPTION_LABELS[r.status]}</span><span className={styles.historyDate}>{benefitDate(r.started_at)}</span></div><p className={styles.partner}>{r.partner_name}</p><h2 data-ap-heading=""><PartnerMark partner={r.partner_name} offerId={r.benefit_id} />{r.benefit_name}</h2><p>{r.status === "started" ? "Aguardando confirmação do resultado no parceiro." : r.status === "confirmed" ? "Resultado confirmado pela conferência administrativa." : "O parceiro não aprovou este resgate. Fale com o suporte se precisar de ajuda."}</p>{r.reviewed_at ? <p className={styles.condition}>Conferência em {benefitDate(r.reviewed_at)}.</p> : null}{r.available ? <Link className={styles.textLink} href={`/membros/beneficios/${encodeURIComponent(r.benefit_id)}${detailSearch}`}>Reabrir oferta e instruções</Link> : <p className={styles.condition}>Esta oferta não está disponível para novos resgates. Seu histórico foi preservado.</p>}</li>)}</ol>}
      </>}
      <p className={styles.footer}>Cada oferta tem requisitos próprios. Planos pagos e créditos dependem do acordo com o parceiro.</p>
    </>}<p className={styles.support}><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
