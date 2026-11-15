import Link from "next/link";
import { BookOpen, Compass, Gift, Users } from "lucide-react";
import styles from "./community-offer.module.css";

export function MemberOfferOverview({ name, radarFullAccess, preview = false, annual = false }: { annual?: boolean; name: string; radarFullAccess: boolean | null; preview?: boolean }) {
  const pillars = [
    { name: "Radar", icon: Compass, text: "Encontre eventos, programas e oportunidades para agir.", href: preview ? "/oportunidades" : "/membros/oportunidades", action: "Abrir o Radar" },
    { name: "Learn", icon: BookOpen, text: "Conheça as trilhas de IA aplicada e seus resultados práticos.", href: "/comunidade#learn", action: "Conhecer as trilhas" },
    { name: "Perks", icon: Gift, text: "Entenda os benefícios e as condições de cada oferta.", href: "/comunidade#perks", action: "Conhecer os benefícios" },
    { name: "Community", icon: Users, text: "Continue a conversa e descubra caminhos para construir junto.", href: preview ? "/comunidade#participar" : "#forum", action: preview ? "Conhecer as conexões" : "Ir para o fórum" },
  ];
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 id="member-offer-title">{name}, qual é seu próximo passo?</h2>
    <p>Explore uma oportunidade, conheça uma aplicação de IA ou continue uma conversa. A comunidade conecta os caminhos para você construir mais.</p>
    <div className={styles.pillarGrid}>{pillars.map(item => <article className={styles.pillar} key={item.name}><item.icon size={24} strokeWidth={1.5} aria-hidden="true" /><h3>{item.name}</h3><p>{item.text}</p><Link prefetch={false} href={item.href}>{item.action}</Link></article>)}</div>
    <p className={styles.access}>{radarFullAccess === null ? "Confira seu acesso no Radar para conhecer as condições da sua conta." : annual ? "Sua assinatura anual inclui o Radar completo durante o período pago." : radarFullAccess ? "Seu acesso anterior ao Radar está preservado. A assinatura dos demais pilares é uma escolha adicional." : "A entrada gratuita permite consultar até 10 eventos distintos. Conheça a assinatura para acessar o Radar completo e as entregas incluídas no plano."} <Link href="/comunidade#planos" prefetch={false}>Conhecer os planos da comunidade</Link> <Link href="/membros/assinatura">Assinatura e pagamentos</Link></p>
  </section>;
}
