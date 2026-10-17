import Link from "next/link";
import { listPublicOpportunities } from "@/lib/opportunities/access";
import { homeOpportunitySnapshot } from "@/lib/home-opportunities";
import { HomeRadarList } from "./home-radar-list";
import styles from "./editorial-home.module.css";

export async function HomeRadar() {
  const catalogue = await listPublicOpportunities().catch(() => null);
  if (catalogue === null) {
    return <div className={styles.catalogueMessage}>
      <p>A prévia do Radar está temporariamente indisponível.</p>
      <Link prefetch={false} href="/oportunidades">Abrir o catálogo de oportunidades <span aria-hidden="true">↗</span></Link>
    </div>;
  }
  const now = new Date();
  return <HomeRadarList opportunities={homeOpportunitySnapshot(catalogue, now)} capturedAt={now.toISOString()} />;
}
