import Link from "next/link";
import type { PublishedResources } from "./community-deliverables";
import styles from "./community-offer.module.css";

export function CommunityResourceCards({ resources, destination }: {
  resources?: PublishedResources;
  destination: "home" | "members" | "preview";
}) {
  const cards = [
    {
      artwork: "radar",
      name: "Radar",
      text: "Pesquise oportunidades e confira requisitos e prazos.",
      href: { home: "/comunidade#radar", members: "/membros/oportunidades", preview: "/oportunidades" },
      action: destination === "home" ? "Conhecer o Radar" : "Abrir o Radar",
    },
    {
      artwork: "perks",
      name: "Benefícios",
      text: "Consulte as condições das ofertas vigentes de parceiros.",
      href: { home: "/comunidade#perks", members: "/membros/beneficios", preview: "/beneficios" },
      action: "Ver benefícios",
    },
    ...(resources?.trilha ? [{
      artwork: "learn",
      name: "Trilha inicial",
      text: "Pratique com três atividades de IA e acompanhe seu progresso.",
      href: { home: "/comunidade#learn", members: "/membros/trilha", preview: "/membros/trilha" },
      action: destination === "home" ? "Conhecer a trilha" : "Abrir a trilha",
    }] : []),
    ...(resources?.ferramentas ? [{
      artwork: "ferramentas",
      name: "Caixa de Ferramentas",
      text: "Escolha uma ferramenta por categoria e abra o site oficial.",
      href: { home: "/comunidade#ferramentas", members: "/membros/ferramentas", preview: "/membros/ferramentas" },
      action: destination === "home" ? "Conhecer ferramentas" : "Abrir ferramentas",
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
