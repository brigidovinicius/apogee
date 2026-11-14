import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Compass, Gift, Users } from "lucide-react";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { COMMUNITY_BENEFITS, COMMUNITY_FAQ } from "@/content/community";
import { COMMUNITY_PILLARS, RADAR_FREE_NOTE } from "@/content/community-offer";
import { CommunityJoinButton, FunnelFaq, FunnelFooter, FunnelHeader } from "./community-funnel";
import { CommunityPlans } from "./community-plans";
import offer from "./community-offer.module.css";
import styles from "./community-sales-page.module.css";

const icons = { radar: Compass, learn: BookOpen, perks: Gift, community: Users };

export function CommunitySalesPage({ preview = false, next }: { preview?: boolean; next?: string }) {
  return <div className={styles.page} data-community-page>
    <FunnelHeader page="community" />
    <main id="experiencia" tabIndex={-1}>
      <section id="inicio" className={styles.communityHero} aria-labelledby="community-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Comunidade Apogee</p>
          <h1 id="community-title">Acesso para<br />construir mais.</h1>
          <p className={styles.heroLead}>Conhecimento, ferramentas, oportunidades e gente para colocar ideias em prática. Comece gratuitamente e conheça a assinatura que conecta esses caminhos.</p>
          <div className={offer.darkActions}><Link className={styles.primary} href="#planos">Conhecer a assinatura <ArrowUpRight size={18} aria-hidden="true" /></Link><CommunityJoinButton next={next} preview={preview} secondary /></div>
          <p className={styles.actionHint}>Até 10 eventos distintos no Radar, sem cartão.</p>
        </div>
        <div className={styles.starScene} aria-hidden="true"><Image className={styles.heroStar} src="/brand/apogee-star.svg" alt="" width={703} height={870} preload /><span className={styles.orbitLine} /></div>
        <div className={styles.heroTopics}><span>Radar</span><span>Learn</span><span>Perks</span><span>Community</span></div>
      </section>
      <RedBullSupport />
      <section id="comunidade" className={styles.section} aria-labelledby="inside-title">
        <div className={styles.sectionHeading}><h2 id="inside-title">Quatro caminhos.<br />Uma comunidade.</h2><p>Descubra o que existe, aprenda a usar e coloque em prática com outras pessoas.</p></div>
        <div className={styles.deliverables}>{COMMUNITY_PILLARS.map(item => { const Icon = icons[item.kind]; return <article key={item.kind} className={`${styles.deliverable} ${styles[item.kind] ?? ""}`}><div className={styles.cardTop}><Icon size={24} strokeWidth={1.4} aria-hidden="true" /><span className={styles.status}>{item.status}</span></div><p className={styles.cardLabel}>{item.name}</p><h3>{item.title}</h3><p>{item.description}</p><Link className={styles.textLink} href={item.href} prefetch={false}>{item.action}<ArrowUpRight size={18} aria-hidden="true" /></Link></article>; })}</div>
      </section>
      <section id="radar" className={`${styles.section} ${styles.radarSection}`} aria-labelledby="radar-title">
        <div className={styles.radarCopy}><p className={styles.eyebrow}>Apogee Radar</p><h2 id="radar-title">Uma descoberta pode<br />mudar seu caminho.</h2><p>{RADAR_FREE_NOTE}</p><Link className={styles.primary} href="/oportunidades" prefetch={false}>Explorar o Radar <ArrowUpRight size={18} aria-hidden="true" /></Link><p className={styles.actionHint}>Já tem acesso ao Radar? Seus direitos são preservados.</p></div>
        <div className={styles.radarVisual} aria-hidden="true"><div className={styles.radarRings}><Compass size={46} strokeWidth={1} /></div><span className={styles.radarTag}>Formação</span><span className={styles.radarTag}>Bolsas</span><span className={styles.radarTag}>Carreira</span><span className={styles.radarTag}>Eventos</span><p>Radar<span>Apogee</span></p></div>
      </section>
      <section id="learn" className={`${styles.section} ${styles.courseSection}`} aria-labelledby="learn-title">
        <div className={styles.courseType} aria-hidden="true">Aprender.<br />Testar.<br />Aplicar.</div>
        <div className={styles.courseCopy}><p className={styles.eyebrow}>Apogee Learn</p><h2 id="learn-title">Conhecimento que<br />vira uma entrega.</h2><p>Trilhas curtas para pesquisar e escrever, organizar a rotina e construir um primeiro projeto com IA. A proposta é terminar com algo que você consegue usar.</p><p className={styles.courseNote}>O programa e a disponibilidade das trilhas incluídas serão apresentados antes da contratação.</p><Link className={styles.secondary} href="#planos">Conhecer o plano da comunidade</Link></div>
      </section>
      <section id="perks" className={styles.section} aria-labelledby="benefits-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>Apogee Perks</p><h2 id="benefits-title">Ferramentas e experiências<br />para ir mais longe.</h2><p>Conheça as possibilidades de benefícios da comunidade. Cada oferta depende de disponibilidade, acordos e elegibilidade, com regras próprias.</p></div>
        <div className={styles.benefits}>{COMMUNITY_BENEFITS.map(item => <article key={item.title}><span className={styles.pending}>Conforme disponibilidade</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
      </section>
      <section id="planos" className={styles.section} aria-labelledby="plans-title"><div className={styles.sectionHeading}><h2 id="plans-title">Comece com uma descoberta.<br />Continue com a comunidade.</h2><p>Escolha seu próximo passo. A entrada gratuita continua disponível; a assinatura reúne as entregas dos quatro pilares.</p></div><CommunityPlans preview={preview} next={next} /></section>
      <section id="participar" className={`${styles.section} ${styles.joinSection}`} aria-labelledby="join-title"><p className={styles.eyebrow}>Apogee Community</p><h2 id="join-title">Seu próximo projeto<br />pode começar com uma conversa.</h2><p>Conheça pessoas, compartilhe descobertas e acompanhe as atividades confirmadas da Apogee. Cada experiência tem suas condições de participação.</p><CommunityJoinButton next={next} preview={preview} /><Link className={styles.subtleLink} href="/evento-openai" prefetch={false}>Conhecer o evento gratuito <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <FunnelFaq id="duvidas" title="Antes de começar." items={COMMUNITY_FAQ} />
    </main><FunnelFooter />
  </div>;
}
