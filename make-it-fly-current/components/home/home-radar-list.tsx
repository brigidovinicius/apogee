"use client";

import { interfaceText } from "@/lib/presentation-text.mjs";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { selectHomeOpportunities, type HomeOpportunityCategory } from "@/lib/home-opportunities";
import styles from "./editorial-home.module.css";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";

const categories: ReadonlyArray<{ id: HomeOpportunityCategory; label: string; href: string }> = [
  { id: "all", label: "Em destaque", href: "/oportunidades" },
  { id: "competicoes", label: "Competições e hackathons", href: "/oportunidades?categoria=competicoes" },
  { id: "eventos", label: "Eventos e comunidades", href: "/oportunidades?categoria=eventos" },
];

export function HomeRadarList({ opportunities, capturedAt }: { opportunities: StudentOpportunity[]; capturedAt: string }) {
  const [category, setCategory] = useState<HomeOpportunityCategory>("all");
  const [now, setNow] = useState(() => new Date(capturedAt));
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const items = selectHomeOpportunities(opportunities, now, category, 4);

  return <div>
    <nav className={styles.radarCategories} aria-label="Prévia por categoria">
      {categories.map((item) => <Link prefetch={false} key={item.id} href={item.href} aria-current={category === item.id ? "true" : undefined}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); setCategory(item.id); setNow(new Date());
        }}>{item.label}</Link>)}
    </nav>
    <div aria-live="polite" aria-atomic="true">
      {items.length ? <ul className={styles.opportunities}>
        {items.map((item) => <li key={item.id}>
          <Link prefetch={false} href={opportunityDetailPath(item.id)} className={styles.opportunity}>
            <div>
              <p className={styles.opportunityOrganization}>{interfaceText(item.organization)} · {item.kind}</p>
              <h3>{interfaceText(item.title)}</h3>
              <p>{interfaceText(item.deadlineLabel)}</p>
            </div>
            <p className={styles.opportunityBenefit}>{interfaceText(item.benefit)}</p>
            <span className={styles.rowArrow} aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span>
            <span className={styles.srOnly}>Ver detalhes da oportunidade</span>
          </Link>
        </li>)}
      </ul> : <p className={styles.catalogueMessage}>Nenhuma oportunidade disponível nesta prévia agora. Explore as outras categorias no Radar.</p>}
    </div>
    <p className={styles.catalogueNote}>Faça login para acessar uma oportunidade detalhada grátis. Acesso vitalício às demais por R$ 49,00.</p>
  </div>;
}
