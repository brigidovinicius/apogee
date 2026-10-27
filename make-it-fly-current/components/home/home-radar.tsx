import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { listPublicOpportunities } from "@/lib/opportunities/access";
import { homeOpportunitySnapshot } from "@/lib/home-opportunities";
import { EarthRadarList } from "./earth-radar/earth-radar-list";
import { HomeRadarList } from "./home-radar-list";
import styles from "./editorial-home.module.css";

export async function HomeRadar({ presentation = "editorial" }: { presentation?: "editorial" | "earth" }) {
  const catalogue = await listPublicOpportunities().catch(() => null);
  if (catalogue === null) {
    return <div className={styles.catalogueMessage}>
      <p>A prévia do Radar está temporariamente indisponível</p>
      <Link prefetch={false} href="/oportunidades">Abrir o catálogo de oportunidades <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link>
    </div>;
  }
  const now = new Date();
  const List = presentation === "earth" ? EarthRadarList : HomeRadarList;
  return <List opportunities={homeOpportunitySnapshot(catalogue, now)} capturedAt={now.toISOString()} />;
}
