"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { selectHomeOpportunities, type HomeOpportunityCategory } from "@/lib/home-opportunities";
import { publicOpportunityPath } from "@/lib/opportunities/discovery";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { OpportunityDates } from "@/components/opportunities/opportunity-dates";
import styles from "./journal-home.module.css";

const categories: [HomeOpportunityCategory, string][] = [
  ["all", "Em destaque"], ["competicoes", "Competições e hackathons"], ["eventos", "Eventos e comunidades"],
];

export function HomeRadarCarousel({ opportunities, capturedAt }: { opportunities: StudentOpportunity[]; capturedAt: string }) {
  const [category, setCategory] = useState<HomeOpportunityCategory>("all");
  const [now, setNow] = useState(() => new Date(capturedAt));
  const [edges, setEdges] = useState({ start: true, end: false });
  const track = useRef<HTMLUListElement>(null);
  const visible = selectHomeOpportunities(opportunities, now, category, 6);
  const itemKey = visible.map(item => item.id).join(",");

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setEdges({ start: element.scrollLeft < 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [itemKey]);

  function scrollCards(direction: number) {
    const element = track.current;
    if (!element) return;
    const card = element.firstElementChild;
    const gap = Number.parseFloat(window.getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * ((card?.getBoundingClientRect().width ?? element.clientWidth) + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <div className={styles.radarCarousel}>
    <div className={styles.radarToolbar}>
      <nav className={styles.radarFilters} aria-label="Categorias de oportunidades">
        {categories.map(([id, label]) => <button data-ap-chip="" key={id} type="button" aria-pressed={category === id} onClick={() => {
          setCategory(id);
          track.current?.scrollTo({ left: 0, behavior: "instant" });
        }}>{label}</button>)}
      </nav>
      <div className={styles.carouselControls} aria-label="Navegar pelas oportunidades">
        <button data-ap-button="secondary" type="button" aria-label="Oportunidades anteriores" aria-controls="home-radar-cards" disabled={edges.start || !visible.length} onClick={() => scrollCards(-1)}><ArrowLeft size={18} aria-hidden="true" /></button>
        <button data-ap-button="secondary" type="button" aria-label="Próximas oportunidades" aria-controls="home-radar-cards" disabled={edges.end || !visible.length} onClick={() => scrollCards(1)}><ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </div>
    <p className={styles.srOnly} role="status">{visible.length} oportunidades em destaque.</p>
    <ul id="home-radar-cards" ref={track} className={styles.radarTrack} tabIndex={visible.length ? 0 : undefined} aria-label="Oportunidades em destaque, role para o lado">
      {visible.map((item) => <li key={item.id} className={styles.opportunity}>
        <article>
          <div className={styles.opportunityTop}><span>{item.kind}</span></div>
          <h3>{interfaceText(item.title)}</h3>
          <p className={styles.opportunityOrg}>{interfaceText(item.organization)}</p>
          <OpportunityDates opportunity={item} className={styles.opportunityDates} />
          <Link prefetch={false} className={styles.opportunityAction} href={publicOpportunityPath(item)} aria-label={`Ver resumo da oportunidade: ${item.title}`}>Ver resumo</Link>
        </article>
      </li>)}
    </ul>
    {!visible.length && <div className={styles.catalogueMessage}>
      <p>Nenhuma oportunidade em destaque nesta categoria agora.</p>
      <Link href="/oportunidades" prefetch={false}>Explorar o catálogo completo</Link>
    </div>}
    <p className={styles.radarNote}>Consulte até 10 oportunidades por mês gratuitamente.</p>
  </div>;
}
