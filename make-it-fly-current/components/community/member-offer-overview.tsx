import Link from "next/link";
import { BookOpen, Compass, Gift, Wrench } from "lucide-react";
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
    { name: "Radar", icon: Compass, text: "Pesquise oportunidades e confira requisitos e prazos.", href: preview ? "/oportunidades" : "/membros/oportunidades", action: "Abrir o Radar" },
    { name: "Benefícios", icon: Gift, text: "Consulte as condições das ofertas vigentes de parceiros.", href: preview ? "/beneficios" : "/membros/beneficios", action: "Ver benefícios" },
    ...(resources?.trilha ? [{ name: "Trilha inicial", icon: BookOpen, text: "Pratique com três atividades de IA e acompanhe seu progresso.", href: "/membros/trilha", action: "Abrir a trilha" }] : []),
    ...(resources?.ferramentas ? [{ name: "Caixa de Ferramentas", icon: Wrench, text: "Escolha uma ferramenta por categoria e abra o site oficial.", href: "/membros/ferramentas", action: "Abrir ferramentas" }] : []),
  ];
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 id="member-offer-title">Olá, {name}</h2>
    <div className={styles.nextStep}>
      <div><h3>Seu próximo passo</h3><p>{step.description}</p></div>
      <Link className={styles.button} prefetch={false} href={step.href}>{step.label}</Link>
    </div>
    <div className={styles.pillarGrid}>
      {pillars.map(item => <article className={styles.pillar} key={item.name}>
          <item.icon size={24} strokeWidth={1.5} aria-hidden="true" />
          <h3>{item.name}</h3>
          <p>{item.text}</p>
          <Link prefetch={false} href={item.href}>{item.action}</Link>
        </article>)}
    </div>
    <p className={styles.access}>{annual ? "Assinatura anual ativa." : radarFullAccess ? "Radar completo ativo." : radarFullAccess === false ? "Conta gratuita: 10 consultas mensais no Radar e 10 em Benefícios." : ""} <Link href="/membros/assinatura">Ver meu acesso</Link></p>
  </section>;
}
