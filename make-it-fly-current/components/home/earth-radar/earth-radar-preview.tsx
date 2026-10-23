"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEMO_OPPORTUNITIES, QUICK_FILTERS, SIDEBAR_FILTERS, normalizePreviewText } from "./demo-opportunities";
import styles from "./earth-radar.module.css";

const SAVED_KEY = "apogee:earth-radar-preview:saved:v1";
const SAVED_EVENT = "apogee-preview-saved";
let memorySaved = "[]";

// As salvas deste teste ficam só neste navegador, separadas da conta real.
function savedSnapshot() {
  try { return localStorage.getItem(SAVED_KEY) ?? memorySaved; }
  catch { return memorySaved; }
}
function subscribeSaved(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(SAVED_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(SAVED_EVENT, notify);
  };
}
function readSaved(snapshot: string): string[] {
  try {
    const value: unknown = JSON.parse(snapshot);
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string =>
      typeof id === "string" && DEMO_OPPORTUNITIES.some((item) => item.id === id)))] : [];
  } catch { return []; }
}

function toggleSaved(id: string) {
  const current = readSaved(savedSnapshot());
  memorySaved = JSON.stringify(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  try { localStorage.setItem(SAVED_KEY, memorySaved); } catch { /* Sessão em memória quando o navegador bloqueia o armazenamento. */ }
  window.dispatchEvent(new Event(SAVED_EVENT));
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
// A curva começa e termina sem mudanças bruscas de velocidade.
const smoothProgress = (value: number) => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};

export function EarthRadarPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todas");
  const savedValue = useSyncExternalStore(subscribeSaved, savedSnapshot, () => "[]");
  const saved = useMemo(() => readSaved(savedValue), [savedValue]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const stage = container.querySelector<HTMLElement>("[data-earth-stage]")!;
    const frame = container.querySelector<HTMLElement>("[data-earth-frame]")!;
    const message = container.querySelector<HTMLElement>("[data-earth-message]")!;
    const nav = container.querySelector<HTMLElement>("[data-preview-nav]")!;
    const progressLine = container.querySelector<HTMLElement>("[data-page-progress]")!;
    const lightSections = container.querySelectorAll<HTMLElement>('[data-nav-theme="light"]');
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    // Um cálculo por quadro, mesmo quando chegam vários eventos de rolagem.
    function update() {
      animationFrame = 0;
      const stageTop = stage.getBoundingClientRect().top + window.scrollY;
      const progress = clamp((window.scrollY - stageTop) / Math.max(stage.offsetHeight - window.innerHeight, 1));
      const morph = smoothProgress((progress - 0.12) / 0.76);
      const side = morph * Math.min(window.innerWidth * 0.055, 74);
      frame.style.inset = reduced.matches ? "" : `${morph * 92}px ${side}px ${morph * Math.min(window.innerHeight * 0.54, 470)}px`;
      frame.style.borderRadius = reduced.matches ? "" : `${morph * 28}px`;
      const messageProgress = reduced.matches ? 1 : smoothProgress((progress - 0.42) / 0.42);
      message.style.opacity = String(messageProgress);
      message.style.transform = reduced.matches ? "" : `translate(-50%, ${20 * (1 - messageProgress)}px)`;
      message.dataset.visible = String(messageProgress > 0);
      message.inert = messageProgress < 0.9;
      const navProgress = reduced.matches ? (window.scrollY > 24 ? 1 : 0) : clamp((progress - 0.28) / 0.16);
      nav.style.opacity = String(navProgress);
      nav.style.transform = `translateY(${-12 * (1 - navProgress)}px)`;
      nav.classList.toggle(styles["is-visible"], navProgress > 0.9);
      nav.inert = navProgress < 0.9;
      nav.classList.toggle(styles["is-light"], [...lightSections].some((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= 76 && rect.bottom > 76;
      }));
      progressLine.style.width = `${clamp(window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100}%`;
    }
    function schedule() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const words = normalizePreviewText(query).trim().split(/\s+/).filter(Boolean);
  const visible = DEMO_OPPORTUNITIES.filter((item) => {
    const matchesFilter = filter === "todas" || (filter === "salvas" ? saved.includes(item.id) : item.filters.includes(filter));
    const text = normalizePreviewText(`${item.title} ${item.organization} ${item.category} ${item.location}`);
    return matchesFilter && words.every((word) => text.includes(word));
  });

  return <div ref={root} className={styles.preview}>
    <div className={styles["page-progress"]} data-page-progress aria-hidden="true" />
    <header className={styles["global-nav"]} data-preview-nav inert>
      <div className={styles["nav-inner"]}>
        <a className={styles.wordmark} href="#experiencia" aria-label="Apogee, voltar ao início">apogee</a>
        <nav className={styles["nav-links"]} aria-label="Navegação principal">
          <a href="#radar">Radar</a><a href="#comunidade">Comunidade</a>
          <Link prefetch={false} href="/blog">Blog</Link><Link prefetch={false} href="/makeitfly">Make It Fly</Link>
          <Link prefetch={false} className={styles["nav-access"]} href="/membros/entrar">Acessar</Link>
        </nav>
      </div>
    </header>
    <main id="experiencia" tabIndex={-1}>
      <section className={styles["earth-stage"]} data-earth-stage aria-label="Abertura da Apogee">
        <div className={styles["earth-sticky"]}>
          <div className={styles["earth-frame"]} data-earth-frame>
            <Image src="/design-preview/earth-horizon.png" alt="Horizonte da Terra visto do espaço ao entardecer" fill priority unoptimized sizes="100vw" />
          </div>
          <div className={styles["earth-message"]} data-earth-message data-visible="false" inert>
            <h1>Seu próximo salto.</h1>
            <p>Oportunidades, encontros e gente curiosa para construir o que vem a seguir.</p>
            <a href="#radar">Explorar o Radar</a>
          </div>
        </div>
      </section>
      <noscript><p>Explore o Radar e a comunidade Apogee abaixo. Ative o JavaScript para testar a animação, os filtros e as salvas.</p></noscript>
      <section className={styles.radar} id="radar" data-nav-theme="light" aria-labelledby="preview-radar-title">
        <header className={styles["radar-heading"]}>
          <div className={styles["radar-heading-top"]}><span>Radar de oportunidades</span><span>Prévia de design · {DEMO_OPPORTUNITIES.length} exemplos do protótipo</span></div>
          <h2 id="preview-radar-title">O mundo não espera.</h2>
          <p>Hackathons, competições, eventos e outras possibilidades para colocar suas ideias em movimento.</p>
        </header>
        <div className={styles["radar-product"]}>
          <aside className={styles["radar-sidebar"]} aria-label="Áreas do Radar">
            <strong>Explorar</strong><nav aria-label="Filtrar oportunidades">
              {SIDEBAR_FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? styles.active : undefined} onClick={() => setFilter(value)}>
                {label}{value === "salvas" && <span className={styles["saved-count"]}>{saved.length}</span>}
              </button>)}
            </nav>
          </aside>
          <div className={styles["radar-main"]}>
            <div className={styles["return-note"]}>
              <strong>{saved.length ? "Suas possibilidades estão guardadas aqui." : "Há novas possibilidades esperando por você."}</strong>
              <span>Salvas apenas neste navegador</span>
            </div>
            <div className={styles["search-wrap"]}>
              <form className={styles["search-bar"]} role="search" onSubmit={(event) => event.preventDefault()}>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque uma área, instituição ou objetivo" aria-label="Buscar oportunidades" />
                <button type="submit">Buscar</button>
              </form>
            </div>
            <nav className={styles["quick-filters"]} aria-label="Categorias de oportunidades">
              {QUICK_FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={`${styles["quick-filter"]} ${filter === value ? styles.active : ""}`} onClick={() => setFilter(value)}>{label}</button>)}
            </nav>
            <p className={styles["result-count"]} role="status">{visible.length} {visible.length === 1 ? "exemplo encontrado" : "exemplos encontrados"}</p>
            <div className={styles["list-head"]} aria-hidden="true"><span>Oportunidade</span><span>Prazo e local</span><span /></div>
            <div className={styles.opportunities}>
              {visible.map((item) => <article key={item.id} className={styles.opportunity}>
                <div className={styles["opportunity-copy"]}>
                  <p className={styles["opportunity-kicker"]}>{item.category}</p><h3>{item.title}</h3><p className={styles["opportunity-org"]}>{item.organization}</p>
                </div>
                <div className={styles["opportunity-meta"]}><strong>{item.timing}</strong><span>{item.location}</span></div>
                <button type="button" className={`${styles["opportunity-action"]} ${saved.includes(item.id) ? styles.saved : ""}`} aria-label={`${saved.includes(item.id) ? "Remover das salvas:" : "Salvar:"} ${item.title}`} aria-pressed={saved.includes(item.id)} onClick={() => toggleSaved(item.id)}>{saved.includes(item.id) ? "Salva" : "Salvar"}</button>
              </article>)}
            </div>
            {!visible.length && <div className={`${styles["empty-state"]} ${styles.visible}`}>
              <p>{filter === "salvas" && !saved.length ? "Você ainda não salvou nenhuma oportunidade nesta prévia." : "Nenhum exemplo combina com a busca e o filtro."}</p>
              <button className={styles["reset-filters"]} onClick={() => { setQuery(""); setFilter("todas"); }}>Ver todos os exemplos</button>
            </div>}
            <p className={styles["demo-note"]}>Conteúdo de demonstração. Prazos, categorias e disponibilidade não foram revalidados para inscrições.</p>
            <Link prefetch={false} className={styles["all-link"]} href="/oportunidades">Ver o Radar completo</Link>
          </div>
        </div>
      </section>
      <section className={styles["habit-section"]} aria-labelledby="preview-habit-title">
        <div className={styles["habit-grid"]}>
          <div className={styles["habit-copy"]}><h2 id="preview-habit-title">Um Radar que muda com você.</h2><p>A experiência não termina na primeira busca. Ela organiza o que é novo, o que está perto do prazo e o que você decidiu acompanhar.</p></div>
          <div className={styles["habit-cards"]}>
            <article className={styles["habit-card"]}><small>Quando você volta</small><h3>Veja primeiro o que mudou.</h3><p>Novas oportunidades entram na frente. Nada de procurar novamente tudo o que você já viu.</p><div className={styles["habit-example"]}><span>Novas desde sua última visita</span><strong>Em breve</strong></div></article>
            <article className={styles["habit-card"]}><small>Antes que o prazo passe</small><h3>Saiba o que exige atenção agora.</h3><p>Prazos próximos ficam claros sem transformar o site numa sequência de alertas agressivos.</p><div className={styles["habit-example"]}><span>Encerram nas próximas 48 horas</span><strong>Prévia</strong></div></article>
            <article className={styles["habit-card"]}><small>Para continuar depois</small><h3>Guarde possibilidades, não abas.</h3><p>O que você salva forma um espaço pessoal de pesquisa e ajuda a organizar seu próximo passo.</p><div className={styles["habit-example"]}><span>Sua coleção neste navegador</span><strong>{saved.length} {saved.length === 1 ? "salva" : "salvas"}</strong></div></article>
          </div>
        </div>
      </section>
      <section className={styles.community} id="comunidade" data-nav-theme="light" aria-labelledby="preview-community-title">
        <div className={styles["community-inner"]}>
          <div className={styles["community-copy"]}><h2 id="preview-community-title">Juntos, mais longe.</h2><p>Uma ideia pode começar com você. Na Apogee, ela encontra outras perspectivas, conversas e espaço para sair do papel.</p></div>
          <nav className={styles["community-links"]} aria-label="Explorar a comunidade">
            <Link prefetch={false} href="/galeria"><span>Os encontros em imagens</span><span>Galeria</span></Link>
            <Link prefetch={false} href="/blog"><span>Ideias para continuar a conversa</span><span>Blog</span></Link>
            <Link prefetch={false} href="/makeitfly"><span>Da ideia ao encontro</span><span>Make It Fly</span></Link>
          </nav>
        </div>
      </section>
      <section className={styles.membership} id="acesso" aria-labelledby="preview-access-title">
        <div className={styles["membership-inner"]}><div><h2 id="preview-access-title">O Radar completo, para sempre.</h2><p>Explore uma oportunidade gratuitamente. Depois, tenha acesso vitalício ao Radar por R$ 49.</p></div><Link prefetch={false} className={styles["membership-cta"]} href="/membros/radar/acesso">Conhecer o acesso vitalício</Link></div>
      </section>
    </main>
    <footer className={styles["site-footer"]}><div className={styles["footer-inner"]}><span>apogee</span><span>Comunidade e experiências para tirar ideias do papel.</span><span>Prévia local · 2026</span></div></footer>
  </div>;
}
