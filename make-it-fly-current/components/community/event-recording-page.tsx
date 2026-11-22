import { VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { EVENT_LIVE_PATH } from "@/lib/community/event-live";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import Image from "next/image";
import Link from "next/link";
import { Bell, CirclePlay, Mail, Users } from "lucide-react";
import { RECORDING_FAQ } from "@/content/community";
import { SiteFooter } from "@/components/site/site-footer";
import { CommunityJoinButton, FunnelFaq, FunnelHeader } from "./community-funnel";
import { RecordingCaptureForm } from "./recording-capture-form";
import styles from "./community-sales-page.module.css";

const workshopTitle = "Codex Community Workshop: Florianópolis";
const workshopUrl = "https://luma.com/praotcz3";
const workshopEmbedUrl = "https://luma.com/embed/event/evt-jWqDrNqr3QQDoBd/simple";

export function EventRecordingPage({ preview = false, registered = false }: { preview?: boolean; registered?: boolean }) {
  const watchHref = registered ? EVENT_LIVE_PATH : "#inscricao";
  const watchLabel = registered ? "Assistir à gravação" : "Inscrever-se para assistir";
  return <div className={styles.page} data-recording-page>
    <FunnelHeader page="recording" />
    <main id="experiencia" tabIndex={-1}>
      <section className={styles.recordingHero} aria-labelledby="recording-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.recordingCopy}><p className={styles.eyebrow}>Codex Community · organização Apogee</p><h1 id="recording-title">Descubra o que a IA pode<br /><span>mudar na sua vida.</span></h1><p className={styles.recordingLead}>Assista à gravação do Codex Community Workshop de Florianópolis. Explore como a IA pode ajudar você a pesquisar, escrever, organizar a rotina e colocar ideias em prática.</p><p className={styles.recordingAvailability}><Bell size={16} aria-hidden="true" /> Gravação de 1h09 · acesso gratuito após a inscrição.</p>
          <div className={styles.eventOptions} role="group" aria-label="Modalidades de participação">
            <Link className={styles.primary} href={watchHref} prefetch={false} data-behavior-action="event_online_selected">{watchLabel}</Link>
            <Link className={styles.secondary} href="#workshop-florianopolis" data-behavior-action="event_workshop_selected">Lista de espera presencial</Link>
          </div>
          <div className={styles.recordingArtwork} aria-hidden="true"><Image src="/brand/apogee-star.svg" alt="" width={703} height={870} priority /><div className={styles.recordingArtLabel}><CirclePlay size={28} strokeWidth={1.2} /><span>Codex Community<small>IA para o dia a dia</small></span></div></div>
        </div>
        <div id="inscricao" className={styles.captureCard} tabIndex={-1}>
          {registered ? <div className={styles.captureForm}>
            <p className={styles.eyebrow}>Codex Community · acesso gratuito</p>
            <h2>Inscrição registrada.</h2>
            <p className={styles.formLead}>A gravação está disponível neste navegador.</p>
            <Link className={styles.primary} href={EVENT_LIVE_PATH} prefetch={false}>Assistir à gravação</Link>
          </div> : <RecordingCaptureForm preview={preview} successHref={EVENT_LIVE_PATH} />}
        </div>
      </section>
      <section id="workshop-florianopolis" tabIndex={-1} className={`${styles.section} ${styles.workshopSection}`} aria-labelledby="workshop-title">
        <div>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Workshop presencial</p>
            <h2 id="workshop-title">{workshopTitle}</h2>
            <p><time dateTime="2026-11-21T18:00:00-03:00">21 de novembro de 2026, às 18h</time> · Florianópolis, SC · Participação gratuita</p>
            <p>A lista de espera é gerenciada pelo Luma. A inscrição na lista não garante uma vaga.</p>
          </div>
          <a className={`${styles.primary} ${styles.workshopOnline}`} href={watchHref}>
            {watchLabel}
          </a>
          {voucherConfigured() && <p>
            <Link href={VOUCHER_PATH} prefetch={false} className={styles.subtleLink}>
              Acessar meu voucher na Apogee
            </Link>
          </p>}
        </div>
        <div className={styles.workshopRegistration}>
          <iframe
            className={styles.workshopEmbed}
            src={workshopEmbedUrl}
            title={`Lista de espera no Luma para ${workshopTitle}`}
            width={600}
            height={450}
            loading="lazy"
          />
          <a className={styles.subtleLink} href={workshopUrl} data-behavior-action="event_luma_opened">
            Abrir lista de espera no Luma
          </a>
        </div>
      </section>
      <section id="como-funciona" className={styles.section} aria-labelledby="recording-steps-title"><div className={styles.sectionHeading}><p className={styles.eyebrow}>O que você vai aprender</p><h2 id="recording-steps-title">Conhecimento para colocar<br />em prática.</h2><p>Explore aplicações da IA para o trabalho e a vida pessoal. Amplie seu repertório e encontre ideias para experimentar na sua rotina.</p></div>
        <ol className={styles.recordingSteps}>
          <li><Mail size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>01</span><h3>Pesquise e escreva melhor.</h3><p>Conheça possibilidades para organizar informações, desenvolver ideias e dar mais clareza à comunicação com apoio da IA.</p></li>
          <li><Bell size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>02</span><h3>Organize sua rotina.</h3><p>Explore formas de simplificar tarefas e usar seu tempo com mais intenção no trabalho e na vida pessoal.</p></li>
          <li><Users size={26} strokeWidth={1.3} aria-hidden="true" /><span className={styles.stepNumber}>03</span><h3>Encontre por onde começar.</h3><p>Identifique tarefas em que a IA pode ser útil e leve novas ideias para experimentar na sua realidade.</p></li>
        </ol>
      </section>
      <section className={[styles.section, styles.recordingCommunity].join(" ")} aria-labelledby="recording-community-title"><div><p className={styles.eyebrow}>Comunidade Apogee</p><h2 id="recording-community-title">Mais ideias.<br />Mais conexões.</h2><p>Continue com o Radar, as aplicações de IA e as conexões da Apogee. Conheça a entrada gratuita e a assinatura que reúne os quatro pilares. A inscrição neste evento é independente da comunidade.</p></div><div className={styles.communityActions}><CommunityJoinButton preview={preview} /><Link className={styles.subtleLink} href="/comunidade#planos" prefetch={false}>Conhecer a assinatura</Link></div></section>
      <FunnelFaq id="duvidas" title="Sobre o evento." items={RECORDING_FAQ} />
    </main><SiteFooter description="Conhecimento, oportunidades e gente para colocar ideias em movimento." />
  </div>;
}
