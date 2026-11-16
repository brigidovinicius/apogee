import Link from "next/link";
import { BookOpen, Compass, Gift, Wrench, LockKeyhole } from "lucide-react";
import styles from "./community-offer.module.css";

export function MemberOfferOverview({ name, radarFullAccess, preview = false, annual = false }: { annual?: boolean; name: string; radarFullAccess: boolean | null; preview?: boolean }) {
  const pillars = [
    { name: "Radar", icon: Compass, text: "Encontre eventos, programas e oportunidades para agir.", href: preview ? "/oportunidades" : "/membros/oportunidades", action: "Abrir o Radar" },
    { name: "Caixa de ferramentas", icon: Wrench, text: "Recursos de IA organizados por tarefa.", href: preview ? "/previa/validacao" : "/membros/ferramentas", action: "Abrir ferramentas" },
    { name: "Benefícios", icon: Gift, text: "Ofertas e condições dos parceiros.", href: preview ? "/comunidade#perks" : "/membros/beneficios", action: "Ver benefícios" },
    { name: "Trilha", icon: BookOpen, text: "Atividades práticas e seu progresso.", href: preview ? "/comunidade#learn" : "/membros/trilha", action: "Continuar na trilha" },
  ];
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 id="member-offer-title">Olá, {name}</h2>
    <div className={styles.pillarGrid}>{pillars.map(item => <article className={styles.pillar} key={item.name}><item.icon size={24} strokeWidth={1.5} aria-hidden="true" /><h3>{item.name}</h3>{item.name !== "Radar" && !annual ? <p><LockKeyhole size={14} aria-hidden="true" /> Exclusivo da assinatura</p> : null}<p>{item.text}</p><Link prefetch={false} href={item.href}>{item.action}</Link></article>)}</div>
    <p className={styles.access}>{annual ? "Assinatura anual ativa." : radarFullAccess ? "Radar completo ativo." : radarFullAccess === false ? "Conta gratuita: até 10 eventos distintos no Radar." : ""} <Link href="/membros/assinatura">Ver meu acesso</Link></p>
  </section>;
}
