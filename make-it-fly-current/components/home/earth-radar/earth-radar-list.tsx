"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { selectHomeOpportunities, type HomeOpportunityCategory } from "@/lib/home-opportunities";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { OpportunityBenefits } from "@/components/opportunities/opportunity-financials";
import { OpportunityDates } from "@/components/opportunities/opportunity-dates";
import styles from "./earth-radar.module.css";

const categories: [HomeOpportunityCategory, string][] = [
  ["all", "Em destaque"], ["competicoes", "Competições e hackathons"], ["eventos", "Eventos e comunidades"],
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function EarthRadarList({ opportunities, capturedAt }: { opportunities: StudentOpportunity[]; capturedAt: string }) {
  const [category, setCategory] = useState<HomeOpportunityCategory>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date(capturedAt));
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const current = selectHomeOpportunities(opportunities, now, category, opportunities.length);
  const visible = current.filter((item) => words.every((word) => normalize(`${item.title} ${item.organization} ${item.location} ${item.kind}`).includes(word))).slice(0, 6);

  return <div className={styles["radar-product"]}>
    <div className={styles["radar-main"]}>
      <div className={styles["return-note"]}><strong>Há novas possibilidades esperando por você</strong><span>Oportunidades do Radar</span></div>
      <div className={styles["search-wrap"]}>
        <form className={styles["search-bar"]} role="search" action="/oportunidades">
          <input name="busca" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque uma área, instituição ou objetivo" aria-label="Buscar oportunidades" />
          <button type="submit">Buscar no Radar</button>
        </form>
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
          <Link prefetch={false} className={styles["opportunity-action"]} href={opportunityDetailPath(item.id)} aria-label={`Ver detalhes: ${item.title}`}>Explorar</Link>
        </article>)}
      </div>
      {!visible.length && <div className={`${styles["empty-state"]} ${styles.visible}`}>
        <p>Nenhuma oportunidade em destaque combina com esta busca, explore o catálogo completo</p>
        <button className={styles["reset-filters"]} onClick={() => { setQuery(""); setCategory("all"); }}>Limpar filtros</button>
      </div>}
      <p className={styles["demo-note"]}>Faça login para acessar uma oportunidade detalhada grátis, com acesso vitalício às demais por R$ 49,00</p>
      <Link prefetch={false} className={styles["all-link"]} href="/oportunidades">Ver o Radar completo</Link>
    </div>
  </div>;
}
