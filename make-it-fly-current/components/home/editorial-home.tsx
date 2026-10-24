import { Suspense } from "react";
import { EarthRadarPreview } from "./earth-radar/earth-radar-preview";
import { HomeRadar } from "./home-radar";

export function EditorialHome() {
  return <EarthRadarPreview radar={
    <Suspense fallback={<p role="status">Consultando as oportunidades do Radar…</p>}>
      <HomeRadar presentation="earth" />
    </Suspense>
  } />;
}
