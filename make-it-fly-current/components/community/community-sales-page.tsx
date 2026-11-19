import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EditorialPageShell } from "@/components/site/editorial-page-shell";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { COMMUNITY_FAQ } from "@/content/community";
import { COMMUNITY_BENEFITS_TERMS, RADAR_FREE_NOTE } from "@/content/community-offer";
import { CommunityJoinButton } from "./community-funnel";
import { CommunityPlans } from "./community-plans";
import { CommunityDirectory } from "./community-directory";
import styles from "./community-editorial.module.css";

import type { PublishedResources } from "./community-deliverables";

export function CommunitySalesPage({ preview = false, signedIn = false, subscribed = false, next, hasBenefits, resources }: { preview?: boolean; signedIn?: boolean; subscribed?: boolean; next?: string; hasBenefits?: boolean | null; resources: PublishedResources }) {
  return <EditorialPageShell current="community" className={styles.page}>
    <main id="experiencia" tabIndex={-1} data-community-page>
      <section id="inicio" className={[styles.wrap, styles.section, styles.intro].join(" ")} aria-labelledby="community-title">
        <p className={styles.eyebrow}>Comunidade Apogee</p>
        <div className={styles.headingRow}>
          <h1 id="community-title">Coloque a IA em prática com a comunidade.</h1>
          <p className={styles.lead}>{resources.trilha && resources.ferramentas ? "Traga uma tarefa do seu dia a dia. Encontre uma ferramenta para ela, experimente a atividade da trilha e converse com outros membros sobre o que funcionou." : "Explore oportunidades, consulte benefícios e converse com outros membros sobre seus projetos."}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.navyButton} href="#planos">Comparar os acessos <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <div className={styles.joinAction}><CommunityJoinButton next={next} preview={preview} signedIn={signedIn} secondary /></div>
        </div>
        <p className={styles.accessNote}>{resources.trilha && resources.ferramentas ? "Conta gratuita sem cartão. Caixa de Ferramentas, Trilha e Radar completo na assinatura anual." : "Conta gratuita sem cartão. A assinatura anual inclui o Radar completo."}</p>
        <div className={styles.communityWord} aria-hidden="true">Building<br />the future.</div>
      </section>
      <section id="comunidade" className={[styles.section, styles.communityBand].join(" ")} aria-labelledby="inside-title">
        <div className={styles.wrap}>
          <div className={[styles.headingRow, styles.directoryHeading].join(" ")}>
            <h2 id="inside-title">O que você pode fazer na Apogee</h2>
            <p className={styles.lead}>Veja como cada recurso funciona e em qual acesso ele está incluído.</p>
          </div>
          <CommunityDirectory resources={resources} />
        </div>
      </section>
      <section id="planos" tabIndex={-1} className={[styles.wrap, styles.section, styles.plansTarget].join(" ")} aria-labelledby="plans-title">
        <div className={[styles.headingRow, styles.plansHeading].join(" ")}><h2 id="plans-title">Escolha seu acesso</h2></div>
        <div className={styles.plansFrame}><CommunityPlans resources={resources} preview={preview} signedIn={signedIn} subscribed={subscribed} next={next} /></div>
      </section>
      <RedBullSupport />
      <section id="radar" className={[styles.wrap, styles.section, styles.headingRow].join(" ")} aria-labelledby="radar-title"><div><p className={styles.eyebrow}>Apogee Radar</p><h2 id="radar-title">Encontre oportunidades e acompanhe os prazos.</h2><p className={styles.sectionCopy}>{RADAR_FREE_NOTE}</p><div className={styles.actions}><Link className={styles.navyButton} href="/oportunidades" prefetch={false}>Explorar o Radar <ArrowUpRight size={18} aria-hidden="true" /></Link></div><p className={styles.accessNote}>Os acessos anteriores ao Radar continuam válidos.</p></div><div className={styles.radarFact}><strong>10</strong><p>consultas gratuitas por mês</p><span>Explore o catálogo sem usar a sua cota.</span></div></section>
      {resources.ferramentas && <section id="ferramentas" className={[styles.section, styles.toolboxSection].join(" ")} aria-labelledby="toolbox-title"><div className={[styles.wrap, styles.headingRow].join(" ")}><div><p className={styles.eyebrow}>Caixa de Ferramentas · assinatura anual</p><h2 id="toolbox-title">Encontre uma ferramenta para a sua tarefa.</h2></div><div className={styles.courseCopy}><p className={styles.lead}>Escolha o que você quer fazer, leia para que serve cada ferramenta e abra o site oficial.</p><p>Há categorias para tarefas como criar um vídeo, editar uma imagem, pesquisar um assunto ou programar.</p><p className={styles.toolboxExample}>Para criar um vídeo, por exemplo, procure <strong>Google Flow</strong> na categoria Vídeo.</p><p className={styles.accessNote}>A assinatura cobre a curadoria da Apogee. Cada fornecedor define o preço, os créditos e as condições da sua ferramenta.</p><Link className={styles.textLink} href="#plano-anual">Ver plano anual <ArrowUpRight size={18} aria-hidden="true" /></Link></div></div></section>}
      {resources.trilha && <section id="learn" className={[styles.wrap, styles.section, styles.headingRow].join(" ")} aria-labelledby="learn-title"><div><p className={styles.eyebrow}>Apogee Learn · Trilha</p><h2 id="learn-title">Faça sua primeira tarefa com IA.</h2></div><div className={styles.courseCopy}><p className={styles.lead}>Comece por “Um primeiro resultado com IA”: um exercício com três atividades para escolher uma tarefa pequena, preparar um pedido com dados permitidos e conferir o resultado.</p><p>O entregável inicial é um roteiro com a tarefa escolhida, os critérios de qualidade e sua avaliação do resultado. A Trilha está disponível de forma parcial: a formação ainda não está completa e os próximos módulos estão em preparação, sem data de entrega anunciada.</p><Link className={styles.textLink} href="#plano-anual">Ver plano anual <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>}
      <section id="perks" className={[styles.section, styles.benefitsSection].join(" ")} aria-labelledby="benefits-title"><div className={styles.wrap}><div className={styles.headingRow}><div><p className={styles.eyebrow}>Apogee Perks · Benefícios</p><h2 id="benefits-title">Consulte as ofertas dos parceiros.</h2></div><p className={styles.lead}>{COMMUNITY_BENEFITS_TERMS}</p></div>{hasBenefits !== null && hasBenefits !== undefined && <p className={styles.accessNote}>{hasBenefits ? "Há ofertas vigentes no catálogo." : "O catálogo está sem ofertas vigentes no momento."}</p>}<Link className={styles.textLink} href="/beneficios" prefetch={false}>Abrir catálogo de Benefícios <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      <section id="participar" className={[styles.section, styles.communityBand].join(" ")} aria-labelledby="join-title">
        <div className={[styles.wrap, styles.headingRow].join(" ")}>
          <div><p className={styles.eyebrow}>Comunidade Apogee</p><h2 id="join-title">Eventos presenciais</h2></div>
          <div className={styles.courseCopy}>
            <p className={styles.lead}>Encontre a comunidade pessoalmente. Cada encontro tem suas próprias condições de participação.</p>
            <p><Link className={styles.textLink} href="/evento-openai#workshop-florianopolis" prefetch={false}>Ver workshop em Florianópolis <ArrowUpRight size={18} aria-hidden="true" /></Link></p>
            <p><Link className={styles.textLink} href="/galeria" prefetch={false}>Ver fotos do Make It Fly <ArrowUpRight size={18} aria-hidden="true" /></Link></p>
            <p className={styles.accessNote}>A inscrição no evento Codex Community é independente da assinatura e do cadastro na comunidade.</p>
            <div className={styles.joinAction}><CommunityJoinButton next={next} preview={preview} signedIn={signedIn} /></div>
          </div>
        </div>
      </section>
      <section id="duvidas" className={[styles.section, styles.faqSection].join(" ")} aria-labelledby="faq-title"><div className={[styles.wrap, styles.faqLayout].join(" ")}><h2 id="faq-title">Antes de<br />começar.</h2><div className={styles.faq}>{COMMUNITY_FAQ.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </EditorialPageShell>;
}
