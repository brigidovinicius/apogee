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
        <div className={styles.recordingCopy}><p className={styles.eyebrow}>Codex Community · organização Apogee</p><h1 id="recording-title">O encontro termina.<br /><span>O aprendizado continua.</span></h1><p className={styles.recordingLead}>Receba a gravação do evento oficial da comunidade Codex/OpenAI, organizado pela Apogee, e continue explorando as possibilidades da IA.</p><p className={styles.recordingAvailability}><Bell size={16} aria-hidden="true" /> Aviso por e-mail quando a gravação estiver disponível.</p>
          <Link className={[styles.primary, styles.mobileCaptureLink].join(" ")} href="#inscricao">Receber aviso da gravação <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <div className={styles.recordingArtwork} aria-hidden="true"><Image src="/brand/apogee-star.svg" alt="" width={703} height={870} priority /><div className={styles.recordingArtLabel}><CirclePlay size={28} strokeWidth={1.2} /><span>Codex Community<small>O encontro da Apogee</small></span></div></div>
        </div>
        <div id="inscricao" className={styles.captureCard}><RecordingCaptureForm /></div>
      </section>
      <section id="como-funciona" className={styles.section} aria-labelledby="recording-steps-title"><div className={styles.sectionHeading}><p className={styles.eyebrow}>Do encontro ao próximo passo</p><h2 id="recording-steps-title">Um convite para continuar.</h2><p>A gravação é gratuita. Você escolhe se quer seguir a conversa com a comunidade.</p></div>
        <ol className={styles.recordingSteps}>
          <li><Mail size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>01</span><h3>Deixe seu contato.</h3><p>Informe seu nome e e-mail. Se quiser, conte qual tarefa gostaria de resolver com IA.</p></li>
          <li><Bell size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>02</span><h3>Receba o aviso.</h3><p>Quando o material estiver pronto, você será avisado por e-mail. A data de liberação ainda será informada.</p></li>
          <li><Users size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>03</span><h3>Continue aprendendo.</h3><p>Conheça o grupo gratuito no WhatsApp. A entrada na comunidade é opcional.</p></li>
        </ol>
      </section>
      <section className={[styles.section, styles.recordingCommunity].join(" ")} aria-labelledby="recording-community-title"><div><p className={styles.eyebrow}>Comunidade Apogee</p><h2 id="recording-community-title">Depois do encontro,<br />a gente segue junto.</h2><p>Um grupo gratuito para trocar experiências sobre IA, descobrir oportunidades e acompanhar a curadoria da Apogee.</p></div><div className={styles.communityActions}><CommunityJoinButton label="Conhecer o grupo gratuito" /><Link className={styles.subtleLink} href="/comunidade" prefetch={false}>Ver a proposta da comunidade <ArrowUpRight size={16} aria-hidden="true" /></Link></div></section>
      <FunnelFaq id="duvidas" title="Sobre a gravação." items={RECORDING_FAQ} />
    </main><FunnelFooter />
  </div>;
}
