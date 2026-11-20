import Link from "next/link";
import { ApogeeInterface } from "@/components/site/apogee-design-system";
import { EditorialPageShell } from "@/components/site/editorial-page-shell";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { COMMUNITY_FAQ } from "@/content/community";
import { COMMUNITY_BENEFITS_REDEMPTION } from "@/content/community-offer";
import { CommunityJoinButton } from "./community-funnel";
import { CommunityCheckoutButton } from "./community-checkout-button";
import { CommunityPlans } from "./community-plans";
import { CommunityDirectory } from "./community-directory";
import styles from "./community-editorial.module.css";

import type { PublishedResources } from "./community-deliverables";

export function CommunitySalesPage({ preview = false, signedIn = false, subscribed = false, next, hasBenefits, resources }: { preview?: boolean; signedIn?: boolean; subscribed?: boolean; next?: string; hasBenefits?: boolean | null; resources: PublishedResources }) {
  const accountDestination = next ?? "/membros";
  const accountLink = signedIn ? accountDestination : `/membros/entrar?next=${encodeURIComponent(accountDestination)}`;

  return <ApogeeInterface editorial area="comunidade"><EditorialPageShell current="community" className={styles.page}>
    <main id="experiencia" tabIndex={-1} data-community-page>
      <section id="inicio" className={[styles.wrap, styles.section, styles.intro].join(" ")} aria-labelledby="community-title">
        <p className={styles.eyebrow}>Comunidade Apogee</p>
        <div data-ap-reveal="" className={styles.headingRow}>
          <h1 id="community-title">Use IA. Tire suas ideias do papel.</h1>
          <p className={styles.lead}>{resources.trilha && resources.ferramentas ? "Ferramentas selecionadas, prática com IA e oportunidades para o seu próximo passo." : "Explore oportunidades, consulte benefícios e converse com outros membros sobre seus projetos."}</p>
        </div>
        <div className={styles.actions}>
          <CommunityCheckoutButton signedIn={signedIn} next={next} preview={preview} subscribed={subscribed} />
          <div className={styles.joinAction}><Link data-ap-button="secondary" href={accountLink} prefetch={false}>Continuar com minha conta</Link></div>
        </div>
        <p className={styles.accessNote}>R$ 1.438,80 por ano · equivalente a R$ 119,90/mês. Cobrança integral anual, com renovação automática.</p>
        <p className={styles.accessNote}>Pagamento seguro com a Stripe.</p>
        <div data-ap-signature="" className={styles.communityWord} aria-hidden="true">Building<br />the future.</div>
      </section>
      <section id="comunidade" className={[styles.section, styles.communityBand].join(" ")} aria-labelledby="inside-title">
        <div className={styles.wrap}>
          <div data-ap-reveal="" className={[styles.headingRow, styles.directoryHeading].join(" ")}>
            <h2 id="inside-title">O que você recebe</h2>
            <p className={styles.lead}>Conheça os recursos e as condições de acesso.</p>
          </div>
          <CommunityDirectory resources={resources} />
        </div>
      </section>
      <section id="planos" tabIndex={-1} className={[styles.wrap, styles.section, styles.plansTarget].join(" ")} aria-labelledby="plans-title">
        <div data-ap-reveal="" className={[styles.headingRow, styles.plansHeading].join(" ")}><h2 id="plans-title">Escolha seu acesso</h2></div>
        <div className={styles.plansFrame}><CommunityPlans resources={resources} preview={preview} signedIn={signedIn} subscribed={subscribed} next={next} /></div>
      </section>
      <RedBullSupport />
      <section id="radar" className={[styles.wrap, styles.section, styles.headingRow].join(" ")} aria-labelledby="radar-title">
        <div><p className={styles.eyebrow}>Apogee Radar</p><h2 id="radar-title">Encontre seu próximo passo.</h2></div>
        <div className={styles.courseCopy}>
          <p className={styles.lead}>Encontre eventos, bolsas, editais e vagas com prazos e fontes oficiais. A assinatura dá acesso ao Radar completo.</p>
          <div className={styles.actions}><Link data-ap-button="primary" className={styles.navyButton} href="/oportunidades" prefetch={false}>Explorar o Radar</Link></div>
          <p className={styles.accessNote}>Os acessos anteriores ao Radar continuam válidos.</p>
        </div>
      </section>
      {resources.ferramentas && <section id="ferramentas" className={[styles.section, styles.toolboxSection].join(" ")} aria-labelledby="toolbox-title"><div data-ap-reveal="" className={[styles.wrap, styles.headingRow].join(" ")}><div data-ap-toolbox-studio="editorial"><p className={styles.eyebrow}>Caixa de Ferramentas · assinatura anual</p><h2 data-ap-title="" id="toolbox-title">A ferramenta certa para sua tarefa.</h2></div><div className={styles.courseCopy}><p className={styles.lead}>Encontre ferramentas para criar, pesquisar e programar, com links oficiais.</p><p className={styles.accessNote}>Licenças e créditos de terceiros não estão incluídos.</p><Link className={styles.textLink} href="#plano-anual">Ver assinatura anual</Link></div></div></section>}
      {resources.trilha && <section id="learn" className={[styles.wrap, styles.section, styles.headingRow].join(" ")} aria-labelledby="learn-title"><div data-ap-learning-studio="editorial"><p className={styles.eyebrow}>Apogee Learn · Trilha</p><h2 data-ap-title="" id="learn-title">Faça sua primeira tarefa com IA.</h2></div><div className={styles.courseCopy}><p className={styles.lead}>Três atividades para escolher uma tarefa, criar seu pedido e avaliar o resultado.</p><p>Trilha inicial disponível de forma parcial. A formação ainda não está completa; próximos módulos em preparação, sem data anunciada.</p><Link className={styles.textLink} href="#plano-anual">Ver assinatura anual</Link></div></section>}
      <section id="perks" className={[styles.section, styles.benefitsSection].join(" ")} aria-labelledby="benefits-title"><div className={styles.wrap}><div data-ap-reveal="" className={styles.headingRow}><div><p className={styles.eyebrow}>Apogee Perks · Benefícios</p><h2 id="benefits-title">Consulte as ofertas dos parceiros.</h2></div><p className={styles.lead}>{COMMUNITY_BENEFITS_REDEMPTION}</p></div>{hasBenefits !== null && hasBenefits !== undefined && <p className={styles.accessNote}>{hasBenefits ? "Há ofertas vigentes no catálogo." : "O catálogo está sem ofertas vigentes no momento."}</p>}<Link className={styles.textLink} href="/beneficios" prefetch={false}>Abrir catálogo de Benefícios</Link></div></section>
      <section id="participar" className={[styles.section, styles.communityBand].join(" ")} aria-labelledby="join-title">
        <div data-ap-reveal="" className={[styles.wrap, styles.headingRow].join(" ")}>
          <div><p className={styles.eyebrow}>Comunidade Apogee</p><h2 id="join-title">Eventos presenciais</h2></div>
          <div className={styles.courseCopy}>
            <p className={styles.lead}>Encontre a comunidade. Participação e ingressos seguem as condições de cada evento.</p>
            <p><Link className={styles.textLink} href="/evento-openai#workshop-florianopolis" prefetch={false}>Ver workshop em Florianópolis</Link></p>
            <p><Link className={styles.textLink} href="/galeria" prefetch={false}>Ver fotos do Make It Fly</Link></p>
            <p className={styles.accessNote}>A inscrição no evento Codex Community é independente da assinatura e do cadastro na comunidade.</p>
            <div className={styles.joinAction}><CommunityJoinButton next={next} preview={preview} signedIn={signedIn} /></div>
          </div>
        </div>
      </section>
      <section id="duvidas" className={[styles.section, styles.faqSection].join(" ")} aria-labelledby="faq-title"><div className={[styles.wrap, styles.faqLayout].join(" ")}><h2 id="faq-title">Antes de<br />começar.</h2><div className={styles.faq}>{COMMUNITY_FAQ.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </EditorialPageShell></ApogeeInterface>;
}
