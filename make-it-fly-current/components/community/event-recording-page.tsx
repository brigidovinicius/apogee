import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bell, CirclePlay, Mail, Users } from "lucide-react";
import { RECORDING_FAQ } from "@/content/community";
import { CommunityJoinButton, FunnelFaq, FunnelFooter, FunnelHeader } from "./community-funnel";
import { RecordingCaptureForm } from "./recording-capture-form";
import styles from "./community-sales-page.module.css";

export function EventRecordingPage() {
  return <div className={styles.page} data-recording-page>
    <FunnelHeader page="recording" />
    <main id="experiencia" tabIndex={-1}>
      <section className={styles.recordingHero} aria-labelledby="recording-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.recordingCopy}><p className={styles.eyebrow}>Codex Community · organização Apogee</p><h1 id="recording-title">Descubra o que a IA pode<br /><span>mudar na sua vida.</span></h1><p className={styles.recordingLead}>Assista gratuitamente ao evento exclusivo Codex Community, da comunidade OpenAI, organizado pela Apogee. Explore como a IA pode ajudar você a pesquisar, escrever, organizar a rotina e colocar ideias em prática.</p><p className={styles.recordingAvailability}><Bell size={16} aria-hidden="true" /> Inscrição gratuita · orientações de acesso por e-mail.</p>
          <Link className={[styles.primary, styles.mobileCaptureLink].join(" ")} href="#inscricao">Quero assistir gratuitamente <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <div className={styles.recordingArtwork} aria-hidden="true"><Image src="/brand/apogee-star.svg" alt="" width={703} height={870} priority /><div className={styles.recordingArtLabel}><CirclePlay size={28} strokeWidth={1.2} /><span>Codex Community<small>IA para o dia a dia</small></span></div></div>
        </div>
        <div id="inscricao" className={styles.captureCard}><RecordingCaptureForm /></div>
      </section>
      <section id="como-funciona" className={styles.section} aria-labelledby="recording-steps-title"><div className={styles.sectionHeading}><p className={styles.eyebrow}>O que você vai aprender</p><h2 id="recording-steps-title">Conhecimento para colocar<br />em prática.</h2><p>Explore aplicações da IA para o trabalho e a vida pessoal. Amplie seu repertório e encontre ideias para experimentar na sua rotina.</p></div>
        <ol className={styles.recordingSteps}>
          <li><Mail size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>01</span><h3>Pesquise e escreva melhor.</h3><p>Conheça possibilidades para organizar informações, desenvolver ideias e dar mais clareza à comunicação com apoio da IA.</p></li>
          <li><Bell size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>02</span><h3>Organize sua rotina.</h3><p>Explore formas de simplificar tarefas e usar seu tempo com mais intenção no trabalho e na vida pessoal.</p></li>
          <li><Users size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>03</span><h3>Encontre por onde começar.</h3><p>Identifique tarefas em que a IA pode ser útil e leve novas ideias para experimentar na sua realidade.</p></li>
        </ol>
      </section>
      <section className={[styles.section, styles.recordingCommunity].join(" ")} aria-labelledby="recording-community-title"><div><p className={styles.eyebrow}>Comunidade Apogee</p><h2 id="recording-community-title">Mais ideias.<br />Mais conexões.</h2><p>Conheça o grupo gratuito para trocar experiências sobre IA, descobrir oportunidades e acompanhar a curadoria da Apogee. A participação na comunidade é opcional.</p></div><div className={styles.communityActions}><CommunityJoinButton label="Conhecer o grupo gratuito" /><Link className={styles.subtleLink} href="/comunidade" prefetch={false}>Conhecer a comunidade <ArrowUpRight size={16} aria-hidden="true" /></Link></div></section>
      <FunnelFaq id="duvidas" title="Sobre o evento." items={RECORDING_FAQ} />
    </main><FunnelFooter />
  </div>;
}
