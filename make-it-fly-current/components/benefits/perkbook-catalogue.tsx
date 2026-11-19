"use client";

import { useEffect, useRef } from "react";
import styles from "./benefits.module.css";

const portalOrigin = "https://apogee.perkbook.co";

export function PerkBookCatalogue() {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function openOffer(event: MessageEvent) {
      if (event.origin !== portalOrigin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== "perkbook-embed-navigate" || typeof event.data.url !== "string") return;

      let destination: URL;
      try {
        destination = new URL(event.data.url);
      } catch {
        return;
      }
      if (destination.origin === portalOrigin && !destination.username && !destination.password) {
        window.location.assign(destination.href);
      }
    }

    window.addEventListener("message", openOffer);
    return () => window.removeEventListener("message", openOffer);
  }, []);

  return (
    <section aria-labelledby="perkbook-title" className={styles.card}>
      <h2 id="perkbook-title" tabIndex={-1}>Catálogo parceiro · PerkBook</h2>
      <p className={styles.description}>
        Pesquise descontos, créditos e licenças diretamente no PerkBook.
        Consulte os requisitos na página de cada oferta.
      </p>
      <a className={styles.textLink} href={portalOrigin} target="_blank" rel="noopener noreferrer">
        Abrir catálogo em uma nova aba
      </a>
      <iframe
        ref={frame}
        title="Pesquisar descontos de software no PerkBook"
        src={portalOrigin + "/embed"}
        loading="lazy"
        referrerPolicy="origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ display: "block", width: "100%", height: "clamp(30rem, 75vh, 56rem)", border: 0 }}
      />
    </section>
  );
}
