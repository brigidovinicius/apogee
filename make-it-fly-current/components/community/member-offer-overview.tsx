import Link from "next/link";
import styles from "./community-offer.module.css";

export function MemberOfferOverview({ name, radarFullAccess, preview = false, annual = false, resources, nextStep }: {
  annual?: boolean;
  resources?: { ferramentas: boolean; trilha: boolean };
  name: string;
  radarFullAccess: boolean | null;
  preview?: boolean;
  nextStep?: { label: string; description: string; href: string };
}) {
  const step = nextStep ?? (resources?.ferramentas ? {
    label: "Escolher uma ferramenta",
    description: "Escolha uma tarefa e encontre um recurso para realizá-la.",
    href: "/membros/ferramentas",
  } : {
    label: "Explorar o Radar",
    description: "Encontre uma oportunidade e confira quando e como participar.",
    href: preview ? "/oportunidades" : "/membros/oportunidades",
  });
  const pillars = [
    { name: "Radar", artwork: "radar", text: "Pesquise oportunidades e confira requisitos e prazos.", href: preview ? "/oportunidades" : "/membros/oportunidades", action: "Abrir o Radar" },
    { name: "Benefícios", artwork: "perks", text: "Consulte as condições das ofertas vigentes de parceiros.", href: preview ? "/beneficios" : "/membros/beneficios", action: "Ver benefícios" },
    ...(resources?.trilha ? [{ name: "Trilha inicial", artwork: "learn", text: "Pratique com três atividades de IA e acompanhe seu progresso.", href: "/membros/trilha", action: "Abrir a trilha" }] : []),
    ...(resources?.ferramentas ? [{ name: "Caixa de Ferramentas", artwork: "ferramentas", text: "Escolha uma ferramenta por categoria e abra o site oficial.", href: "/membros/ferramentas", action: "Abrir ferramentas" }] : []),
  ];
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 data-ap-title="" id="member-offer-title">Olá, {name}</h2>
    <div data-ap-panel="" className={styles.nextStep}>
      <div><h3>Seu próximo passo</h3><p>{step.description}</p></div>
      <Link data-ap-button="primary" className={styles.button} prefetch={false} href={step.href}>{step.label}</Link>
    </div>
    <ul className={styles.pillarGrid}>
      {pillars.map(item => (
        <li data-ap-card="resource" data-ap-icon={item.artwork} className={styles.pillar} key={item.artwork}>
          <h3>{item.name}</h3>
          <p>{item.text}</p>
          <Link prefetch={false} href={item.href}>{item.action}</Link>
        </li>
      ))}
    </ul>
    <p className={styles.access}>{annual ? "Assinatura anual ativa." : radarFullAccess ? "Radar completo ativo." : radarFullAccess === false ? "Conta gratuita: 10 consultas mensais no Radar e 10 em Benefícios." : ""} <Link href="/membros/assinatura">Ver meu acesso</Link></p>
  </section>;
}
