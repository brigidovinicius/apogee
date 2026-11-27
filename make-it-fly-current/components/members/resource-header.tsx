import Link from "next/link";
import styles from "./resource-header.module.css";

const resources = {
  beneficios: { title: "Benefícios", href: "/membros/beneficios", summary: "Ofertas, condições e resgates." },
  ferramentas: { title: "Caixa de ferramentas", href: "/membros/ferramentas", summary: "Projetos para usar com sua IA, skills e aplicativos." },
};

export function ResourceHeader({ area, showRelated = true }: { area: keyof typeof resources; showRelated?: boolean }) {
  const current = resources[area];
  const other = resources[area === "beneficios" ? "ferramentas" : "beneficios"];
  return <header data-ap-toolbox-studio={area === "ferramentas" ? "catalogue" : undefined} className={styles.head}>
    <div><h1>{current.title}</h1><p>{current.summary}</p></div>
    {showRelated && <Link href={other.href} className={styles.switchArea}>{other.title}</Link>}
  </header>;
}
