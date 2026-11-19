import { localStaticOfferPreview } from "@/lib/offer-preview";
import { OfferRadarDemo } from "@/components/community/offer-preview";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { listPublicOpportunities } from "@/lib/opportunities/access";
import { homeOpportunitySnapshot } from "@/lib/home-opportunities";
import { EarthRadarList } from "./earth-radar/earth-radar-list";
import { HomeRadarList } from "./home-radar-list";
import { HomeRadarCarousel } from "./home-radar-carousel";
import { LiveCatalogueRefresh } from "@/components/opportunities/live-refresh";
import styles from "./editorial-home.module.css";

export async function HomeRadar({ presentation = "editorial", classNames }: { presentation?: "editorial" | "earth" | "carousel"; classNames?: Record<string, string> }) {
  if (presentation === "carousel" && process.env.NODE_ENV === "development" && process.env.APOGEE_HOME_PREVIEW === "1") {
    const { homePreviewOpportunities, homePreviewCapturedAt } = await import("./home-radar-preview");
    return <><HomeRadarCarousel opportunities={homePreviewOpportunities} capturedAt={homePreviewCapturedAt} />
      <p className={classNames?.radarNote}>Prévia local de design. Amostra da home pública de 17/11/2026.</p></>;
  }
  if (localStaticOfferPreview()) return <OfferRadarDemo compact />;
  const catalogue = await listPublicOpportunities().catch(() => null);
  if (catalogue === null) {
    return <><LiveCatalogueRefresh /><div className={classNames?.catalogueMessage ?? styles.catalogueMessage}>
      <p>A prévia do Radar está temporariamente indisponível</p>
      <Link prefetch={false} href="/oportunidades">Abrir o catálogo de oportunidades <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link>
    </div></>;
  }
  const now = new Date();
  const opportunities = homeOpportunitySnapshot(catalogue, now);
  const capturedAt = now.toISOString();
  return <><LiveCatalogueRefresh />{presentation === "carousel"
    ? <HomeRadarCarousel opportunities={opportunities} capturedAt={capturedAt} />
    : presentation === "earth"
    ? <EarthRadarList opportunities={opportunities} capturedAt={capturedAt} classNames={classNames} />
    : <HomeRadarList opportunities={opportunities} capturedAt={capturedAt} />}</>;
}
