import Link from "next/link";
import { BookOpen, Compass, Gift, Wrench, LockKeyhole } from "lucide-react";
import styles from "./community-offer.module.css";

export function MemberOfferOverview({ name, radarFullAccess, preview = false, annual = false, contentAccess = annual, nextStep }: {
  annual?: boolean;
  contentAccess?: boolean;
  name: string;
  radarFullAccess: boolean | null;
  preview?: boolean;
  nextStep?: { label: string; description: string; href: string };
}) {
  const step = nextStep ?? (contentAccess ? {
    label: "Escolher uma ferramenta",
    description: "Escolha uma tarefa e encontre um recurso para realizá-la.",
    href: "/membros/ferramentas",
  } : {
    label: "Explorar o Radar",
    description: "Encontre uma oportunidade e confira quando e como participar.",
    href: preview ? "/oportunidades" : "/membros/oportunidades",
  });
  const pillars = [
    { name: "Caixa de Ferramentas", icon: Wrench, text: "Escolha uma ferramenta por categoria e abra o site oficial.", href: preview ? "/comunidade#ferramentas" : "/membros/ferramentas", action: "Abrir ferramentas", previewAction: "Ver prévia das ferramentas" },
    { name: "Trilha", icon: BookOpen, text: "Pratique com três atividades de IA e acompanhe seu progresso.", href: preview ? "/comunidade#learn" : "/membros/trilha", action: "Abrir a trilha", previewAction: "Ver prévia da trilha" },
    { name: "Radar", icon: Compass, text: "Pesquise oportunidades e confira requisitos e prazos.", href: preview ? "/oportunidades" : "/membros/oportunidades", action: "Abrir o Radar" },
    { name: "Benefícios", icon: Gift, text: "Consulte as condições das ofertas vigentes de parceiros.", href: preview ? "/comunidade#perks" : "/membros/beneficios", action: "Ver benefícios", previewAction: "Ver prévia dos benefícios" },
  ];
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 id="member-offer-title">Olá, {name}</h2>
    <div className={styles.nextStep}>
      <div><h3>Seu próximo passo</h3><p>{step.description}</p></div>
      <Link className={styles.button} prefetch={false} href={step.href}>{step.label}</Link>
    </div>
    <div className={styles.pillarGrid}>
      {pillars.map(item => {
        const previewAction = !contentAccess && item.previewAction;
        return <article className={styles.pillar} key={item.name}>
          <item.icon size={24} strokeWidth={1.5} aria-hidden="true" />
          <h3>{item.name}</h3>
          {previewAction && <p><LockKeyhole size={14} aria-hidden="true" /> Assinatura anual</p>}
          <p>{item.text}</p>
          <Link prefetch={false} href={item.href}>{previewAction || item.action}</Link>
        </article>;
      })}
    </div>
    <p className={styles.access}>{annual ? "Assinatura anual ativa." : radarFullAccess ? "Radar completo ativo." : radarFullAccess === false ? "Conta gratuita: até 10 eventos distintos no Radar." : ""} <Link href="/membros/assinatura">Ver meu acesso</Link></p>
  </section>;
}
