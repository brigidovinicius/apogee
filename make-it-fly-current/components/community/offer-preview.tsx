"use client";

import Link from "next/link";
import Script from "next/script";
import { useRef, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RADAR_FREE_EVENT_LIMIT } from "@/content/community-offer";
import { RadarOfferIntro } from "./radar-offer-intro";
import { MemberOfferOverview } from "./member-offer-overview";
import styles from "./offer-preview.module.css";
import offer from "./community-offer.module.css";

const DEMO_EVENTS = ["Lab de prototipagem com IA", "Escrita e pesquisa com IA", "Encontro de projetos e builders", "IA para organizar a rotina", "Oficina de criação visual", "Do problema ao primeiro produto", "Lab de automações", "Carreira e novas ferramentas", "Ideias para pequenos negócios", "Desafio de construção em equipe", "Dados para tomar decisões", "Comunicação para apresentar projetos"].map((title, i) => ({ id: `demo-event-${i + 1}`, title }));

export function OfferPreviewToolbar({sandbox=false}: {sandbox?: boolean}) {
  return <><Script src="/design-system/review.js" strategy="afterInteractive" /><aside className={styles.toolbar} aria-label="Navegação da prévia local"><div><strong>Prévia local da oferta</strong><Link href="/">Home</Link><Link href="/comunidade">Comunidade</Link><Link href="/evento-openai">Evento</Link><Link href="/oportunidades">Radar</Link><Link href="/membros">Área de membros</Link><Link href={sandbox ? "/previa/stripe" : "/previa/validacao"}>Validação por conta</Link></div><p>Ambiente local com contas e catálogo de revisão. Em Validação por conta, consulte os perfis para testar autenticação, formulários e persistência reais no banco isolado. {sandbox ? "Stripe exclusivamente em modo de teste, sem cobrança real. E-mails do aplicativo bloqueados." : "Pagamentos e envio de e-mail bloqueados."}</p></aside></>;
}

export function OfferRadarDemo({ compact = false }: { compact?: boolean }) {
  const [opened, setOpened] = useState<string[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [selected, setSelected] = useState<(typeof DEMO_EVENTS)[number] | null>(null);
  const [blocked, setBlocked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  function openEvent(event: (typeof DEMO_EVENTS)[number]) {
    const denied = !legacy && !opened.includes(event.id) && opened.length >= RADAR_FREE_EVENT_LIMIT;
    setBlocked(denied);
    setSelected(event);
    if (!denied && !legacy) setOpened(current => current.includes(event.id) ? current : [...current, event.id]);
    dialog.current?.showModal();
  }
  return <div className={styles.demo}>
    {!compact && <div className={styles.controls}>
      <strong role="status" aria-live="polite">{legacy ? "Acesso antigo preservado · Radar completo" : `${opened.length} de ${RADAR_FREE_EVENT_LIMIT} eventos gratuitos consultados`}</strong>
      <button type="button" onClick={() => { setLegacy(false); setOpened([]); }}>Recomeçar demonstração</button>
      <button type="button" onClick={() => { setLegacy(false); setOpened(DEMO_EVENTS.slice(0, 10).map(item => item.id)); }}>Simular limite de 10</button>
      <button type="button" aria-pressed={legacy} onClick={() => setLegacy(value => !value)}>Simular acesso antigo</button>
    </div>}
    <ul className={styles.cards}>{DEMO_EVENTS.slice(0, compact ? 3 : 12).map(item => <li key={item.id}><small>Evento demonstrativo · Apogee Radar</small><h3>{item.title}</h3><p>Descubra o formato, o que preparar e o próximo passo para participar.</p><button type="button" onClick={() => openEvent(item)} aria-haspopup="dialog">{opened.includes(item.id) ? "Reabrir evento" : "Ver detalhes"}</button></li>)}</ul>
    <p className={styles.notice}>Eventos ilustrativos para revisar a experiência. {compact ? "Conheça o Radar para experimentar o saldo e o limite." : "O saldo desta demonstração fica apenas nesta tela. A cota real por conta será integrada ao servidor na etapa funcional."}</p>
    <dialog className={styles.modal} ref={dialog} aria-labelledby="demo-event-title" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <button className={styles.close} type="button" onClick={() => dialog.current?.close()} aria-label="Fechar detalhes">Fechar</button>
      <h2 id="demo-event-title">{blocked ? "Continue com a Comunidade Apogee." : selected?.title}</h2>
      {blocked ? <><p>Você já consultou 10 oportunidades por mês gratuitamente. Os eventos liberados continuam disponíveis para reabrir. Conheça a assinatura com o Radar completo incluído.</p><Link className={offer.button} href="/comunidade#planos" onClick={() => dialog.current?.close()}>Conhecer a Comunidade Apogee</Link></> : <><p>Este é um exemplo dos detalhes de um evento: público, formato, requisitos e orientações para o próximo passo.</p><p><strong>{legacy ? "Seu acesso antigo continua válido, sem consumir a cota gratuita." : "Evento liberado. Reabri-lo não consome outra consulta."}</strong></p><p className={styles.notice}>Conteúdo demonstrativo, sem inscrição ou data real.</p></>}
    </dialog>
  </div>;
}

export function OfferPreviewPage({ screen }: { screen: "radar" | "membros" | "entrada" }) {
  const [name, setName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [legacy, setLegacy] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setRegistered(true); }
  return <div className={styles.page}><SiteHeader current={screen === "radar" ? "opportunities" : "members"} memberHref="/previa/membros" />
    <main className={styles.main} id="experiencia" tabIndex={-1}>
      {screen === "radar" ? <><h1>Radar de oportunidades</h1><p className={styles.lead}>Encontre eventos, programas e caminhos para o seu próximo passo.</p><RadarOfferIntro preview /><OfferRadarDemo /></> : screen === "membros" ? <><h1>Sua comunidade.</h1><p className={styles.lead}>Conhecimento, oportunidades e pessoas para colocar ideias em movimento.</p><div className={styles.controls}><strong>Demonstração da área de membros</strong><button type="button" aria-pressed={legacy} onClick={() => setLegacy(value => !value)}>Simular acesso antigo ao Radar</button></div><MemberOfferOverview name="Visitante" radarFullAccess={legacy} preview /></> : <><h1>Seu primeiro passo é gratuito.</h1><p className={styles.lead}>Uma conta para conhecer a Apogee e consultar até 10 oportunidades por mês no Radar. Sem cartão e sem assinatura automática.</p><div className={`${offer.scope} ${styles.entry}`}>{registered ? <div role="status"><h2>{name.trim() || "Visitante"}, vamos explorar?</h2><p>Esta é uma confirmação demonstrativa. Nenhuma conta foi criada.</p><div className={offer.actions}><Link className={offer.button} href="/oportunidades">Explorar o Radar</Link><Link className={offer.secondary} href="/previa/membros">Conhecer minha área</Link></div></div> : <form onSubmit={submit}><h2>Experimente a entrada gratuita.</h2><label>Como podemos chamar você?<input name="demo-name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={60} autoComplete="off" /></label><button className={offer.button} type="submit">Experimentar a entrada gratuita</button><p className={styles.notice}>Formulário demonstrativo. O nome fica apenas nesta tela e não é enviado ou armazenado.</p></form>}</div></>}
    </main><SiteFooter /></div>;
}
