import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { previewBenefitCatalogue } from "@/lib/benefits/preview";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { BENEFIT_AUDIENCES, BENEFIT_PATHS } from "@/lib/benefits/types";
import { MonthlyQuota } from "@/components/community/radar-quota";
import { monthlyDetailState } from "@/lib/members/monthly-detail";
import navigation from "@/components/members/resource-header.module.css";
import shared from "@/components/members/members.module.css";
import styles from "./benefits.module.css";

export async function BenefitPreviewCatalogue({ params, userId }: { params: BenefitSearchParams; userId?: string }) {
  const { query, category, audience, detailSearch, listHref } = benefitNavigation(params, "catalogue");
  const base = userId ? BENEFIT_PATHS.catalogue : "/beneficios";
  const [catalogue, quota] = await Promise.all([
    previewBenefitCatalogue({ query, category, audience }).catch(() => null),
    userId ? monthlyDetailState(userId, "beneficios") : null,
  ]);

  return <div className={`${shared.container} ${styles.root}`} data-public-catalogue={!userId || undefined}>
    <header className={styles.header}><h1>Benefícios</h1><p>Explore as ofertas e use sua conta gratuita para consultar até 10 condições de oferta por mês.</p></header>
    {quota ? <MonthlyQuota quota={quota} area="Benefícios" next={listHref} /> : <p><Link href={`/membros/cadastro?next=${encodeURIComponent(listHref)}`} prefetch={false}>Criar conta gratuita</Link> para consultar os detalhes.</p>}
    {catalogue ? <section aria-labelledby="preview-benefit-heading">
      <h2 id="preview-benefit-heading" className={styles.offerHeading}>Ofertas da Apogee</h2>
      <form key={JSON.stringify([query, category, audience])} action={base} method="get" className={navigation.filters} role="search" aria-label="Buscar benefícios">
        <label>Buscar oferta<div className={navigation.searchInput}><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={query} placeholder="Oferta ou parceiro" maxLength={100} /></div></label>
        <label>Categoria<select name="categoria" defaultValue={category}><option value="">Todas as categorias</option>{catalogue.categories.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
        <label>Público<select name="publico" defaultValue={audience}><option value="">Todos os públicos</option>{Object.entries(BENEFIT_AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit">Buscar</button>{(query || category || audience) && <Link href={base}>Limpar filtros</Link>}
      </form>
      <p className={styles.result} role="status">Ofertas encontradas ({catalogue.offers.length}).</p>
      {catalogue.offers.length > 0 ? <div className={styles.cards}>{catalogue.offers.map(offer => <article key={offer.id} id={`oferta-${offer.id}`} tabIndex={-1} className={styles.card}>
        <div className={styles.cardTop}><span className={styles.category}>{offer.category ?? "Geral"}</span></div>
        <p className={styles.partner}>{offer.partner}</p><h3 className={styles.previewTitle}>{offer.name}</h3><p>{BENEFIT_AUDIENCES[offer.audience]}</p>
        <Link href={`${BENEFIT_PATHS.catalogue}/${encodeURIComponent(offer.id)}${detailSearch}`} prefetch={false} className={styles.textLink}
          aria-label={`Ver condições da oferta: ${offer.name}`}>Ver condições <ArrowRight size={17} aria-hidden="true" /></Link>
      </article>)}</div> : <p className={styles.empty}>{query || category || audience ? "Nenhuma oferta com esses filtros." : "Sem ofertas vigentes no momento."}</p>}
    </section> : <p role="alert">O catálogo está temporariamente indisponível. Tente novamente em instantes.</p>}
  </div>;
}
