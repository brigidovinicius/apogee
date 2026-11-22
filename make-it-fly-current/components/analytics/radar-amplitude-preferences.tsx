"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { browserRefusesBehavior } from "./behavior-client";
import {
  isRadarAmplitudeGrant, radarAmplitudeConsentVersion, radarAmplitudePrivacyAnchor,
  type RadarAmplitudeBrowserEvent, type RadarAmplitudeView,
} from "@/lib/radar-amplitude-contract";
import styles from "./radar-amplitude.module.css";

function postRadarAmplitude(body:
  { choice: "allow"; version: number } | { choice: "deny" } | { event: RadarAmplitudeBrowserEvent; grant: string },
) {
  return fetch("/api/radar/amplitude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    referrerPolicy: "origin",
    cache: "no-store",
    redirect: "error",
    keepalive: "event" in body,
    body: JSON.stringify(body),
  });
}

export function RadarAmplitudePreferences({ view, initialGrant }: { view: RadarAmplitudeView; initialGrant: string | null }) {
  const [grant, setGrant] = useState(initialGrant);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const viewed = useRef(false);

  useEffect(() => {
    if (!grant || busy || browserRefusesBehavior()) return;
    const track = (event: RadarAmplitudeBrowserEvent) => {
      if (!browserRefusesBehavior()) void postRadarAmplitude({ event, grant }).catch(() => undefined);
    };
    const trackView = () => {
      if (viewed.current || document.visibilityState !== "visible") return;
      viewed.current = true;
      track(view);
    };
    const trackOfficialLink = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.type === "auxclick" && event.button !== 1)) return;
      if (event.target instanceof Element && event.target.closest('a[data-behavior-action="official_link"]')) {
        track("radar_official_link_clicked");
      }
    };
    trackView();
    document.addEventListener("visibilitychange", trackView);
    document.addEventListener("click", trackOfficialLink);
    document.addEventListener("auxclick", trackOfficialLink);
    return () => {
      document.removeEventListener("visibilitychange", trackView);
      document.removeEventListener("click", trackOfficialLink);
      document.removeEventListener("auxclick", trackOfficialLink);
    };
  }, [busy, grant, view]);

  async function choose(choice: "allow" | "deny") {
    if (choice === "allow" && browserRefusesBehavior()) {
      setMessage("O navegador está configurado para recusar a medição.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await postRadarAmplitude(choice === "allow"
        ? { choice, version: radarAmplitudeConsentVersion }
        : { choice });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (choice === "allow" && !isRadarAmplitudeGrant(result.grant)) throw new Error();
      setGrant(choice === "allow" ? result.grant : null);
      setMessage(choice === "allow" ? "Medição do Radar permitida." : "Medição do Radar desativada.");
    } catch {
      setMessage("Não foi possível salvar sua escolha. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={styles.preferences}>
      <summary>Preferências de medição do Radar</summary>
      <p>Se você permitir, a Apogee envia ao Amplitude as visualizações da lista e dos detalhes, os salvamentos confirmados e os cliques em links oficiais. Usamos um código que representa sua conta para entender como as pessoas usam o Radar. Os eventos ficam no projeto europeu do Amplitude por três meses.</p>
      <p>Você pode recusar e continuar usando o Radar. Para revogar a permissão, volte a estas preferências a qualquer momento.</p>
      <p><Link href={`/privacidade#${radarAmplitudePrivacyAnchor}`} className={styles.policyLink}>Saiba mais na Política de Privacidade</Link></p>
      <div className={styles.actions}>
        {grant
          ? <button type="button" data-ap-button="secondary" disabled={busy} onClick={() => void choose("deny")}>Revogar permissão</button>
          : <>
            <button type="button" data-ap-button="secondary" disabled={busy} onClick={() => void choose("allow")}>Permitir medição do Radar</button>
            <button type="button" data-ap-button="secondary" disabled={busy} onClick={() => void choose("deny")}>Recusar medição do Radar</button>
          </>}
      </div>
      <span role="status">{message}</span>
    </details>
  );
}
