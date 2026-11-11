"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { selectHomeOpportunities, type HomeOpportunityCategory } from "@/lib/home-opportunities";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { OpportunityBenefits } from "@/components/opportunities/opportunity-financials";
import { OpportunityDates } from "@/components/opportunities/opportunity-dates";
import { OpportunitySearchSuggestions } from "@/components/opportunities/search-suggestions";
import defaultStyles from "./earth-radar.module.css";

const categories: [HomeOpportunityCategory, string][] = [
  ["all", "Em destaque"], ["competicoes", "Competições e hackathons"], ["eventos", "Eventos e comunidades"],
];

export function EarthRadarList({ opportunities, capturedAt, classNames }: { opportunities: StudentOpportunity[]; capturedAt: string; classNames?: Record<string, string> }) {
  const styles = classNames ?? defaultStyles;
  const [category, setCategory] = useState<HomeOpportunityCategory>("all");
  const [now, setNow] = useState(() => new Date(capturedAt));
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const visible = selectHomeOpportunities(opportunities, now, category, 6);

  return <div className={styles["radar-product"]}>
    <div className={styles["radar-main"]}>
      <div className={styles["return-note"]}><strong>Há novas possibilidades esperando por você</strong><span>Oportunidades do Radar</span></div>
      <div className={styles["search-wrap"]}>
        <form className={styles["search-bar"]} role="search" action="/oportunidades" method="get">
          <input name="busca" type="search" maxLength={100} list="home-radar-search-suggestions" placeholder="Evento, tema ou instituição" aria-label="Buscar evento, tema ou instituição" aria-describedby="home-radar-search-hint" />
          <OpportunitySearchSuggestions id="home-radar-search-suggestions" />
          <button type="submit">Buscar no Radar</button>
        </form>
        <p id="home-radar-search-hint" className={styles["demo-note"]}>Busque em todo o Radar. Abaixo, explore alguns destaques.</p>
      </div>
      <nav className={styles["quick-filters"]} aria-label="Categorias de oportunidades">
        {categories.map(([id, label]) => <button key={id} type="button" aria-pressed={category === id} className={`${styles["quick-filter"]} ${category === id ? styles.active : ""}`} onClick={() => setCategory(id)}>{label}</button>)}
      </nav>
      <p className={styles["result-count"]} role="status">{visible.length} {visible.length === 1 ? "oportunidade em destaque" : "oportunidades em destaque"}</p>
      <div className={styles["list-head"]} aria-hidden="true"><span>Oportunidade</span><span>Datas e local</span><span /></div>
      <div className={styles.opportunities}>
        {visible.map((item) => <article key={item.id} className={styles.opportunity}>
          <div className={styles["opportunity-copy"]}>
            <p className={styles["opportunity-kicker"]}>{item.kind}</p>
            <h3><Link prefetch={false} href={opportunityDetailPath(item.id)}>{interfaceText(item.title)}</Link></h3>
            <p className={styles["opportunity-org"]}>{interfaceText(item.organization)}</p>
            <OpportunityBenefits opportunity={item} className={styles["opportunity-benefits"]} />
          </div>
          <div className={styles["opportunity-meta"]}>
            <OpportunityDates opportunity={item} className={styles["opportunity-dates"]} />
            <span>Local: {interfaceText(item.location)}</span>
          </div>
          <Link prefetch={false} className={styles["opportunity-action"]} href={opportunityDetailPath(item.id)} aria-label={`Ver detalhes: ${item.title}`}>Ver detalhes</Link>
        </article>)}
      </div>
      {!visible.length && <div className={[styles["empty-state"], styles.visible].filter(Boolean).join(" ")}>
        <p>Nenhuma oportunidade em destaque nesta categoria agora. Explore o catálogo completo.</p>
        <button className={styles["reset-filters"]} onClick={() => setCategory("all")}>Limpar filtros</button>
      </div>}
      <p className={styles["demo-note"]}>Faça login para acessar uma oportunidade detalhada grátis, com acesso vitalício às demais por R$ 49,00</p>
      <Link prefetch={false} className={styles["all-link"]} href="/oportunidades">Ver o Radar completo</Link>
    </div>
  </div>;
}
