import Link from "next/link";
import type { PublishedResources } from "./community-deliverables";
import { EVENTS_PATH } from "@/lib/eventos/catalogo";
import styles from "./community-offer.module.css";

export function CommunityResourceCards({ resources, destination }: {
  resources?: PublishedResources;
  destination: "home" | "members" | "preview";
}) {
  const cards = [
    {
      artwork: "radar",
      name: "Radar",
      text: "Oportunidades, requisitos e prazos.",
      href: { home: "/oportunidades", members: "/membros/oportunidades", preview: "/oportunidades" },
      action: destination === "home" ? "Explorar o Radar" : "Abrir o Radar",
    },
    {
      artwork: "perks",
      name: "Benefícios",
      text: "Ofertas vigentes e condições dos parceiros.",
      href: { home: "/beneficios", members: "/membros/beneficios", preview: "/beneficios" },
      action: "Ver benefícios",
    },
    ...(resources?.ferramentas ? [{
      artwork: "ferramentas",
      name: "Caixa de Ferramentas",
      text: "Ferramentas por categoria, com links oficiais.",
      href: { home: "/comunidade#ferramentas", members: "/membros/ferramentas", preview: "/membros/ferramentas" },
      action: destination === "home" ? "Conhecer ferramentas" : "Abrir ferramentas",
    }] : []),
    ...(destination !== "home" ? [{
      artwork: "eventos",
      name: "Eventos",
      text: "Próximos encontros, fotos e vídeos.",
      href: { home: EVENTS_PATH, members: EVENTS_PATH, preview: EVENTS_PATH },
      action: "Abrir eventos",
    }] : []),
  ];

  return <ul className={styles.pillarGrid}>
    {cards.map(card => (
      <li data-ap-card="resource" data-ap-icon={card.artwork} className={styles.pillar} key={card.artwork}>
        <h3>{card.name}</h3>
        <p>{card.text}</p>
        <Link prefetch={false} href={card.href[destination]}>{card.action}</Link>
      </li>
    ))}
  </ul>;
}
