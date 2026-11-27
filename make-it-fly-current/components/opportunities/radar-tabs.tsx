import Link from "next/link";
import styles from "@/components/members/resource-header.module.css";
import personal from "@/components/members/radar-personalization.module.css";
import { RADAR_FOR_YOU } from "@/lib/opportunities/radar-preferences";

export function RadarTabs({ current, calendar, collections }: {
  current: "catalogue" | "for-you"; calendar?: boolean; collections?: boolean;
}) {
  return <nav className={`${styles.tabs} ${personal.tabs}`} aria-label="Seus recursos do Radar">
    <Link href={RADAR_FOR_YOU} aria-current={current === "for-you" ? "page" : undefined}>Para você</Link>
    <Link href="/membros/oportunidades" aria-current={current === "catalogue" ? "page" : undefined}>Catálogo</Link>
    {calendar && <Link href="/membros/meu-calendario">Meu calendário</Link>}
    {collections && <Link href="/membros/colecoes">Minhas coleções</Link>}
  </nav>;
}
