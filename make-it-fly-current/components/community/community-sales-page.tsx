import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Compass, MessageCircle, Newspaper } from "lucide-react";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { COMMUNITY_BENEFITS, COMMUNITY_DELIVERABLES, COMMUNITY_FAQ } from "@/content/community";
import { CommunityJoinButton, FunnelFaq, FunnelFooter, FunnelHeader } from "./community-funnel";
import styles from "./community-sales-page.module.css";

const icons = { group: MessageCircle, radar: Compass, content: BookOpen, blog: Newspaper };

export function CommunitySalesPage() {
  return (
    <div className={styles.page} data-community-page>
      <FunnelHeader page="community" />
      <main id="experiencia" tabIndex={-1}>
        <section id="inicio" className={styles.communityHero} aria-labelledby="community-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}><span className={styles.liveDot} /> Comunidade Apogee · acesso gratuito</p>
            <h1 id="community-title">IA para o dia a dia.<br /><span>Gente para ir além.</span></h1>
            <p className={styles.heroLead}>Aprenda, descubra oportunidades e encontre outras pessoas que também querem colocar ideias em prática.</p>
            <CommunityJoinButton />
            <p className={styles.actionHint}>Uma comunidade no WhatsApp para aprender, trocar ideias e descobrir oportunidades.</p>
          </div>
          <div className={styles.starScene} aria-hidden="true"><Image className={styles.heroStar} src="/brand/apogee-star.svg" alt="" width={703} height={870} priority /><span className={styles.orbitLine} /></div>
          <div className={styles.heroTopics}><span>IA na prática</span><span>Radar de oportunidades</span><span>Curadoria Apogee</span></div>
        </section>
        <RedBullSupport />
        <section id="comunidade" className={styles.section} aria-labelledby="inside-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>O que nos reúne</p><h2 id="inside-title">Conhecimento, oportunidades<br />e boas conversas.</h2><p>Um ponto de encontro para quem tem curiosidade e quer dar o próximo passo.</p></div>
          <div className={styles.deliverables}>{COMMUNITY_DELIVERABLES.map(item => {
            const Icon = icons[item.kind];
            return <article key={item.kind} className={[styles.deliverable, styles[item.kind]].join(" ")}>
              <div className={styles.cardTop}><Icon size={24} strokeWidth={1.4} aria-hidden="true" /><span className={styles.status}>{item.status}</span></div>
              <p className={styles.cardLabel}>{item.label}</p><h3>{item.title}</h3><p>{item.description}</p>
              {item.kind === "radar" && <Link className={styles.textLink} href="/oportunidades" prefetch={false}>Explorar o Radar <ArrowUpRight size={18} aria-hidden="true" /></Link>}
              {item.kind === "blog" && <Link className={styles.textLink} href="/blog" prefetch={false}>Conhecer o blog <ArrowUpRight size={18} aria-hidden="true" /></Link>}
            </article>;
          })}</div>
        </section>
        <section id="radar" className={[styles.section, styles.radarSection].join(" ")} aria-labelledby="radar-title">
          <div className={styles.radarCopy}><p className={styles.eyebrow}>Já dá para explorar</p><h2 id="radar-title">Sua próxima oportunidade<br />pode estar no Radar.</h2><p>Cursos, bolsas, intercâmbios, carreira e eventos. Use os filtros, conheça os detalhes e encontre caminhos que conversem com seus interesses.</p><Link className={styles.primary} href="/oportunidades" prefetch={false}>Explorar oportunidades <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          <div className={styles.radarVisual} aria-hidden="true"><div className={styles.radarRings}><Compass size={46} strokeWidth={1} /></div><span className={styles.radarTag}>Formação</span><span className={styles.radarTag}>Bolsas</span><span className={styles.radarTag}>Carreira</span><span className={styles.radarTag}>Eventos</span><p>Radar<span>Apogee</span></p></div>
        </section>
        <section id="beneficios" className={styles.section} aria-labelledby="benefits-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Benefícios e parcerias</p><h2 id="benefits-title">Benefícios para continuar<br />aprendendo.</h2><p>Possibilidades para explorar ferramentas, participar de experiências e aproveitar condições especiais. Consulte a disponibilidade e as regras de cada oferta.</p></div>
          <div className={styles.benefits}>{COMMUNITY_BENEFITS.map(item => <article key={item.title}><span className={styles.pending}>Condições por oferta</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
        </section>
        <section id="cursos" className={[styles.section, styles.courseSection].join(" ")} aria-labelledby="course-title">
          <div className={styles.courseType} aria-hidden="true">Aprender.<br />Testar.<br /><em>Aplicar.</em></div>
          <div className={styles.courseCopy}><p className={styles.eyebrow}>Cursos de inteligência artificial</p><h2 id="course-title">IA para o trabalho.<br />E para a vida também.</h2><p>Aprenda a usar IA em tarefas reais: organizar a rotina, pesquisar, escrever e transformar ideias em projetos. Conhecimento para experimentar e aplicar no seu dia a dia.</p><p className={styles.courseNote}>Os cursos de IA são pagos e têm inscrição própria, separada da comunidade gratuita.</p><CommunityJoinButton label="Conhecer a comunidade gratuita" secondary /></div>
        </section>
        <section id="participar" className={[styles.section, styles.joinSection].join(" ")} aria-labelledby="join-title">
          <p className={styles.eyebrow}>Comunidade gratuita no WhatsApp</p><h2 id="join-title">O próximo passo fica melhor<br /><em>com gente.</em></h2><p>Trocas sobre IA, descobertas e oportunidades. Um lugar para continuar a conversa e aprender junto.</p><CommunityJoinButton />
          <Link className={styles.subtleLink} href="/evento-openai" prefetch={false}>Conhecer o evento gratuito <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </section>
        <FunnelFaq id="duvidas" title="Antes de fazer parte." items={COMMUNITY_FAQ} />
      </main>
      <FunnelFooter />
    </div>
  );
}
