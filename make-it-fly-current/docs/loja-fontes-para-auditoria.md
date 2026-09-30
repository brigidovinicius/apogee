# Loja Make It Fly — fontes para auditoria

Cópia integral para leitura, preparada em 27/09/2026. **Este Markdown não é um projeto executável.** Anexe este arquivo diretamente à conversa responsável pela auditoria: ele dispensa Desktop Commander e a extração de ZIP para leitura dos arquivos abaixo.

Projeto de origem: `/Users/viniciusbrigido/Site interativo Rosa teste /make-it-fly-current`.

## Limites e contexto

- Os blocos preservam o conteúdo integral dos arquivos e suas quebras de linha; a primeira linha dentro de cada bloco é a linha 1 do arquivo original.
- O `package.json` declara Next.js `16.3.4` e os scripts `next dev --webpack` / `next build --webpack`. Isso é evidência do código, não confirmação de um servidor ativo.
- Não há `.env`, credenciais, configurações privadas de hospedagem nem dados de usuários neste documento.
- O documento permite auditoria estática. Não demonstra que a loja esteja acessível, que uma animação funcione ou que testes tenham passado. `127.0.0.1` corresponde à máquina em que o navegador está sendo executado.
- Estão incluídos quatro guias integrais da documentação local do Next.js: `use-client`, `lazy-loading`, `11-css` e `link`. Os demais guias, imagens, componentes e dependências não estão reproduzidos aqui. Se necessários, solicite especificamente os arquivos faltantes, sem fingir que foram lidos.
- Não publique, não altere arquivos e não modifique serviços externos. O `AGENTS.md` integral está incluído abaixo.

## Prompt para auditoria somente leitura

Audite os arquivos integrais neste documento, preservando marca, conteúdo e produtos do Make It Fly. Foque em liquid glass, composição alpha, normais, Fresnel, espaço de cor, suavidade e continuidade do movimento, rolagem/hover, reduced-motion, desempenho, descarte de recursos, acessibilidade e ciclo de vida dos diálogos. Diferencie transparência do canvas e refração do ambiente procedural de refração do HTML: não afirme que o texto é distorcido sem comprovação.

Entregue no máximo 8 problemas prioritários, com caminho e linha do arquivo original, trecho ou evidência, causa, impacto e correção mínima proposta. Separe achados comprováveis pela leitura de hipóteses que exigem execução. Quando faltarem dependências ou documentação, declare o limite e peça somente o arquivo necessário.

Só teste `http://127.0.0.1:3001/loja` e compare com `https://thedropstore.org` se tiver acesso real ao navegador correspondente. Se houver acesso, cubra desktop/celular, movimento normal/reduzido, rolagem rápida, hover, teclado, diálogos e WebGL/fallback. Não invente capturas, resultados, FPS, tempos, acesso a arquivos ou testes. Informe explicitamente o que foi e não foi executado. Esta auditoria é somente leitura; aguarde autorização para qualquer alteração.

## Inventário

| Arquivo | Linhas | Bytes UTF-8 | SHA-256 |
| --- | ---: | ---: | --- |
| `AGENTS.md` | 13 | 1087 | `5815fb1ca832b8a9ffc5e8ab2cde3b50f02b2baeaa1131ac0e08780152429651` |
| `package.json` | 43 | 1123 | `f7b7b33c648f9679a966e386c894df4a238d1530cac17b866cb02a15cca18fa6` |
| `app/loja/page.tsx` | 12 | 363 | `277e89ee7e67eb178896975e4d5640b2c6e6e5bf7ad4ea5d2eb6a55035646271` |
| `app/loja/store-experience.tsx` | 185 | 13308 | `b516d8c06df4fb7fbaadf1d320e151269aa0a58628857ed83c26bbc29b84e31d` |
| `app/loja/use-store-motion.ts` | 256 | 11072 | `db24e24db99d37d9181da45b2f219fa34e197d05d956d5d5ef20fd4a0d94d41f` |
| `app/loja/loja.module.css` | 240 | 21587 | `4e9236e71eaf82a45cb15590814ada03683668580b6dbe4328e82b157549c64f` |
| `app/loja/store-orb.tsx` | 249 | 11486 | `34c1d325d4cb0afe5d147bbf6e346b08ba2d06adc75539f8b6ebdb2181d1eb44` |
| `app/loja/store-glass-shader.ts` | 107 | 4879 | `c9fabc9dc74962191ed5ca79a5bfa12477ebfd9f0c312dc0e1c6591a0c1fe654` |
| `app/loja/store-orb.module.css` | 37 | 771 | `6242faaaad4679b64862a25985a58e2d7ef3fada681da094fd6f33933799acdc` |
| `app/loja/store-product-visual.tsx` | 215 | 17243 | `f4622cfe63a405643a1c90c0bd514c80c1941deee7609c187392a8f4b2d5d3f8` |
| `app/loja/store-product-visual.module.css` | 36 | 566 | `f0a545868dece9c9543b5fc63d4c13766726f4ed2debc7b17bbbfbcb770acacc` |
| `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` | 123 | 3802 | `b46c9669be66bf95c946bf47a9518b2fd755ae6303c977c364c5a632942d223e` |
| `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` | 306 | 10617 | `0a8f49a0cd5e2cff43d8e29b7aa4d1a75e3b0ccf6d98789bddcfb01d4a554d1b` |
| `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` | 458 | 12368 | `26732dd6853d66b3edb7e7cda65e46c3ff150525377f51f187e4a075d253eeda` |
| `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` | 1380 | 37423 | `e2a12de1d1e8b7e59a7046d4674862d2a2ff9e8641596f121ff9a584aa3e7daa` |

## Fontes integrais

### AGENTS.md

<!-- BEGIN SOURCE: AGENTS.md -->
`````markdown
# Publicação exige autorização explícita

O usuário determinou em 13/09/2026 que nenhuma nova versão, inclusive preview hospedado, seja publicada sem sua autorização explícita após revisão. Pedidos de alterações ou testes não autorizam publicação. O pedido atual autoriza somente restaurar a versão anterior preservando a Terra e a animação. Autorizações antigas não são permanentes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
`````
<!-- END SOURCE: AGENTS.md -->

### package.json

<!-- BEGIN SOURCE: package.json -->
`````json
{
  "name": "make-it-fly-v2",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "typegen": "next typegen --webpack",
    "typecheck": "tsc --noEmit --incremental false",
    "test": "node --test tests/*.test.mjs"
  },
  "dependencies": {
    "@base-ui/react": "^1.8.0",
    "@radix-ui/react-slot": "^1.3.3",
    "@react-three/drei": "^10.7.8",
    "@react-three/fiber": "^9.7.0",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.2.5",
    "framer-motion": "^13.2.0",
    "heic-to": "1.5.2",
    "lucide-react": "^1.41.0",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "shadcn": "^4.21.0",
    "sharp": "^0.35.4",
    "three": "^0.185.1",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.185.4",
    "eslint": "^9",
    "eslint-config-next": "16.3.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
`````
<!-- END SOURCE: package.json -->

### app/loja/page.tsx

<!-- BEGIN SOURCE: app/loja/page.tsx -->
`````tsx
import type { Metadata } from "next";
import { StoreExperience } from "./store-experience";

export const metadata: Metadata = {
  title: "Loja | Make it fly",
  description:
    "Peças, objetos e edições especiais da comunidade Make it fly — primeira coleção em desenvolvimento.",
};

export default function StorePage() {
  return <StoreExperience />;
}
`````
<!-- END SOURCE: app/loja/page.tsx -->

### app/loja/store-experience.tsx

<!-- BEGIN SOURCE: app/loja/store-experience.tsx -->
`````tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { StoreOrb } from "./store-orb";
import { StoreProductVisual } from "./store-product-visual";
import { useStoreMotion } from "./use-store-motion";
import styles from "./loja.module.css";

const collection = [
  { slug: "uniforme", name: "Uniforme de voo", detail: "Peça 01", visual: "wearable", caption: "Para vestir uma ideia.", description: "Uma peça para levar o espírito dos encontros para fora deles. A primeira proposta de vestuário da comunidade Make it fly.", category: "Vestuário" },
  { slug: "caderno", name: "Caderno orbital", detail: "A5", visual: "notebook", caption: "Toda trajetória começa no papel.", description: "Um lugar para guardar perguntas, rascunhos e planos. Um objeto cotidiano pensado para acompanhar ideias em construção.", category: "Papelaria" },
  { slug: "apogeu", name: "Objeto Apogeu", detail: "Objeto 01", visual: "object", caption: "Uma ideia em outra dimensão.", description: "Um estudo de forma inspirado em órbitas e trajetórias. A linguagem da Apogee transformada em um objeto para habitar espaços.", category: "Objetos" },
  { slug: "poster", name: "Pôster de trajetória", detail: "A2", visual: "edition", caption: "O movimento ocupa a parede.", description: "Uma edição gráfica sobre os caminhos que uma ideia pode percorrer. Tipografia, órbitas e a identidade dos nossos encontros.", category: "Edições" },
  { slug: "bolsa", name: "Bolsa de campo", detail: "Peça 02", visual: "bag", caption: "Leve o que faz você ir além.", description: "Uma bolsa para o que acompanha você entre um encontro e outro. A proposta reúne a identidade Make it fly e o uso de todos os dias.", category: "Acessórios" },
  { slug: "encontro", name: "Edição de encontro", detail: "Edição 01", visual: "ticket", caption: "Uma lembrança do que começou aqui.", description: "Uma peça gráfica para registrar conexões e encontros. Um estudo de edição comemorativa da comunidade, sem funcionar como ingresso ou reserva.", category: "Edições" },
] as const;

type CollectionItem = (typeof collection)[number];

function CycleText({ children }: { children: string }) {
  return <span className={styles.cycleText}><span>{children}</span><span aria-hidden>{children}</span></span>;
}

export function StoreExperience() {
  const root = useStoreMotion();
  const productDialog = useRef<HTMLDialogElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null);
  const releaseDialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const modalOpen = Boolean(selected || menuOpen || releaseOpen);

  useEffect(() => {
    if (!modalOpen) return;
    const dialog = selected ? productDialog.current : menuOpen ? menuDialog.current : releaseDialog.current;
    if (!dialog) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    dialog.showModal();
    dialog.scrollTop = 0;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex='0']"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      dialog.removeEventListener("keydown", trapFocus);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      returnFocus.current?.focus({ preventScroll: true });
    };
  }, [modalOpen, selected, menuOpen]);

  const closeModal = () => {
    if (closing) return;
    setClosing(true);
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400;
    closeTimer.current = setTimeout(() => {
      setSelected(null);
      setMenuOpen(false);
      setReleaseOpen(false);
      setClosing(false);
    }, duration);
  };

  return (
    <div className={styles.page} ref={root}>
      <div className={styles.loader} aria-hidden>
        <span className={styles.loaderBrand}>MakeItFly</span>
        <span className={styles.loaderLabel}>Carregando coleção <i /></span>
      </div>

      <header className={styles.storeHeader}>
        <Link className={styles.brand} href="/" aria-label="Make it fly — início">MakeItFly<span aria-hidden>✦</span></Link>
        <nav className={styles.navigation} aria-label="Navegação da loja">
          <a href="#produtos"><CycleText>Coleção</CycleText></a>
          <Link href="/galeria"><CycleText>Nossa história</CycleText></Link>
        </nav>
        <div className={styles.headerActions}>
          <button className={styles.release} type="button" onClick={() => setReleaseOpen(true)} aria-haspopup="dialog">
            <CycleText>Em breve</CycleText><span className={styles.releaseCount}>1</span>
          </button>
          <button className={styles.menuButton} type="button" aria-expanded={menuOpen} aria-label="Abrir menu" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
        </div>
      </header>

      <aside className={styles.sideLabel} aria-hidden><span>Make it fly</span><span>●</span></aside>
      <aside className={styles.apogeeBadge} aria-hidden><strong>A.</strong><span>Building the future</span></aside>
      <div className={styles.cursor} data-store-cursor aria-hidden><i /><span>Ver peça</span></div>

      <main id="experiencia">
        <section className={styles.showcase} id="colecao" aria-labelledby="store-title">
          <div className={styles.heroSticky}>
            <div className={styles.orbCanvas} aria-hidden><div className={styles.orbTravel}><StoreOrb /></div></div>
            <div className={styles.heroCopy}>
              <h1 id="store-title">
                <span className={styles.desktopTitle}><span><span>Objetos para ideias</span></span><span><span>que ganham o mundo.</span></span></span>
                <span className={styles.mobileTitle}>Objetos para<br />ideias que<br />ganham o mundo.</span>
              </h1>
              <a className={styles.pill} href="#produtos"><CycleText>Ver a coleção</CycleText></a>
            </div>
          </div>

          <div className={styles.productStream} id="produtos">
            {collection.map((item, index) => (
              <div className={styles.productSlot} data-store-slot key={item.slug} style={{ "--float-delay": `${index * -2.7}s`, "--float-duration": `${10 + index % 3 * 2}s` } as CSSProperties}>
                <div className={styles.productFloat}>
                  <button className={styles.productCard} data-store-card type="button" onClick={() => setSelected(item)} aria-label={`Ver protótipo ${item.name}`} aria-haspopup="dialog">
                    <div className={styles.productObject}><StoreProductVisual kind={item.visual} /></div>
                    <div className={styles.productMeta}>
                      <div><span><strong>{item.name}</strong></span><span><span>— {item.detail}</span></span></div>
                      <span className={styles.productStatus}><span>Protótipo</span><b>{String(index + 1).padStart(2, "0")}</b></span>
                    </div>
                    <span className={styles.mobileCardArrow} aria-hidden>↗</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <p className={styles.footerEyebrow}>Make it fly · primeira coleção</p>
          <h2>O futuro<br />também precisa<br />de objetos.</h2>
          <div className={styles.footerContent}>
            <Link className={styles.pill} href="/galeria"><CycleText>Nossa história</CycleText></Link>
            <p>Ideias, encontros e objetos da comunidade Apogee. A primeira coleção está em desenvolvimento.</p>
            <nav aria-label="Navegação do rodapé"><Link href="/"><CycleText>Make it fly</CycleText></Link><Link href="/galeria"><CycleText>Galeria</CycleText></Link><a href="#colecao"><CycleText>Voltar ao início ↑</CycleText></a></nav>
          </div>
          <div className={styles.footerBottom}><span>© Make it fly · Apogee</span><span>Building the future.</span></div>
        </footer>
      </main>

      <dialog ref={productDialog} className={styles.productDialog} data-closing={closing} aria-labelledby="product-title" onCancel={(event) => { event.preventDefault(); closeModal(); }}>
        {selected && <>
          <div className={styles.productDialogHeader}><span className={styles.brand}>MakeItFly<span aria-hidden>✦</span></span><button type="button" className={styles.closeButton} onClick={closeModal} autoFocus><CycleText>Voltar à coleção</CycleText><span aria-hidden>×</span></button></div>
          <div className={styles.productHero}>
            <span className={styles.productBarcode} aria-hidden />
            <span className={styles.productCategory}>{selected.category} <span aria-hidden>✦</span></span>
            <div className={styles.productMarquee} aria-hidden><div>{[0, 1, 2, 3].map((i) => <span key={i}>{selected.name} — {selected.detail}&nbsp;</span>)}</div></div>
            <div className={styles.detailObject}><StoreProductVisual kind={selected.visual} /></div>
            <div className={styles.detailNumber}><span>Protótipo</span><strong>{String(collection.indexOf(selected) + 1).padStart(2, "0")}</strong></div>
            <div className={styles.productSticker}>Primeira<br />coleção<br /><span aria-hidden>↗</span></div>
            <button type="button" className={`${styles.pill} ${styles.productExplore}`} onClick={() => productDialog.current?.querySelector("[data-product-story]")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })}><CycleText>Conhecer a peça ↓</CycleText></button>
          </div>
          <section className={styles.productStory} data-product-story>
            <div><p>Primeira coleção · {selected.detail}</p><h2 id="product-title">{selected.name}</h2><h3>{selected.caption}</h3></div>
            <div><p>{selected.description}</p><p className={styles.developmentNote}>Estudo visual da coleção. Materiais, medidas e produção ainda estão em definição. Este item não está à venda.</p><Link className={styles.pill} href="/galeria"><CycleText>Conheça a comunidade ↗</CycleText></Link></div>
          </section>
        </>}
      </dialog>

      <dialog ref={releaseDialog} className={styles.releaseDialog} data-closing={closing} aria-labelledby="release-title" onCancel={(event) => { event.preventDefault(); closeModal(); }} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className={styles.releasePanel}><div className={styles.releasePanelHeader}><span>Primeira coleção <sup>[1]</sup></span><button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Fechar" autoFocus>×</button></div><div><p>Make it fly store</p><h2 id="release-title">Em breve,<br />fora do papel.</h2><p>A loja está em preparação. Esta é uma seleção em desenvolvimento: estudos de peças, objetos e edições da nossa comunidade.</p><Link className={styles.pill} href="/galeria"><CycleText>Conheça nossa história</CycleText></Link></div></div>
      </dialog>

      <dialog ref={menuDialog} className={styles.mobileMenu} data-closing={closing} aria-label="Menu da loja" onCancel={(event) => { event.preventDefault(); closeModal(); }}>
        <div className={styles.menuHeader}><span className={styles.brand}>MakeItFly<span aria-hidden>✦</span></span><button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Fechar menu" autoFocus>×</button></div>
        <nav aria-label="Menu móvel"><a href="#produtos" onClick={closeModal}>Coleção<span>↗</span></a><Link href="/galeria">Nossa história<span>↗</span></Link><Link href="/">Início<span>↗</span></Link></nav>
        <div className={styles.menuBottom}><p>Building the future.</p><span>MAKE IT FLY</span></div>
      </dialog>
    </div>
  );
}
`````
<!-- END SOURCE: app/loja/store-experience.tsx -->

### app/loja/use-store-motion.ts

<!-- BEGIN SOURCE: app/loja/use-store-motion.ts -->
`````typescript
"use client";

import { useEffect, useRef } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Exponential damping uses elapsed seconds so 60 Hz and 120 Hz feel the same.
const damp = (value: number, target: number, speed: number, delta: number) =>
  value + (target - value) * -Math.expm1(-speed * delta);

/** Keep scrolling native; smooth the objects and light, never the document itself. */
export function useStoreMotion() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const page = element;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = matchMedia("(min-width: 761px) and (hover: hover) and (pointer: fine)");
    const cursor = page.querySelector<HTMLElement>("[data-store-cursor]");
    const html = document.documentElement;
    const previousBehavior = html.style.scrollBehavior;
    const cards = Array.from(page.querySelectorAll<HTMLElement>("[data-store-slot]")).map((slot, index) => ({
      slot,
      card: slot.querySelector<HTMLElement>("[data-store-card]"),
      visible: false,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      time: index * 2.73,
      floatX: 0,
      floatY: 0,
      floatTurn: 0,
      turn: 0,
      lift: 0,
      tiltX: 0,
      tiltY: 0,
      hover: 0,
      glintX: 50,
      glintY: 40,
    }));

    let frame = 0;
    let lastTime = 0;
    let measureNeeded = true;
    let hitTestNeeded = false;
    let viewportHeight = innerHeight;
    let maxScroll = 1;
    let progress = 0;
    let orbX = 0;
    let orbY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let hasPointer = false;
    let hovered: HTMLElement | null = null;
    let modalOpen = Boolean(page.querySelector("dialog[open]"));

    const requestFrame = () => {
      if (!frame && !document.hidden && !modalOpen) frame = requestAnimationFrame(draw);
    };

    function draw(time: number) {
      frame = 0;
      const delta = Math.min((time - (lastTime || time - 16.67)) / 1000, 0.05);
      lastTime = time;
      const scroll = window.scrollY;
      const animate = !reduced.matches && !modalOpen && desktop.matches;

      // Read layout together, and only after layout/viewport changes. The slot
      // itself never transforms, so its document coordinates remain stable.
      if (measureNeeded) {
        viewportHeight = innerHeight;
        maxScroll = Math.max(1, html.scrollHeight - viewportHeight);
        for (const state of cards) {
          const rect = state.slot.getBoundingClientRect();
          state.left = rect.left;
          state.top = rect.top + scroll;
          state.width = rect.width;
          state.height = rect.height;
        }
        measureNeeded = false;
      }
      if (hitTestNeeded && hasPointer && animate) {
        hovered = document.elementFromPoint(pointerX, pointerY)?.closest<HTMLElement>("[data-store-card]") ?? null;
      }
      hitTestNeeded = false;

      const targetProgress = clamp(scroll / maxScroll, 0, 1);
      progress = reduced.matches ? targetProgress : damp(progress, targetProgress, 8, delta);
      const targetOrbX = animate ? Math.sin(progress * Math.PI * 3) * 16 : 0;
      const targetOrbY = animate ? Math.sin(progress * Math.PI * 2) * 9 : 0;
      // A short second damping pass rounds trajectory changes without a CSS
      // transition being restarted on every incoming scroll event.
      orbX = reduced.matches ? 0 : damp(orbX, targetOrbX, 5, delta);
      orbY = reduced.matches ? 0 : damp(orbY, targetOrbY, 5, delta);
      let needsFrame = Math.abs(progress - targetProgress) > 0.0001
        || Math.abs(orbX - targetOrbX) + Math.abs(orbY - targetOrbY) > 0.005;

      // All DOM writes occur after the measurement/hit-test phase.
      page.dataset.scrolled = String(scroll > 20);
      page.dataset.cursorActive = String(animate && hasPointer && Boolean(hovered));
      page.style.setProperty("--scroll-progress", progress.toFixed(5));
      page.style.setProperty("--orb-x", `${orbX.toFixed(3)}vw`);
      page.style.setProperty("--orb-y", `${orbY.toFixed(3)}vh`);

      if (cursor && animate && hasPointer) {
        cursorX = damp(cursorX, pointerX + 18, 19, delta);
        cursorY = damp(cursorY, pointerY + 18, 19, delta);
        cursor.style.transform = `translate3d(${cursorX.toFixed(2)}px,${cursorY.toFixed(2)}px,0)`;
        needsFrame ||= Math.abs(cursorX - pointerX - 18) + Math.abs(cursorY - pointerY - 18) > 0.1;
      }

      for (const state of cards) {
        if (!state.visible || !state.card) continue;
        const isHovered = animate && hovered === state.card;
        const phase = clamp((state.top + state.height / 2 - scroll - viewportHeight / 2) / viewportHeight, -1, 1);
        const localX = isHovered ? clamp((pointerX - state.left) / state.width, 0, 1) : 0.5;
        const localY = isHovered ? clamp((pointerY - state.top + scroll) / state.height, 0, 1) : 0.4;

        if (animate) state.time += delta;
        // Offset frequencies make a slow looping orbit, not a diagonal seesaw.
        const floatX = animate ? Math.sin(state.time * 0.53) * 5 + Math.sin(state.time * 0.29) * 2 : 0;
        const floatY = animate ? Math.cos(state.time * 0.67) * 7 : 0;
        const floatTurn = animate ? Math.sin(state.time * 0.39) * 0.32 : 0;
        const blend = reduced.matches ? 1 : -Math.expm1(-8 * delta);
        state.floatX += (floatX - state.floatX) * blend;
        state.floatY += (floatY - state.floatY) * blend;
        state.floatTurn += (floatTurn - state.floatTurn) * blend;
        state.turn += ((animate ? phase * 10 : 0) - state.turn) * blend;
        state.lift += ((animate ? phase * -18 : 0) - state.lift) * blend;
        state.hover = damp(state.hover, isHovered ? 1 : 0, 10, delta);
        state.tiltX = damp(state.tiltX, isHovered ? (localX - 0.5) * 9 : 0, 11, delta);
        state.tiltY = damp(state.tiltY, isHovered ? (localY - 0.5) * -8 : 0, 11, delta);
        state.glintX = damp(state.glintX, localX * 100, 9, delta);
        state.glintY = damp(state.glintY, localY * 100, 9, delta);

        state.slot.style.setProperty("--float-x", `${state.floatX.toFixed(2)}px`);
        state.slot.style.setProperty("--float-y", `${state.floatY.toFixed(2)}px`);
        state.slot.style.setProperty("--float-turn", `${state.floatTurn.toFixed(3)}deg`);
        state.slot.style.setProperty("--product-turn", `${state.turn.toFixed(3)}deg`);
        state.slot.style.setProperty("--product-lift", `${state.lift.toFixed(2)}px`);
        state.card.style.setProperty("--pointer-x", `${state.tiltX.toFixed(3)}deg`);
        state.card.style.setProperty("--pointer-y", `${state.tiltY.toFixed(3)}deg`);
        state.card.style.setProperty("--hover-lift", `${(state.hover * -8).toFixed(2)}px`);
        state.card.style.setProperty("--hover-scale", (1 + state.hover * 0.035).toFixed(4));
        state.card.style.setProperty("--hover-progress", state.hover.toFixed(4));
        state.card.style.setProperty("--glint-x", `${state.glintX.toFixed(2)}%`);
        state.card.style.setProperty("--glint-y", `${state.glintY.toFixed(2)}%`);
        needsFrame ||= animate;
      }

      if (needsFrame && !reduced.matches && !modalOpen) requestFrame();
      else lastTime = 0;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const state = cards.find(({ slot }) => slot === entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        state.slot.dataset.inView = String(entry.isIntersecting);
        if (entry.isIntersecting) state.slot.dataset.revealed = "true";
      }
      requestFrame();
    }, { threshold: 0, rootMargin: "100px 0px" });
    cards.forEach(({ slot }) => observer.observe(slot));

    const onScroll = () => {
      hitTestNeeded = true;
      requestFrame();
    };
    const onResize = () => {
      measureNeeded = true;
      requestFrame();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(page);
    const resetPointer = () => {
      hovered = null;
      hasPointer = false;
      page.dataset.cursorActive = "false";
      requestFrame();
    };
    const onPointer = (event: PointerEvent) => {
      if (!desktop.matches || reduced.matches || modalOpen || event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!hasPointer) {
        cursorX = pointerX + 18;
        cursorY = pointerY + 18;
        hasPointer = true;
      }
      const target = event.target instanceof Element ? event.target : null;
      hovered = target?.closest<HTMLElement>("[data-store-card]") ?? null;
      requestFrame();
    };
    const syncPause = () => {
      modalOpen = Boolean(page.querySelector("dialog[open]"));
      page.dataset.motionPaused = String(modalOpen || document.hidden || reduced.matches);
      page.dataset.pageHidden = String(document.hidden);
      if (modalOpen || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        hovered = null;
        hasPointer = false;
        page.dataset.cursorActive = "false";
      } else {
        measureNeeded = true;
        requestFrame();
      }
    };
    const dialogObserver = new MutationObserver(syncPause);
    dialogObserver.observe(page, { subtree: true, attributes: true, attributeFilter: ["open"] });
    const onPreference = () => {
      html.style.scrollBehavior = reduced.matches ? "auto" : "smooth";
      resetPointer();
      syncPause();
    };

    page.dataset.motionReady = "true";
    onPreference();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("blur", resetPointer);
    window.addEventListener("keydown", resetPointer);
    document.addEventListener("visibilitychange", syncPause);
    page.addEventListener("pointermove", onPointer, { passive: true });
    page.addEventListener("pointerleave", resetPointer);
    reduced.addEventListener("change", onPreference);
    desktop.addEventListener("change", onPreference);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      dialogObserver.disconnect();
      cancelAnimationFrame(frame);
      html.style.scrollBehavior = previousBehavior;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("keydown", resetPointer);
      document.removeEventListener("visibilitychange", syncPause);
      page.removeEventListener("pointermove", onPointer);
      page.removeEventListener("pointerleave", resetPointer);
      reduced.removeEventListener("change", onPreference);
      desktop.removeEventListener("change", onPreference);
    };
  }, []);

  return root;
}
`````
<!-- END SOURCE: app/loja/use-store-motion.ts -->

### app/loja/loja.module.css

<!-- BEGIN SOURCE: app/loja/loja.module.css -->
`````css
.page {
  --store-ink: #171919;
  --store-paper: #fff;
  --store-card: #ecedf1;
  --store-line: #dedede;
  min-height: 100svh;
  overflow: clip;
  color: var(--store-ink);
  background: var(--store-paper);
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.page a { color: inherit; text-decoration: none; }
.page button { color: inherit; font: inherit; }
.page button, .page a { -webkit-tap-highlight-color: transparent; }
.page a:focus-visible, .page button:focus-visible { outline: 2px solid #305e84; outline-offset: 5px; }
.page dialog { color: var(--store-ink); }

.loader { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 1.8rem; background: #fff; pointer-events: none; animation: loader-exit 1.35s cubic-bezier(.76,0,.24,1) both; }
.loaderBrand { font-size: clamp(2.5rem,7vw,6rem); letter-spacing: -.075em; }
.loaderLabel { display: flex; align-items: center; gap: 1rem; font-size: .7rem; }
.loaderLabel i { width: 4rem; height: 1px; background: #171919; transform-origin: left; animation: loader-line 850ms cubic-bezier(.65,0,.35,1) both; }
.storeHeader { position: fixed; inset: 0 0 auto; z-index: 40; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 3.55rem; padding: 0 1.5rem; border-bottom: 1px solid rgb(190 199 206 / 38%); background: rgb(255 255 255 / 72%); backdrop-filter: blur(22px) saturate(135%); -webkit-backdrop-filter: blur(22px) saturate(135%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 90%), 0 1px 0 rgb(255 255 255 / 55%); }
.brand { display: inline-flex; align-items: start; justify-self: start; font-size: 1.16rem; line-height: 1; font-weight: 600; letter-spacing: -.065em; }
.brand > span { margin: -.05em 0 0 .25em; font-size: .44em; letter-spacing: 0; }
.navigation { display: flex; gap: 2.1rem; font-size: .9rem; }
.headerActions { display: flex; align-items: center; justify-self: end; gap: 1.8rem; }
.release { display: inline-flex; align-items: center; gap: .55rem; padding: 0; border: 0; background: transparent; cursor: pointer; }
.release .cycleText { font-size: .9rem; }
.releaseCount { display: grid; width: 1.25rem; height: 1.25rem; place-items: center; border: 1px solid; border-radius: 50%; font-size: .8rem; }
.menuButton { display: none; }
.cycleText { position: relative; display: inline-block; overflow: hidden; vertical-align: middle; line-height: 1.2; }
.cycleText > span { display: block; transition: transform 420ms cubic-bezier(.22,1,.36,1); }
.cycleText > span:last-child { position: absolute; top: 100%; left: 0; white-space: nowrap; }
.page a:hover .cycleText > span, .page button:hover .cycleText > span { transform: translateY(-100%); }
.sideLabel { position: fixed; z-index: 35; top: 50%; left: 1.5rem; display: flex; align-items: start; gap: .4rem; font-size: .72rem; line-height: 1; text-transform: uppercase; writing-mode: vertical-rl; transform: translateY(-50%) rotate(180deg); pointer-events: none; mix-blend-mode: multiply; }
.sideLabel span:last-child { font-size: .68rem; }
.apogeeBadge { position: fixed; z-index: 35; top: 50%; right: 0; display: flex; align-items: center; flex-direction: column; gap: 1.1rem; width: 3.35rem; padding: 1rem 0 1.2rem; color: #fff; background: #050505; transform: translateY(-50%); pointer-events: none; }
.apogeeBadge strong { font-size: 1.2rem; }
.apogeeBadge span { font-size: .65rem; font-weight: 600; writing-mode: vertical-rl; transform: rotate(180deg); }
.cursor { position: fixed; z-index: 45; top: 0; left: 0; display: flex; align-items: center; gap: .75rem; font-size: .7rem; text-transform: uppercase; pointer-events: none; opacity: 0; transition: opacity 150ms ease; will-change: transform; }
.cursor i { width: .48rem; height: .48rem; border-radius: 50%; background: #171919; }
.page[data-cursor-active="true"] .cursor { opacity: 1; }

.showcase { position: relative; }
.heroSticky { position: sticky; top: 0; height: 100svh; min-height: 35rem; overflow: hidden; }
.orbCanvas { position: absolute; top: 50%; left: 50%; width: min(67vmin,40rem); aspect-ratio: 1; transform: translate(-50%,-50%); opacity: 0; animation: orb-enter 1.6s .45s ease forwards; }
.orbTravel { width: 100%; height: 100%; transform: translate3d(var(--orb-x,0),var(--orb-y,0),0); will-change: transform; }
.heroCopy { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 4rem 1.5rem 2rem; text-align: center; pointer-events: none; }
.heroCopy h1 { width: 100%; margin: 0; font-size: clamp(4rem,8.8vw,10rem); font-weight: 400; line-height: 1.06; letter-spacing: -.055em; }
.desktopTitle, .desktopTitle > span { display: block; }
.desktopTitle > span { overflow: hidden; padding-bottom: .035em; }
.desktopTitle > span > span { display: block; transform: translateY(115%); animation: line-enter 1.25s .65s cubic-bezier(.22,1,.36,1) forwards; }
.desktopTitle > span:last-child > span { animation-delay: .78s; }
.mobileTitle { display: none; }
.pill { display: inline-flex; align-items: center; justify-content: center; width: fit-content; padding: .78rem 1.5rem; border: 1px solid currentColor; border-radius: 50px; background: transparent; font-size: 1rem; line-height: 1.2; cursor: pointer; }
.heroCopy > a { margin-top: 2rem; opacity: 0; animation: fade-enter 1s 1.02s forwards; pointer-events: auto; }
.heroCopy > .pill { background: linear-gradient(145deg,rgb(255 255 255 / 65%),rgb(255 255 255 / 12%) 50%,rgb(215 225 231 / 24%)); backdrop-filter: blur(8px) saturate(125%); -webkit-backdrop-filter: blur(8px) saturate(125%); box-shadow: inset 0 1px 0 #fff, inset 0 -1px 1px rgb(152 168 179 / 30%), 0 3px 12px rgb(20 40 55 / 4%); }
.productStream { position: relative; z-index: 5; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); align-items: start; gap: 0 4vw; margin-top: -20svh; padding: 0 2vw 40svh; scroll-margin-top: 6rem; pointer-events: none; }
.productSlot { position: relative; width: 100%; pointer-events: auto; }
.productSlot:nth-child(2) { width: 80%; justify-self: center; margin-top: -8svh; }
.productSlot:nth-child(3) { width: 70%; justify-self: center; margin-top: -1vw; }
.productSlot:nth-child(4) { margin-top: 12vw; }
.productSlot:nth-child(5) { width: 80%; justify-self: center; margin-top: 5vw; }
.productSlot:nth-child(6) { width: 70%; justify-self: center; margin-top: 1vw; }
.productFloat { transform: translate3d(var(--float-x,0px),var(--float-y,0px),0) rotate(var(--float-turn,0deg)); }
.productSlot[data-in-view="true"] .productFloat, .productSlot[data-in-view="true"] .productObject { will-change: transform; }
.productCard { position: relative; display: block; width: 100%; aspect-ratio: 1.1111; overflow: hidden; padding: 0; border: 0; border-radius: .75rem; background: var(--store-card); text-align: left; cursor: pointer; perspective: 900px; transition: opacity 900ms ease, transform 1.2s cubic-bezier(.22,1,.36,1); }
.productCard::after { position: absolute; inset: 0; border-radius: inherit; content: ""; pointer-events: none; background: radial-gradient(ellipse at var(--glint-x,50%) var(--glint-y,40%),rgb(255 255 255 / 24%),transparent 62%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 75%); opacity: var(--hover-progress,0); }
.page[data-motion-ready="true"] .productSlot:not([data-revealed="true"]) .productCard { opacity: 0; transform: translateY(3rem); }
.page .productCard:focus-visible { opacity: 1 !important; transform: none !important; }
.productObject { position: absolute; inset: 1% 1% 7%; transform: translate3d(0,calc(var(--product-lift,0px) + var(--hover-lift,0px)),0) rotateX(var(--pointer-y,0deg)) rotateY(var(--pointer-x,0deg)) rotate(var(--product-turn,0deg)) scale(var(--hover-scale,1)); transform-origin: 50% 54%; }
.productObject > svg { width: 100%; height: 100%; }
.productMeta { position: absolute; z-index: 2; inset: auto 1.5rem 1.5rem; display: flex; align-items: end; justify-content: space-between; gap: 1rem; pointer-events: none; text-transform: uppercase; }
.productMeta > div { display: grid; }
.productMeta > div > span { display: block; overflow: hidden; }
.productMeta strong, .productMeta > div > span > span { display: block; font-size: clamp(.72rem,1.2vw,1rem); line-height: 1.4; font-weight: 400; transition: transform 650ms cubic-bezier(.22,1,.36,1); }
.productStatus { display: flex; align-items: end; gap: .5rem; }
.productStatus > span { margin-bottom: .15em; font-size: .53rem; letter-spacing: .02em; }
.productStatus b { font-size: clamp(1.4rem,2.5vw,2.4rem); line-height: 1; letter-spacing: -.05em; font-weight: 400; }
.mobileCardArrow { display: none; }
.footer { position: relative; z-index: 10; min-height: 90svh; padding: 3rem 1.5rem 1.5rem; color: #fff; background: #171919; }
.footerEyebrow { margin: 0 0 3rem; font-size: .75rem; text-transform: uppercase; }
.footer h2 { max-width: 13ch; margin: 0; font-size: clamp(5rem,11.25vw,12rem); font-weight: 400; line-height: .93; letter-spacing: -.055em; }
.footerContent { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: start; gap: 3rem; margin: 5rem 0 7rem; }
.footerContent .pill { color: #171919; background: #fff; border-color: #fff; }
.footerContent > p { max-width: 28ch; margin: 0; font-size: 1rem; line-height: 1.5; }
.footerContent nav { display: grid; justify-self: center; gap: .75rem; font-size: 1rem; }
.footerBottom { display: flex; justify-content: space-between; gap: 2rem; font-size: .8rem; }

.productDialog, .releaseDialog, .mobileMenu { position: fixed; inset: 0; width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 0; border: 0; overscroll-behavior: contain; }
.productDialog::backdrop, .releaseDialog::backdrop, .mobileMenu::backdrop { background: rgb(15 20 25 / 38%); backdrop-filter: blur(4px); }
.productDialog { overflow-y: auto; background: #fff; }
.productDialog[open] { animation: product-open 650ms cubic-bezier(.22,1,.36,1) both; }
.productDialog[data-closing="true"] { animation: product-close 400ms cubic-bezier(.55,0,1,.45) both; }
.productDialogHeader { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; justify-content: space-between; height: 3.55rem; padding: 0 1.5rem; border-bottom: 1px solid #d8d9dc; background: rgb(236 237 241 / 85%); backdrop-filter: blur(12px); }
.closeButton { display: inline-flex; align-items: center; gap: .8rem; padding: .5rem 0 .5rem .75rem; border: 0; background: transparent; font-size: .85rem; cursor: pointer; }
.closeButton > span:last-child:not(.cycleText) { font-size: 1.7rem; line-height: .6; font-weight: 300; }
.productHero { position: relative; min-height: calc(100svh - 3.55rem); overflow: hidden; background: var(--store-card); isolation: isolate; }
.productBarcode { position: absolute; z-index: 2; top: 1.5rem; left: 1.5rem; width: .85rem; height: 6rem; background: repeating-linear-gradient(0deg,#171919 0 1px,transparent 1px 3px,#171919 3px 5px,transparent 5px 7px); }
.productCategory { position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: .5rem; font-size: .7rem; text-transform: uppercase; writing-mode: vertical-rl; }
.productCategory span { font-size: 1rem; }
.productMarquee { position: absolute; top: 30%; width: 100%; overflow: hidden; color: #fff; font-size: clamp(6rem,17vw,20rem); letter-spacing: -.07em; line-height: 1; }
.productMarquee > div { display: flex; width: max-content; animation: marquee 36s linear infinite; }
.productMarquee span { display: block; flex: none; }
.detailObject { position: absolute; z-index: 1; top: 2%; left: 50%; width: min(70vmin,48rem); height: 83%; transform: translateX(-50%); animation: detail-float 8s ease-in-out infinite; }
.detailObject svg { width: 100%; height: 100%; }
.detailNumber { position: absolute; bottom: 18%; left: 1.5rem; display: grid; }
.detailNumber > span { font-size: .72rem; text-transform: uppercase; }
.detailNumber strong { font-size: clamp(4.5rem,11vw,11rem); line-height: 1; letter-spacing: -.065em; font-weight: 400; }
.productSticker { position: absolute; right: 1.5rem; bottom: 24%; display: grid; align-content: center; width: 7rem; height: 7rem; border: 1px solid; border-radius: 50%; font-size: 1rem; text-align: center; transform: rotate(9deg); }
.productExplore { position: absolute; z-index: 2; left: 50%; bottom: 1.5rem; transform: translateX(-50%); color: #fff !important; border-color: #171919; background: #171919; white-space: nowrap; }
.productStory { display: grid; grid-template-columns: 1.1fr 1fr; gap: 8vw; padding: 6rem 5vw 8rem; scroll-margin-top: 4rem; }
.productStory > div:first-child > p { margin: 0 0 2rem; font-size: .72rem; text-transform: uppercase; }
.productStory h2 { margin: 0; font-size: clamp(3rem,5.5vw,6rem); font-weight: 400; line-height: .95; letter-spacing: -.06em; }
.productStory h3 { max-width: 26ch; margin: 2rem 0 0; font-size: 1.4rem; font-weight: 400; line-height: 1.2; }
.productStory > div:last-child > p { margin: 0 0 2rem; font-size: 1.3rem; line-height: 1.4; letter-spacing: -.02em; }
.productStory .developmentNote { padding-top: 2rem; border-top: 1px solid #dedede; color: #63666a; font-size: .95rem !important; letter-spacing: 0 !important; }
.productStory .pill { margin-top: 1rem; }
.releaseDialog { overflow: visible; background: transparent; }
.releaseDialog[open] { display: flex; justify-content: end; }
.releasePanel { display: flex; flex-direction: column; justify-content: space-between; gap: 4rem; width: min(40rem,52vw); height: 100%; overflow-y: auto; padding: 1.5rem 2.5rem 4rem; background: #fff; animation: panel-enter 600ms cubic-bezier(.22,1,.36,1) both; }
.releaseDialog[data-closing="true"] .releasePanel { animation: panel-exit 400ms cubic-bezier(.55,0,1,.45) both; }
.releasePanelHeader { display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; }
.releasePanelHeader sup { font-size: .75rem; margin-left: .4rem; }
.releasePanelHeader button { font-size: 2rem; }
.releasePanel > div:last-child > p:first-child { text-transform: uppercase; font-size: .72rem; }
.releasePanel h2 { margin: 2rem 0; font-size: clamp(3.5rem,5vw,5.5rem); line-height: .95; letter-spacing: -.065em; font-weight: 400; }
.releasePanel > div:last-child > p { max-width: 35ch; line-height: 1.5; }
.releasePanel .pill { margin-top: 2rem; }
.mobileMenu { overflow-y: auto; padding: 0 1.5rem 1.5rem; background: #fff; }
.mobileMenu[open] { display: flex; flex-direction: column; animation: menu-enter 550ms cubic-bezier(.22,1,.36,1) both; }
.mobileMenu[data-closing="true"] { animation: menu-exit 400ms cubic-bezier(.55,0,1,.45) both; }
.menuHeader { display: flex; align-items: center; justify-content: space-between; min-height: 4.5rem; }
.menuHeader button { font-size: 2rem; }
.mobileMenu nav { display: grid; margin: 4rem 0 5rem; }
.mobileMenu nav a { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; font-size: clamp(2.2rem,9.5vw,4rem); line-height: 1.1; letter-spacing: -.055em; }
.mobileMenu nav a span { font-size: 1.5rem; }
.menuBottom { margin-top: auto; }
.menuBottom p { font-size: .8rem; }
.menuBottom > span { display: block; padding-top: 1rem; font-size: 10.4vw; font-weight: 400; letter-spacing: -.06em; }

@keyframes loader-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes loader-exit { 0%,55% { clip-path: inset(0); } 100% { clip-path: inset(0 0 100%); visibility: hidden; } }
@keyframes line-enter { to { transform: translateY(0); } }
@keyframes fade-enter { to { opacity: 1; } }
@keyframes orb-enter { from { opacity: 0; scale: .85; } to { opacity: 1; scale: 1; } }
@keyframes detail-float { 0%,100% { transform: translateX(-50%) translateY(0) rotate(-3deg); } 50% { transform: translateX(-50%) translateY(-12px) rotate(3deg); } }
@keyframes product-open { from { opacity: 0; clip-path: inset(12% 18% round 12px); transform: translateY(3rem); } to { opacity: 1; clip-path: inset(0 round 0); transform: none; } }
@keyframes product-close { to { opacity: 0; transform: translateY(3rem); scale: .96; } }
@keyframes panel-enter { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes panel-exit { to { transform: translateX(100%); } }
@keyframes menu-enter { from { clip-path: inset(0 0 100%); } to { clip-path: inset(0); } }
@keyframes menu-exit { to { clip-path: inset(0 0 100%); } }
@keyframes marquee { to { transform: translateX(-50%); } }

@media (hover:hover) and (pointer:fine) and (min-width:761px) {
  .page[data-cursor-active="true"] .productCard { cursor: none; }
  .productCard:focus-visible .productObject { transform: none; }
  .productMeta strong, .productMeta > div > span > span { transform: translateY(105%); }
  .productStatus { opacity: 0; transform: translateY(1.5rem); transition: opacity 350ms ease,transform 650ms cubic-bezier(.22,1,.36,1); }
  .productCard:hover .productMeta strong, .productCard:hover .productMeta > div > span > span,
  .productCard:focus-visible .productMeta strong, .productCard:focus-visible .productMeta > div > span > span { transform: none; }
  .productCard:hover .productStatus, .productCard:focus-visible .productStatus { opacity: 1; transform: none; }
}
@media (max-width:1000px) and (min-width:761px) {
  .heroCopy h1 { font-size: 8.5vw; }
  .productMeta { inset: auto 1rem 1rem; }
  .productStatus > span { display: none; }
}
@media (max-width:760px) {
  .storeHeader { grid-template-columns: 1fr auto; height: 4.5rem; }
  .brand { font-size: 1.15rem; }
  .navigation { display: none; }
  .headerActions { gap: 1.6rem; }
  .release .cycleText { font-size: .85rem; }
  .menuButton { display: grid; align-content: center; gap: 3px; width: 1.15rem; height: 2.75rem; padding: 0; border: 0; background: transparent; }
  .menuButton span { width: 1.1rem; height: 1px; background: currentColor; }
  .sideLabel, .cursor { display: none; }
  .heroSticky { position: relative; height: auto; min-height: 0; overflow: visible; }
  .orbCanvas { position: fixed; width: 116vw; top: 45svh; }
  .orbTravel { transform: none; }
  .heroCopy { position: relative; align-items: start; padding: 6rem 1.5rem 2rem; text-align: left; }
  .heroCopy h1 { font-size: clamp(2.15rem,11.2vw,4.5rem); line-height: 1.06; letter-spacing: -.048em; }
  .desktopTitle { display: none; }
  .mobileTitle { display: block; animation: fade-enter 1s .4s both; }
  .heroCopy > a { display: none; }
  .productStream { grid-template-columns: 1fr; gap: .5rem; margin-top: 0; padding: 0 .5rem 5rem; scroll-margin-top: 5rem; }
  .productSlot:nth-child(n) { width: 100%; margin: 0; }
  .productFloat { transform: none; }
  .productCard { aspect-ratio: .96; }
  .productObject { inset: 1% 0 8%; transform: none; }
  .productMeta { inset: auto 1rem 1rem; }
  .productMeta strong, .productMeta > div > span > span { font-size: .8rem; }
  .productStatus { align-items: end; gap: .35rem; }
  .productStatus b { font-size: 1.8rem; }
  .productStatus > span { font-size: .48rem; }
  .mobileCardArrow { position: absolute; top: 1rem; right: 1rem; display: block; font-size: 1.2rem; }
  .footer { min-height: 0; padding: 3rem 1.5rem 1.5rem; }
  .footerEyebrow { font-size: .63rem; }
  .footer h2 { font-size: clamp(3.7rem,14.2vw,6rem); }
  .footerContent { grid-template-columns: 1fr 1fr; gap: 2.5rem 1rem; margin: 3rem 0 5rem; }
  .footerContent > p { grid-column: 1 / -1; grid-row: 1; max-width: 29ch; }
  .footerContent .pill { font-size: .8rem; padding: .7rem 1rem; }
  .footerContent nav { justify-self: end; font-size: .85rem; }
  .footerBottom { font-size: .65rem; gap: 1rem; }
  .productDialogHeader { height: 4.5rem; padding: 0 1rem; }
  .productDialogHeader .brand { font-size: 1rem; }
  .productDialogHeader .closeButton { font-size: .72rem; }
  .productHero { min-height: calc(100svh - 4.5rem); }
  .productBarcode { height: 4rem; left: 1rem; }
  .productCategory { right: 1rem; }
  .productMarquee { top: 30%; font-size: 27vw; }
  .detailObject { width: 100%; height: 67%; top: 9%; }
  .detailNumber { left: 1rem; bottom: 17%; }
  .detailNumber strong { font-size: 4.8rem; }
  .detailNumber > span { font-size: .58rem; }
  .productSticker { width: 5.4rem; height: 5.4rem; right: 1rem; bottom: 18%; font-size: .82rem; }
  .productExplore { bottom: 1.5rem; font-size: .85rem; }
  .productStory { grid-template-columns: 1fr; gap: 3rem; padding: 4rem 1.5rem; scroll-margin-top: 4.5rem; }
  .productStory h2 { font-size: 3.5rem; }
  .productStory > div:last-child > p { font-size: 1.2rem; }
  .releasePanel { width: 100%; padding: 1.5rem 1.5rem 3rem; }
  .releasePanel h2 { font-size: 4rem; }
}
@media (max-height:500px) and (min-width:761px) {
  .heroCopy h1 { font-size: 6vw; }
  .productHero { min-height: 35rem; }
}
.page[data-page-hidden="true"] *, .page[data-page-hidden="true"] *::before, .page[data-page-hidden="true"] *::after { animation-play-state: paused !important; }
@media (prefers-reduced-motion:reduce) {
  .page *, .page *::before, .page *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  .loader { display: none; }
  .orbCanvas, .heroCopy > a, .mobileTitle { opacity: 1; }
  .orbTravel, .desktopTitle > span > span, .productFloat, .productObject { transform: none; }
  .page[data-motion-ready="true"] .productSlot .productCard { opacity: 1; transform: none; cursor: pointer; }
  .page .productMeta strong, .page .productMeta > div > span > span, .page .productStatus { transform: none; opacity: 1; }
  .cursor { display: none; }
  .detailObject { transform: translateX(-50%); }
}
`````
<!-- END SOURCE: app/loja/loja.module.css -->

### app/loja/store-orb.tsx

<!-- BEGIN SOURCE: app/loja/store-orb.tsx -->
`````tsx
"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./store-orb.module.css";
import { glassVertexShader, glassFragmentShader } from "./store-glass-shader";

const WATER_OUTLINE =
  "M251 37C359 26 447 112 458 224C471 337 399 450 281 464C163 479 59 405 43 290C27 175 120 50 251 37Z";

/** An SSR-safe glass droplet. The SVG remains visible if WebGL is unavailable. */
export function StoreOrb() {
  const hostRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const host: HTMLDivElement = element;
    let disposed = false;
    let destroyScene: (() => void) | undefined;

    async function createDroplet() {
      const THREE = await import("three");
      if (disposed || !host) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: true });
      } catch {
        host.dataset.renderer = "fallback";
        return;
      }

      const canvas = renderer.domElement;
      canvas.className = styles.canvas;
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);
      const geometry = new THREE.SphereGeometry(1, 96, 64);
      const material = new THREE.ShaderMaterial({
        vertexShader: glassVertexShader,
        fragmentShader: glassFragmentShader,
        uniforms: {
          uTime: { value: 2.4 },
          uPointer: { value: new THREE.Vector2() },
          uImpulse: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      });

      try {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 761 ? 1.25 : 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
        camera.position.set(0, 0, 3.7);
        const droplet = new THREE.Mesh(geometry, material);
        scene.add(droplet);

        const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
        const showcase = host.closest("section");
        let reducedMotion = motionPreference.matches;
        let hostVisible = true;
        let sectionVisible = true;
        let modalOpen = Boolean(document.querySelector("dialog[open]"));
        let contextLost = false;
        let shaderFailed = false;
        let frame = 0;
        let previousTime = 0;
        let elapsed = 2.4;
        let pointerX = 0;
        let pointerY = 0;
        let smoothX = 0;
        let smoothY = 0;
        let impulse = 0;
        let impulseTarget = 0;
        let scrollPosition = scrollY;
        let smoothScroll = scrollY;
        let size = host.getBoundingClientRect();

        // Shader compile failures keep the SVG visible instead of a blank canvas.
        renderer.debug.onShaderError = () => {
          shaderFailed = true;
          host.dataset.ready = "false";
          host.dataset.renderer = "fallback";
        };

        const canRender = () => !disposed && !contextLost && !shaderFailed && hostVisible && sectionVisible && !document.hidden && !modalOpen;
        function draw(time: number) {
          frame = 0;
          if (!canRender()) return;
          const delta = previousTime ? Math.min((time - previousTime) / 1000, .05) : 1 / 60;
          previousTime = time;
          if (!reducedMotion) elapsed += delta;
          const follow = 1 - Math.exp(-delta * 5.5);
          smoothX += ((reducedMotion ? 0 : pointerX) - smoothX) * follow;
          smoothY += ((reducedMotion ? 0 : pointerY) - smoothY) * follow;
          smoothScroll += (scrollPosition - smoothScroll) * follow;
          impulseTarget *= Math.exp(-delta * 2.4);
          impulse += ((reducedMotion ? 0 : impulseTarget) - impulse) * (1 - Math.exp(-delta * 8));
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uPointer.value.set(smoothX, smoothY);
          material.uniforms.uImpulse.value = impulse;
          droplet.rotation.set(smoothY * .075, smoothX * .11 + (reducedMotion ? 0 : smoothScroll * .00009), -.06);
          droplet.position.set(smoothX * .025, reducedMotion ? 0 : Math.sin(elapsed * .38) * .018 - smoothY * .02, 0);
          try {
            renderer.render(scene, camera);
          } catch {
            shaderFailed = true;
          }
          if (shaderFailed) {
            host.dataset.ready = "false";
            host.dataset.renderer = "fallback";
            return;
          }
          host.dataset.ready = "true";
          host.dataset.renderer = "webgl";
          if (!reducedMotion) frame = requestAnimationFrame(draw);
        }
        function resume() {
          cancelAnimationFrame(frame);
          frame = 0;
          previousTime = 0;
          if (canRender()) frame = requestAnimationFrame(draw);
        }
        function resize() {
          size = host.getBoundingClientRect();
          if (!size.width || !size.height) return;
          renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 761 ? 1.25 : 1.5));
          renderer.setSize(size.width, size.height, false);
          camera.aspect = size.width / size.height;
          camera.updateProjectionMatrix();
          resume();
        }
        function onPointer(event: PointerEvent) {
          if (event.pointerType === "touch" || reducedMotion || !canRender()) return;
          // Measure at pointer input only; the canvas may have moved with scroll.
          size = host.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (event.clientX - size.left) / size.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, 1 - (event.clientY - size.top) / size.height * 2));
          impulseTarget = Math.min(1, impulseTarget + Math.hypot(x - pointerX, y - pointerY) * .65);
          pointerX = x;
          pointerY = y;
        }
        function onScroll() {
          const next = scrollY;
          if (!reducedMotion) impulseTarget = Math.min(.6, impulseTarget + Math.abs(next - scrollPosition) * .0005);
          scrollPosition = next;
        }
        function onPointerLeave() { pointerX = 0; pointerY = 0; }
        function onMotionChange() { reducedMotion = motionPreference.matches; impulseTarget = 0; resume(); }
        function onContextLost(event: Event) {
          event.preventDefault();
          contextLost = true;
          host.dataset.ready = "false";
          host.dataset.renderer = "fallback";
          resume();
        }
        function onContextRestored() { contextLost = false; resume(); }
        const resizeObserver = new ResizeObserver(resize);
        const intersectionObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.target === host) hostVisible = entry.isIntersecting;
            if (entry.target === showcase) sectionVisible = entry.isIntersecting;
          }
          resume();
        });
        const dialogObserver = new MutationObserver(() => {
          const next = Boolean(document.querySelector("dialog[open]"));
          if (next !== modalOpen) { modalOpen = next; resume(); }
        });
        resizeObserver.observe(host);
        intersectionObserver.observe(host);
        if (showcase) intersectionObserver.observe(showcase);
        dialogObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
        motionPreference.addEventListener("change", onMotionChange);
        document.addEventListener("visibilitychange", resume);
        document.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("pointermove", onPointer, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        canvas.addEventListener("webglcontextlost", onContextLost);
        canvas.addEventListener("webglcontextrestored", onContextRestored);
        destroyScene = () => {
          cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          dialogObserver.disconnect();
          motionPreference.removeEventListener("change", onMotionChange);
          document.removeEventListener("visibilitychange", resume);
          document.removeEventListener("pointerleave", onPointerLeave);
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("scroll", onScroll);
          canvas.removeEventListener("webglcontextlost", onContextLost);
          canvas.removeEventListener("webglcontextrestored", onContextRestored);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          canvas.remove();
          delete host.dataset.ready;
        };
        resize();
      } catch {
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
        host.dataset.renderer = "fallback";
        delete host.dataset.ready;
      }
    }

    void createDroplet().catch(() => { host.dataset.renderer = "fallback"; });
    return () => { disposed = true; destroyScene?.(); };
  }, []);

  return (
    <div ref={hostRef} className={styles.orb} aria-hidden="true">
      <svg className={styles.fallback} viewBox="0 0 500 500" role="presentation">
        <defs>
          <radialGradient id={`${id}-water`} cx="43%" cy="38%" r="62%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="0.63" stopColor="#e9f0f4" stopOpacity="0.1" />
            <stop offset="0.86" stopColor="#c0ccd5" stopOpacity="0.2" />
            <stop offset="0.96" stopColor="#7e94a4" stopOpacity="0.38" />
            <stop offset="1" stopColor="#eef3f5" stopOpacity="0.25" />
          </radialGradient>
          <linearGradient id={`${id}-edge`} x1="0.16" y1="0" x2="0.86" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="0.28" stopColor="#9fadb6" stopOpacity="0.58" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.86" />
            <stop offset="0.81" stopColor="#6f8b9e" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        <g className={styles.fallbackShape}>
          <path d={WATER_OUTLINE} fill={`url(#${id}-water)`} stroke={`url(#${id}-edge)`} strokeWidth="2.3" />
          <path d="M104 148C124 84 204 52 280 58C340 59 397 94 421 139" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" opacity="0.85" filter={`url(#${id}-blur)`} />
          <path d="M65 239C53 328 110 415 195 441C287 470 377 431 418 368" fill="none" stroke="#9aaab8" strokeWidth="5" opacity="0.32" filter={`url(#${id}-blur)`} />
          <path d="M81 195C68 290 90 345 133 379M397 146C434 219 438 294 409 341" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.83" />
          <path d="M121 365C171 424 249 438 304 416C343 401 370 388 386 354" fill="none" stroke="#d3e0e9" strokeWidth="6" opacity="0.42" filter={`url(#${id}-blur)`} />
        </g>
      </svg>
    </div>
  );
}
`````
<!-- END SOURCE: app/loja/store-orb.tsx -->

### app/loja/store-glass-shader.ts

<!-- BEGIN SOURCE: app/loja/store-glass-shader.ts -->
`````typescript
// The glass stays transparent to the DOM. Optical detail comes from a studio
// environment sampled with reflected/refracted rays, not from an opaque backdrop.
export const glassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uImpulse;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectPosition;

  vec3 deform(vec3 n) {
    float t = uTime;
    float swell = sin(n.x * 2.7 + t * .42) * cos(n.y * 2.4 - t * .31) * sin(n.z * 2.5 + t * .25);
    float tide = sin(n.y * 3.9 + n.z * 2.8 + t * .34) * cos(n.x * 3.4 - t * .27);
    float ripple = sin(n.x * 8. + n.y * 5. - t * .38) * cos(n.z * 7. + t * .32);
    vec3 touch = normalize(vec3(uPointer * .75, 1.));
    float proximity = exp(-7.5 * dot(n - touch, n - touch));
    float radius = 1. + swell * .043 + tide * .018 + ripple * .0035;
    radius += proximity * uImpulse * .035;
    vec3 p = n * radius;
    p.x += sin(t * .23) * n.y * .016;
    p.y *= 1.015 + sin(t * .32) * .012;
    return p;
  }

  void main() {
    vec3 n = normalize(position);
    vec3 tangent = normalize(cross(abs(n.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), n));
    vec3 bitangent = cross(n, tangent);
    float e = .004;
    vec3 dt = deform(normalize(n + tangent * e)) - deform(normalize(n - tangent * e));
    vec3 db = deform(normalize(n + bitangent * e)) - deform(normalize(n - bitangent * e));
    vec3 p = deform(n);
    vec4 world = modelMatrix * vec4(p, 1.);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normalize(cross(dt, db)));
    vObjectPosition = p;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const glassFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectPosition;

  // Tall softboxes and dark studio flags produce thin moving reflections.
  float softbox(vec3 ray, vec3 axis, vec3 up, vec2 size) {
    vec3 side = normalize(cross(axis, up));
    vec3 vertical = cross(side, axis);
    float facing = dot(ray, axis);
    vec2 uv = vec2(dot(ray, side), dot(ray, vertical)) / max(.1, facing);
    vec2 box = smoothstep(size, size * 1.4, abs(uv));
    return (1. - box.x) * (1. - box.y) * smoothstep(.0, .3, facing);
  }

  vec3 studio(vec3 ray) {
    vec3 color = mix(vec3(.68, .77, .82), vec3(.98, .99, 1.), smoothstep(-.6, .7, ray.y));
    float leftFlag = softbox(ray, normalize(vec3(-.85, .2, .55)), vec3(0., 1., 0.), vec2(.16, 1.1));
    float rightFlag = softbox(ray, normalize(vec3(.8, -.15, -.6)), vec3(0., 1., 0.), vec2(.1, .7));
    color = mix(color, vec3(.08, .16, .22), leftFlag * .88);
    color = mix(color, vec3(.24, .35, .42), rightFlag * .7);
    float key = softbox(ray, normalize(vec3(-.55, .75, .65)), vec3(0., 1., 0.), vec2(.12, .68));
    float strip = softbox(ray, normalize(vec3(.72, .18, .7)), vec3(0., 1., 0.), vec2(.035, .75));
    return color + vec3(key * .9 + strip * 1.2);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(dot(N, V), .0, 1.);
    float fresnel = .0204 + .9796 * pow(1. - facing, 5.);
    vec3 reflected = reflect(-V, N);

    // Approximate both interfaces of a water volume (IOR 1.333), not a flat film.
    vec3 entryRay = refract(-V, N, 1. / 1.333);
    float chord = max(.05, -2. * dot(N, entryRay));
    vec3 exitNormal = normalize(N + entryRay * chord);
    vec3 exitRay = refract(entryRay, -exitNormal, 1.333);
    if (dot(exitRay, exitRay) < .001) exitRay = reflected;
    vec3 transmission = studio(normalize(exitRay));
    vec3 reflection = studio(reflected);

    float rim = pow(1. - facing, 2.7);
    float lowerEdge = 1. - smoothstep(-.9, .25, vObjectPosition.y);
    float innerRim = exp(-pow((facing - .32) / .105, 2.));
    float thinRim = exp(-pow((facing - .11) / .048, 2.));
    float flowing = sin(facing * 34. + vObjectPosition.y * 3. + sin(uTime * .3 + vObjectPosition.x * 4.));
    float caustic = pow(max(0., flowing), 10.) * rim * .11;

    vec3 color = mix(vec3(.86, .93, .97), transmission, .42);
    color = mix(color, reflection, .3 + fresnel * .7);
    color -= vec3(.3, .22, .13) * innerRim * (.35 + lowerEdge * .65);
    color -= vec3(.22, .16, .1) * thinRim;
    color += caustic;
    // Small dispersion only at the rim; the water core remains colourless.
    color += vec3(.015, .006, -.008) * sin(reflected.y * 17.) * rim;
    float highlight = max(0., max(reflection.r, max(reflection.g, reflection.b)) - 1.);
    float flag = 1. - min(reflection.r, min(reflection.g, reflection.b));
    float alpha = .045 + rim * .56 + innerRim * .25 + thinRim * .2;
    alpha += max(0., flag) * .2;
    alpha += highlight * .35;
    gl_FragColor = vec4(max(color, vec3(0.)), clamp(alpha, .035, .9));
    #include <colorspace_fragment>
  }
`;
`````
<!-- END SOURCE: app/loja/store-glass-shader.ts -->

### app/loja/store-orb.module.css

<!-- BEGIN SOURCE: app/loja/store-orb.module.css -->
`````css
.orb {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  isolation: isolate;
}

.canvas,
.fallback {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  transition: opacity 800ms ease;
}

.canvas { opacity: 0; }
.fallback { overflow: visible; opacity: 1; }
.orb[data-ready="true"] .canvas { opacity: 1; }
.orb[data-ready="true"] .fallback { opacity: 0; }

.fallbackShape {
  transform-origin: 50% 50%;
  animation: float 12s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: rotate(-3deg) scale(0.98, 1.01); }
  50% { transform: rotate(3deg) scale(1.01, 0.98); }
}

@media (prefers-reduced-motion: reduce) {
  .fallbackShape { animation: none; }
  .canvas, .fallback { transition: none; }
}
`````
<!-- END SOURCE: app/loja/store-orb.module.css -->

### app/loja/store-product-visual.tsx

<!-- BEGIN SOURCE: app/loja/store-product-visual.tsx -->
`````tsx
"use client";

import { useId } from "react";
import styles from "./store-product-visual.module.css";

export type StoreProductKind = "wearable" | "notebook" | "object" | "edition" | "bag" | "ticket";

type StoreProductVisualProps = {
  kind: StoreProductKind;
  className?: string;
};

const starPath = "M544 0 420 393 607 307 456 424 703 465 421 475 504 665 375 513 190 870 308 497 128 586 267 471 0 422 302 417 232 203 350 376Z";
const sculpturePath = "M314 110C363 90 420 124 437 178C460 228 435 251 450 293C474 360 418 428 362 447C303 470 243 448 212 403C184 363 150 355 151 305C152 252 188 224 211 191C239 151 266 128 314 110Z";

/** Self-contained product studies. The parent controls position and motion. */
export function StoreProductVisual({ kind, className }: StoreProductVisualProps) {
  const reactId = useId();
  const id = `product-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      viewBox="0 0 600 600"
      className={[styles.visual, className].filter(Boolean).join(" ")}
      data-product-kind={kind}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <symbol id={`${id}-star`} viewBox="0 0 703 870"><path d={starPath} fill="currentColor" /></symbol>
        <linearGradient id={`${id}-navy`} x1="0" y1="0" x2="1" y2="0.8">
          <stop stopColor="#24425c" /><stop offset=".3" stopColor="#102b45" /><stop offset=".65" stopColor="#07182d" /><stop offset="1" stopColor="#142e45" />
        </linearGradient>
        <linearGradient id={`${id}-fabric`} x1="0" y1="0" x2="1" y2="0.25">
          <stop stopColor="#0b1e33" /><stop offset=".18" stopColor="#1d3b55" /><stop offset=".42" stopColor="#122d47" /><stop offset=".75" stopColor="#091b31" /><stop offset="1" stopColor="#18354c" />
        </linearGradient>
        <linearGradient id={`${id}-canvas`} x1="0" y1="0" x2="1" y2="0.6">
          <stop stopColor="#d4e2eb" /><stop offset=".17" stopColor="#bad0df" /><stop offset=".6" stopColor="#b1c9dc" /><stop offset=".91" stopColor="#89a8c1" /><stop offset="1" stopColor="#9bb8cf" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffefa" /><stop offset=".65" stopColor="#f4f1e8" /><stop offset="1" stopColor="#e8e4d9" />
        </linearGradient>
        <linearGradient id={`${id}-pages`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#b6b4ad" /><stop offset=".12" stopColor="#f7f5ec" /><stop offset=".88" stopColor="#dfddd5" /><stop offset="1" stopColor="#aaa9a4" />
        </linearGradient>
        <radialGradient id={`${id}-glass`} cx=".34" cy=".25" r=".83">
          <stop stopColor="#fff" stopOpacity=".91" /><stop offset=".28" stopColor="#d6e7f2" stopOpacity=".8" /><stop offset=".52" stopColor="#a7c8de" stopOpacity=".9" /><stop offset=".76" stopColor="#709eba" stopOpacity=".86" /><stop offset="1" stopColor="#315c80" stopOpacity=".96" />
        </radialGradient>
        <radialGradient id={`${id}-glass-core`} cx=".63" cy=".67" r=".56">
          <stop stopColor="#e9f7ff" stopOpacity=".9" /><stop offset=".35" stopColor="#bdd6e8" stopOpacity=".15" /><stop offset=".7" stopColor="#4e7c9d" stopOpacity=".28" /><stop offset="1" stopColor="#f4faff" stopOpacity=".65" />
        </radialGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2=".7">
          <stop stopColor="#6e879a" /><stop offset=".23" stopColor="#f6fbff" /><stop offset=".5" stopColor="#adc9df" /><stop offset=".7" stopColor="#6384a0" /><stop offset="1" stopColor="#d3e5ef" />
        </linearGradient>
        <pattern id={`${id}-weave`} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 .5H5M.5 0V5" stroke="#fff" strokeOpacity=".08" strokeWidth=".65" />
          <path d="M0 3H5M3 0V5" stroke="#07182d" strokeOpacity=".08" strokeWidth=".5" />
        </pattern>
        <pattern id={`${id}-page-lines`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 .5H3" stroke="#8d908e" strokeOpacity=".42" strokeWidth=".5" />
        </pattern>
        <filter id={`${id}-shadow`} x="-35%" y="-30%" width="180%" height="185%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="7" dy="20" stdDeviation="13" floodColor="#07182d" floodOpacity=".2" />
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#07182d" floodOpacity=".12" />
        </filter>
        <filter id={`${id}-soft-shadow`} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="10" /></filter>
        <clipPath id={`${id}-sculpture-clip`}><path d={sculpturePath} /></clipPath>
      </defs>

      {kind === "wearable" && (
        <g transform="rotate(-6 300 300)">
          <path d="M193 124 249 104Q273 145 308 144Q342 143 359 104L407 123 502 205 458 288 410 259 422 488Q306 508 185 487L194 257 148 287 100 206Z" fill={ref("fabric")} filter={ref("shadow")} />
          <path d="M193 124 249 104Q273 145 308 144Q342 143 359 104L407 123 502 205 458 288 410 259 422 488Q306 508 185 487L194 257 148 287 100 206Z" fill={ref("weave")} />
          <path d="M249 104Q300 88 359 104Q345 151 308 153Q269 152 249 104" fill="#071628" />
          <path d="M257 109Q303 99 351 109Q336 140 307 141Q279 139 257 109" fill="#040f1d" />
          <path d="M249 104Q271 150 308 151Q344 147 359 104" className={styles.fineLine} stroke="#486176" strokeWidth="4" opacity=".58" />
          <path d="M246 110Q271 157 308 158Q346 154 362 111M195 133Q212 186 194 257M403 135Q394 207 410 259M108 208 149 278M493 209 457 278M188 478Q307 497 420 479" className={styles.fineLine} stroke="#496177" opacity=".4" strokeWidth="1.2" />
          <path d="M195 151Q217 222 204 312L187 455Q217 321 232 282M402 164Q378 235 395 304L414 456Q387 320 367 284" fill="#020b17" opacity=".2" />
          <path d="M232 169Q220 252 229 365M390 270Q368 354 396 450M244 468Q300 480 370 471" className={styles.fineLine} stroke="#69869b" opacity=".12" strokeWidth="5" />
          <use href={`#${id}-star`} x="278" y="214" width="51" height="63" color="#e9e1cd" />
          <text x="304" y="316" fill="#e9e1cd" fontSize="30" textAnchor="middle" className={styles.display}>MakeItFly</text>
          <text x="304" y="337" fill="#abbfce" fontSize="7.2" textAnchor="middle" className={styles.micro}>BUILDING THE FUTURE</text>
          <path d="M369 467h29v22h-29Z" fill="#d8dfdd" />
          <text x="383.5" y="481" fill="#07182d" fontSize="6.6" textAnchor="middle" className={styles.label}>APOGEE</text>
        </g>
      )}

      {kind === "notebook" && (
        <g transform="rotate(-10 300 300)">
          <path d="M176 99 410 92Q427 94 427 111L428 473Q427 485 412 489L185 502Q171 502 171 486L168 117Q168 102 176 99" fill="#07182d" filter={ref("shadow")} />
          <path d="m182 109 231-9 2 377-231 14Z" fill={ref("pages")} />
          <path d="m181 470 234-9v15l-233 15Z" fill={ref("page-lines")} />
          <path d="m411 111 5-7 1 369-6 6Z" fill="#edece5" />
          <path d="M173 96 405 86Q419 86 420 102L420 461Q419 473 407 475L177 488Q166 488 164 476L162 113Q162 99 173 96Z" fill={ref("navy")} />
          <path d="M175 96 188 95 191 486 178 487Q166 487 165 474L163 114Q162 100 175 96Z" fill="#06182d" />
          <path d="m185 98 3 383" stroke="#71869a" strokeOpacity=".36" />
          <path d="m168 114 2 360" stroke="#aac0cf" strokeOpacity=".14" strokeWidth="2" />
          <path d="M192 101 406 92Q413 92 413 104L414 459Q414 467 406 469L194 481" fill="none" stroke="#829aaa" strokeOpacity=".2" />
          <use href={`#${id}-star`} x="218" y="130" width="25" height="31" color="#bfced4" />
          <text x="215" y="243" fill="#e8e5d9" fontSize="60" className={styles.display}>Make</text>
          <text x="215" y="300" fill="#e8e5d9" fontSize="60" className={styles.display}>it fly.</text>
          <path d="M216 344 385 338" stroke="#b9d3ee" strokeOpacity=".45" />
          <text x="216" y="369" fill="#b9cbd7" fontSize="8" className={styles.micro}>IDEIAS EM ÓRBITA</text>
          <text x="216" y="440" fill="#d5dbd9" fontSize="9" className={styles.label}>APOGEE</text>
          <text x="383" y="433" fill="#93a8b7" fontSize="6.5" textAnchor="end" className={styles.micro}>CADERNO · A5</text>
          <path d="m390 90 3 380" stroke="#010b18" strokeOpacity=".7" strokeWidth="6" />
          <path d="m393 92 3 375" stroke="#31516a" strokeOpacity=".6" strokeWidth="1" />
          <path d="m329 483 1 30 11-9 7 10-2-32" fill="#b8cee0" />
        </g>
      )}

      {kind === "object" && (
        <g>
          <ellipse cx="306" cy="481" rx="149" ry="19" fill="#183c5a" opacity=".2" filter={ref("soft-shadow")} />
          <ellipse cx="300" cy="285" rx="222" ry="67" transform="rotate(-23 300 285)" fill="none" stroke="#809bac" strokeWidth="1.7" opacity=".65" />
          <ellipse cx="300" cy="285" rx="206" ry="67" transform="rotate(48 300 285)" fill="none" stroke="#9db4c5" strokeWidth="1.1" opacity=".5" />
          <path d={sculpturePath} fill={ref("glass")} stroke="#d7e8f4" strokeOpacity=".7" strokeWidth="1.3" filter={ref("shadow")} />
          <g clipPath={ref("sculpture-clip")}>
            <path d="M156 198Q304 40 414 182Q448 255 367 290Q220 343 234 426Q120 354 156 198" fill={ref("glass-core")} />
            <ellipse cx="336" cy="336" rx="83" ry="135" transform="rotate(27 336 336)" fill={ref("glass-core")} opacity=".86" />
            <path d="M310 124Q388 98 423 184Q441 239 406 279" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="5" strokeLinecap="round" />
            <path d="M220 203Q263 142 304 136M176 298Q168 359 218 392" fill="none" stroke="#effaff" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
            <path d="M280 428Q343 453 401 403Q426 380 436 349" fill="none" stroke="#315d7c" strokeOpacity=".43" strokeWidth="9" strokeLinecap="round" />
            <path d="M254 278Q295 219 360 270Q401 305 355 361Q310 410 269 365Q240 333 254 278" fill="none" stroke="#e8f5ff" strokeOpacity=".35" strokeWidth="1.2" />
            <ellipse cx="290" cy="286" rx="131" ry="42" transform="rotate(-23 290 286)" fill="none" stroke="#3b6380" strokeOpacity=".18" strokeWidth="3" />
          </g>
          <path d="M96 334C103 373 208 366 321 323C430 280 512 225 504 191" fill="none" stroke={ref("foil")} strokeWidth="3" />
          <path d="M96 334C103 373 208 366 321 323C430 280 512 225 504 191" fill="none" stroke="#fff" strokeOpacity=".46" strokeWidth=".65" />
          <circle cx="123" cy="347" r="7" fill={ref("foil")} /><circle cx="450" cy="250" r="4.5" fill="#dcecf7" />
          <path d="M234 411Q297 460 365 453" fill="none" stroke="#fff" strokeOpacity=".67" strokeWidth="1.5" />
          <use href={`#${id}-star`} x="274" y="304" width="33" height="41" color="#fff" opacity=".55" />
        </g>
      )}

      {kind === "edition" && (
        <g>
          <g transform="rotate(-13 300 300)" filter={ref("shadow")}>
            <path d="M144 92h304v423H144Z" fill="#b4cede" />
            <path d="M164 112h264v383H164Z" fill="none" stroke="#1f4965" strokeOpacity=".25" />
            <circle cx="296" cy="301" r="104" fill="none" stroke="#235777" strokeWidth=".8" />
          </g>
          <g transform="rotate(7 300 300)" filter={ref("shadow")}>
            <path d="M155 74h301v424H155Z" fill={ref("paper")} />
            <path d="M155 74h301v424H155Z" fill="none" stroke="#fff" strokeOpacity=".8" />
            <text x="177" y="103" fill="#07182d" fontSize="8" className={styles.label}>MAKE IT FLY</text>
            <text x="433" y="102" fill="#07182d" fontSize="5.8" textAnchor="end" className={styles.micro}>APOGEE</text>
            <path d="M177 115h256" stroke="#183349" strokeOpacity=".3" strokeWidth=".6" />
            <text x="175" y="176" fill="#102b42" fontSize="47" className={styles.display}>Ganhar</text>
            <text x="175" y="220" fill="#102b42" fontSize="47" className={styles.display}>o mundo.</text>
            <circle cx="306" cy="328" r="78" fill="#bfd5e3" />
            <circle cx="306" cy="328" r="57" fill="none" stroke="#3f6a88" strokeWidth=".7" />
            <circle cx="306" cy="328" r="96" fill="none" stroke="#49748f" strokeWidth=".55" />
            <ellipse cx="306" cy="328" rx="124" ry="38" transform="rotate(-33 306 328)" fill="none" stroke="#284d68" strokeWidth=".85" />
            <path d="M192 328h228M306 227v204" stroke="#49748f" strokeOpacity=".45" strokeWidth=".5" strokeDasharray="2 4" />
            <use href={`#${id}-star`} x="275" y="290" width="60" height="74" color="#102b42" />
            <circle cx="398" cy="268" r="3.5" fill="#102b42" />
            <path d="M177 445h256" stroke="#183349" strokeOpacity=".3" strokeWidth=".6" />
            <text x="177" y="463" fill="#102b42" fontSize="6" className={styles.micro}>IDEIAS EM MOVIMENTO</text>
            <text x="433" y="477" fill="#71818a" fontSize="5.3" textAnchor="end" className={styles.micro}>ESTUDO DE TRAJETÓRIA</text>
          </g>
        </g>
      )}

      {kind === "bag" && (
        <g transform="rotate(-5 300 300)">
          <path d="M233 258 235 162Q239 91 300 91Q364 91 365 162L366 258" fill="none" stroke="#7e9db5" strokeWidth="22" />
          <path d="M236 259 238 162Q241 96 300 96Q358 96 360 162L361 257" fill="none" stroke="#bfd1df" strokeWidth="13" />
          <path d="M210 263 213 164Q216 87 280 86Q344 86 345 164L346 264" fill="none" stroke="#8dacc3" strokeWidth="21" />
          <path d="M211 263 215 164Q220 92 280 92Q338 92 339 164L340 264" fill="none" stroke="#c8d9e4" strokeWidth="12" />
          <path d="M157 228Q300 240 440 226L458 467Q459 502 420 511L190 512Q151 507 151 477Z" fill={ref("canvas")} filter={ref("shadow")} />
          <path d="M157 228Q300 240 440 226L458 467Q459 502 420 511L190 512Q151 507 151 477Z" fill={ref("weave")} />
          <path d="M159 230Q178 354 167 476L190 504Q163 399 193 260M439 230Q416 322 435 476L419 504Q443 371 407 258" fill="#345a78" opacity=".15" />
          <path d="M170 239Q298 251 428 238M173 248Q300 260 428 247M170 471Q287 489 438 471M172 478Q287 496 436 478" fill="none" stroke="#60849f" strokeWidth="1.1" strokeDasharray="3 3" opacity=".64" />
          <path d="M205 236v56h22v-55M330 236v57h22v-57" fill="#a4bed0" />
          <path d="M209 242v42h14v-42M334 242v43h14v-43M209 244l14 36M223 244l-14 36M334 244l14 36M348 244l-14 36" fill="none" stroke="#7394ad" strokeWidth="1" strokeDasharray="2 2" />
          <use href={`#${id}-star`} x="275" y="301" width="51" height="63" color="#122e44" />
          <text x="300" y="413" fill="#17364e" fontSize="37" textAnchor="middle" className={styles.display}>MakeItFly</text>
          <text x="300" y="435" fill="#34586f" fontSize="7.4" textAnchor="middle" className={styles.micro}>LEVE SUAS IDEIAS</text>
          <path d="M443 396h15v40h-13Z" fill="#17364e" />
          <text x="450" y="402" fill="#e1e8e9" fontSize="5.5" transform="rotate(90 450 402)" className={styles.label}>APOGEE</text>
        </g>
      )}

      {kind === "ticket" && (
        <g>
          <g transform="rotate(-10 300 300)">
            <path d="M77 173H523V275Q506 288 523 301V420H77V302Q94 289 77 276Z" fill="#779bb5" filter={ref("shadow")} />
            <path d="M93 188H507V404H93Z" fill="none" stroke="#d5e2eb" strokeOpacity=".5" />
          </g>
          <g transform="rotate(7 300 300)">
            <path d="M67 168H534V272Q516 286 534 300V418H67V300Q85 286 67 272Z" fill={ref("paper")} filter={ref("shadow")} />
            <path d="M67 168H411V418H67V300Q85 286 67 272Z" fill="#d2e0e9" />
            <path d="M67 168H411V221H67Z" fill="#102b42" />
            <text x="90" y="201" fill="#e9e6da" fontSize="12" className={styles.label}>APOGEE · MAKE IT FLY</text>
            <text x="90" y="273" fill="#102b42" fontSize="37" className={styles.display}>Boas ideias.</text>
            <text x="90" y="310" fill="#102b42" fontSize="37" className={styles.display}>Novos voos.</text>
            <path d="M91 340h294" stroke="#173b55" strokeOpacity=".3" strokeWidth=".8" />
            <text x="91" y="365" fill="#244b66" fontSize="7.7" className={styles.micro}>EDIÇÃO DE ENCONTRO</text>
            <text x="91" y="392" fill="#244b66" fontSize="6.5" className={styles.micro}>FEITO PARA ESTAR JUNTO.</text>
            <path d="M411 170v246" stroke="#637d8e" strokeWidth="1" strokeDasharray="3 5" />
            <use href={`#${id}-star`} x="449" y="196" width="43" height="54" color="#102b42" />
            <text x="472" y="276" fill="#102b42" fontSize="7.8" textAnchor="middle" className={styles.micro}>MAKE IT FLY</text>
            <text x="472" y="293" fill="#102b42" fontSize="6.3" textAnchor="middle" className={styles.micro}>COMUNIDADE</text>
            {[0, 5, 9, 17, 21, 28, 33, 41, 46, 51, 60, 64, 71].map((x, index) => (
              <rect key={x} x={434 + x} y="329" width={index % 3 === 0 ? 3 : 1.3} height={index % 4 === 0 ? 41 : 36} fill="#19384e" />
            ))}
            <text x="471" y="392" fill="#466070" fontSize="5.2" textAnchor="middle" className={styles.micro}>OBJETO DE COLEÇÃO</text>
            <path d="M69 170h463" stroke="#fff" strokeOpacity=".7" />
          </g>
        </g>
      )}
    </svg>
  );
}
`````
<!-- END SOURCE: app/loja/store-product-visual.tsx -->

### app/loja/store-product-visual.module.css

<!-- BEGIN SOURCE: app/loja/store-product-visual.module.css -->
`````css
.visual {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  user-select: none;
  isolation: isolate;
}

.visual text {
  font-family: var(--font-inter), sans-serif;
  text-rendering: geometricPrecision;
}

.display {
  font-weight: 650;
  letter-spacing: -0.065em;
}

.label {
  font-weight: 600;
  letter-spacing: -0.035em;
}

.visual .micro {
  font-family: var(--font-dm-mono), monospace;
  font-weight: 400;
  letter-spacing: 0.12em;
}

.fineLine {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`````
<!-- END SOURCE: app/loja/store-product-visual.module.css -->

## Documentação local do Next.js

Os quatro guias abaixo foram copiados da instalação local do Next.js, sem alterações no conteúdo. São referências da versão instalada; nenhum teste de execução é implícito nesta inclusão.

### node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md

<!-- BEGIN SOURCE: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md -->
`````markdown
---
title: use client
description: Learn how to use the use client directive to render a component on the client.
---

The `'use client'` directive declares an entry point for the components to be rendered on the **client side** and should be used when creating interactive user interfaces (UI) that require client-side JavaScript capabilities, such as state management, event handling, and access to browser APIs. This is a React feature.

> **Good to know:**
>
> You do not need to add the `'use client'` directive to every file that contains Client Components. You only need to add it to the files whose components you want to render directly within Server Components. The `'use client'` directive defines the [server and client boundary](/docs/app/guides/server-and-client-boundary), and the components exported from such a file serve as entry points to the client.

## Usage

To declare an entry point for the Client Components, add the `'use client'` directive **at the top of the file**, before any imports:

```tsx filename="app/components/counter.tsx" highlight={1} switcher
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}
```

```jsx filename="app/components/counter.js" highlight={1} switcher
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}
```

When using the `'use client'` directive, the props of the Client Components must be [serializable](https://react.dev/reference/rsc/use-client#serializable-types). This means the props need to be in a format that React can serialize when sending data from the server to the client.

```tsx filename="app/components/counter.tsx" highlight={4} switcher
'use client'

export default function Counter({
  onClick /* ❌ Function is not serializable */,
}) {
  return (
    <div>
      <button onClick={onClick}>Increment</button>
    </div>
  )
}
```

```jsx filename="app/components/counter.js" highlight={4} switcher
'use client'

export default function Counter({
  onClick /* ❌ Function is not serializable */,
}) {
  return (
    <div>
      <button onClick={onClick}>Increment</button>
    </div>
  )
}
```

## Nesting Client Components within Server Components

Combining Server and Client Components allows you to build applications that are both performant and interactive:

1. **Server Components**: Use for static content, data fetching, and SEO-friendly elements.
2. **Client Components**: Use for interactive elements that require state, effects, or browser APIs.
3. **Component composition**: Nest Client Components within Server Components as needed for a clear separation of server and client logic.

In the following example:

- `Header` is a Server Component handling static content.
- `Counter` is a Client Component enabling interactivity within the page.

```tsx filename="app/page.tsx" highlight={2,8} switcher
import Header from './header'
import Counter from './counter' // This is a Client Component

export default function Page() {
  return (
    <div>
      <Header />
      <Counter />
    </div>
  )
}
```

```jsx filename="app/page.js" highlight={2,8} switcher
import Header from './header'
import Counter from './counter' // This is a Client Component

export default function Page() {
  return (
    <div>
      <Header />
      <Counter />
    </div>
  )
}
```

## Reference

See the [React documentation](https://react.dev/reference/rsc/use-client) for more information on `'use client'`.
`````
<!-- END SOURCE: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md -->

### node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md

<!-- BEGIN SOURCE: node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md -->
`````markdown
---
title: How to lazy load Client Components and libraries
nav_title: Lazy Loading
description: Lazy load imported libraries and React Components to improve your application's loading performance.
---

{/* The content of this doc is shared between the app and pages router. You can use the `<PagesOnly>Content</PagesOnly>` component to add content that is specific to the Pages Router. Any shared content should not be wrapped in a component. */}

[Lazy loading](https://developer.mozilla.org/docs/Web/Performance/Lazy_loading) in Next.js helps improve the initial loading performance of an application by decreasing the amount of JavaScript needed to render a route.

<AppOnly>

It allows you to defer loading of **Client Components** and imported libraries, and only include them in the client bundle when they're needed. For example, you might want to defer loading a modal until a user clicks to open it.

There are two ways you can implement lazy loading in Next.js:

1. Using [Dynamic Imports](#nextdynamic) with `next/dynamic`
2. Using [`React.lazy()`](https://react.dev/reference/react/lazy) with [Suspense](https://react.dev/reference/react/Suspense)

By default, Server Components are automatically [code split](https://developer.mozilla.org/docs/Glossary/Code_splitting), and you can use [streaming](/docs/app/guides/streaming) to progressively send pieces of UI from the server to the client. Lazy loading applies to Client Components.

## `next/dynamic`

`next/dynamic` is a composite of [`React.lazy()`](https://react.dev/reference/react/lazy) and [Suspense](https://react.dev/reference/react/Suspense). It behaves the same way in the `app` and `pages` directories to allow for incremental migration.

## Examples

### Importing Client Components

```jsx filename="app/page.js"
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

// Client Components:
const ComponentA = dynamic(() => import('../components/A'))
const ComponentB = dynamic(() => import('../components/B'))
const ComponentC = dynamic(() => import('../components/C'), { ssr: false })

export default function ClientComponentExample() {
  const [showMore, setShowMore] = useState(false)

  return (
    <div>
      {/* Load immediately, but in a separate client bundle */}
      <ComponentA />

      {/* Load on demand, only when/if the condition is met */}
      {showMore && <ComponentB />}
      <button onClick={() => setShowMore(!showMore)}>Toggle</button>

      {/* Load only on the client side */}
      <ComponentC />
    </div>
  )
}
```

> **Note:** When a Server Component dynamically imports a Client Component, automatic [code splitting](https://developer.mozilla.org/docs/Glossary/Code_splitting) is currently **not** supported.

### Skipping SSR

When using `React.lazy()` and Suspense, Client Components will be [prerendered](https://github.com/reactwg/server-components/discussions/4) (SSR) by default.

> **Note:** `ssr: false` option will only work for Client Components, move it into Client Components ensure the client code-splitting working properly.

If you want to disable prerendering for a Client Component, you can use the `ssr` option set to `false`:

```jsx
const ComponentC = dynamic(() => import('../components/C'), { ssr: false })
```

### Importing Server Components

If you dynamically import a Server Component, only the Client Components that are children of the Server Component will be lazy-loaded - not the Server Component itself.
It will also help preload the static assets such as CSS when you're using it in Server Components.

```jsx filename="app/page.js"
import dynamic from 'next/dynamic'

// Server Component:
const ServerComponent = dynamic(() => import('../components/ServerComponent'))

export default function ServerComponentExample() {
  return (
    <div>
      <ServerComponent />
    </div>
  )
}
```

> **Note:** `ssr: false` option is not supported in Server Components. You will see an error if you try to use it in Server Components.
> `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component.

### Loading External Libraries

External libraries can be loaded on demand using the [`import()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/import) function. This example uses the external library `fuse.js` for fuzzy search. The module is only loaded on the client after the user types in the search input.

```jsx filename="app/page.js"
'use client'

import { useState } from 'react'

const names = ['Tim', 'Joe', 'Bel', 'Lee']

export default function Page() {
  const [results, setResults] = useState()

  return (
    <div>
      <input
        type="text"
        placeholder="Search"
        onChange={async (e) => {
          const { value } = e.currentTarget
          // Dynamically load fuse.js
          const Fuse = (await import('fuse.js')).default
          const fuse = new Fuse(names)

          setResults(fuse.search(value))
        }}
      />
      <pre>Results: {JSON.stringify(results, null, 2)}</pre>
    </div>
  )
}
```

### Adding a custom loading component

```jsx filename="app/page.js"
'use client'

import dynamic from 'next/dynamic'

const WithCustomLoading = dynamic(
  () => import('../components/WithCustomLoading'),
  {
    loading: () => <p>Loading...</p>,
  }
)

export default function Page() {
  return (
    <div>
      {/* The loading component will be rendered while  <WithCustomLoading/> is loading */}
      <WithCustomLoading />
    </div>
  )
}
```

### Importing Named Exports

To dynamically import a named export, you can return it from the Promise returned by [`import()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/import) function:

```jsx filename="components/hello.js"
'use client'

export function Hello() {
  return <p>Hello!</p>
}
```

```jsx filename="app/page.js"
import dynamic from 'next/dynamic'

const ClientComponent = dynamic(() =>
  import('../components/hello').then((mod) => mod.Hello)
)
```

## Magic Comments

Next.js supports magic comments to control how dynamic imports are handled by the bundler. These comments work with dynamic `import()`, `require()`, `require.resolve()`, and `new Worker()` expressions.

> **Good to know:** Magic comments do not work with static `import` statements (`import x from 'y'`). They only work with dynamic expressions.

### `webpackIgnore` / `turbopackIgnore`

Use these comments to skip bundling a dynamic import. The import expression will be left as-is in the output, useful for runtime-only modules:

```js
// Skip bundling - import happens at runtime
const runtime = await import(/* webpackIgnore: true */ 'runtime-module')

// Turbopack-specific variant
const plugin = await import(/* turbopackIgnore: true */ pluginPath)

// Also works with require
const mod = require(/* webpackIgnore: true */ 'runtime-module')
```

### `turbopackOptional` (Turbopack only)

Use this comment to suppress build errors when a module might not exist. The import will still throw at runtime if the module is missing:

```js
// No build error if './optional-feature' doesn't exist
// Runtime will throw MODULE_NOT_FOUND if executed
const feature = await import(/* turbopackOptional: true */ './optional-feature')

// Also works with require
const mod = require(/* turbopackOptional: true */ './optional-module')
```

This is useful for:

- Conditional features that may not be installed
- Plugin systems where modules are optional
- Gradual migrations where some files may not exist yet

> **Good to know:** `webpackOptional` is not supported. Use `turbopackOptional` instead when using Turbopack.

</AppOnly>

<PagesOnly>

## `next/dynamic`

`next/dynamic` is a composite of [`React.lazy()`](https://react.dev/reference/react/lazy) and [Suspense](https://react.dev/reference/react/Suspense). It behaves the same way in the `app` and `pages` directories to allow for incremental migration.

In the example below, by using `next/dynamic`, the header component will not be included in the page's initial JavaScript bundle. The page will render the Suspense `fallback` first, followed by the `Header` component when the `Suspense` boundary is resolved.

```jsx
import dynamic from 'next/dynamic'

const DynamicHeader = dynamic(() => import('../components/header'), {
  loading: () => <p>Loading...</p>,
})

export default function Home() {
  return <DynamicHeader />
}
```

> **Good to know**: In `import('path/to/component')`, the path must be explicitly written. It can't be a template string nor a variable. Furthermore the `import()` has to be inside the `dynamic()` call for Next.js to be able to match webpack bundles / module ids to the specific `dynamic()` call and preload them before rendering. `dynamic()` can't be used inside of React rendering as it needs to be marked in the top level of the module for preloading to work, similar to `React.lazy`.

## Examples

### With named exports

To dynamically import a named export, you can return it from the [Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) returned by [`import()`](https://github.com/tc39/proposal-dynamic-import#example):

```jsx filename="components/hello.js"
export function Hello() {
  return <p>Hello!</p>
}

// pages/index.js
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() =>
  import('../components/hello').then((mod) => mod.Hello)
)
```

### With no SSR

To dynamically load a component on the client side, you can use the `ssr` option to disable server-rendering. This is useful if an external dependency or component relies on browser APIs like `window`.

```jsx
'use client'

import dynamic from 'next/dynamic'

const DynamicHeader = dynamic(() => import('../components/header'), {
  ssr: false,
})
```

### With external libraries

This example uses the external library `fuse.js` for fuzzy search. The module is only loaded in the browser after the user types in the search input.

```jsx
import { useState } from 'react'

const names = ['Tim', 'Joe', 'Bel', 'Lee']

export default function Page() {
  const [results, setResults] = useState()

  return (
    <div>
      <input
        type="text"
        placeholder="Search"
        onChange={async (e) => {
          const { value } = e.currentTarget
          // Dynamically load fuse.js
          const Fuse = (await import('fuse.js')).default
          const fuse = new Fuse(names)

          setResults(fuse.search(value))
        }}
      />
      <pre>Results: {JSON.stringify(results, null, 2)}</pre>
    </div>
  )
}
```

</PagesOnly>
`````
<!-- END SOURCE: node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md -->

### node_modules/next/dist/docs/01-app/01-getting-started/11-css.md

<!-- BEGIN SOURCE: node_modules/next/dist/docs/01-app/01-getting-started/11-css.md -->
`````markdown
---
title: CSS
description: Learn about the different ways to add CSS to your application, including Tailwind CSS, CSS Modules, Global CSS, and more.
related:
  title: Next Steps
  description: Learn more about the alternatives ways you can use CSS in your application.
  links:
    - app/guides/tailwind-v3-css
    - app/guides/sass
    - app/guides/css-in-js
---

Next.js provides several ways to style your application using CSS, including:

- [Tailwind CSS](#tailwind-css)
- [CSS Modules](#css-modules)
- [Global CSS](#global-css)
- [External Stylesheets](#external-stylesheets)
- [Sass](/docs/app/guides/sass)
- [CSS-in-JS](/docs/app/guides/css-in-js)

## Tailwind CSS

[Tailwind CSS](https://tailwindcss.com/) is a utility-first CSS framework that provides low-level utility classes to build custom designs.

<AppOnly>

Install Tailwind CSS:

```bash package="pnpm"
pnpm add -D tailwindcss @tailwindcss/postcss
```

```bash package="npm"
npm install -D tailwindcss @tailwindcss/postcss
```

```bash package="yarn"
yarn add -D tailwindcss @tailwindcss/postcss
```

```bash package="bun"
bun add -D tailwindcss @tailwindcss/postcss
```

Add the PostCSS plugin to your `postcss.config.mjs` file:

```js filename="postcss.config.mjs"
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

Import Tailwind in your global CSS file:

```css filename="app/globals.css"
@import 'tailwindcss';
```

Import the CSS file in your root layout:

```tsx filename="app/layout.tsx" switcher
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Now you can start using Tailwind's utility classes in your application:

```tsx filename="app/page.tsx" switcher
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
    </main>
  )
}
```

```jsx filename="app/page.js" switcher
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
    </main>
  )
}
```

</AppOnly>

<PagesOnly>

Install Tailwind CSS:

```bash package="pnpm"
pnpm add -D tailwindcss @tailwindcss/postcss
```

```bash package="npm"
npm install -D tailwindcss @tailwindcss/postcss
```

```bash package="yarn"
yarn add -D tailwindcss @tailwindcss/postcss
```

```bash package="bun"
bun add -D tailwindcss @tailwindcss/postcss
```

Add the PostCSS plugin to your `postcss.config.mjs` file:

```js filename="postcss.config.mjs"
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

Import Tailwind in your global CSS file:

```css filename="styles/globals.css"
@import 'tailwindcss';
```

Import the CSS file in your `pages/_app.js` file:

```jsx filename="pages/_app.js"
import '@/styles/globals.css'

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

Now you can start using Tailwind's utility classes in your application:

```tsx filename="pages/index.tsx" switcher
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
    </main>
  )
}
```

```jsx filename="pages/index.js" switcher
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
    </main>
  )
}
```

</PagesOnly>

> **Good to know:** If you need broader browser support for very old browsers, see the [Tailwind CSS v3 setup instructions](/docs/app/guides/tailwind-v3-css).

## CSS Modules

CSS Modules locally scope CSS by generating unique class names. This allows you to use the same class in different files without worrying about naming collisions.

<AppOnly>

To start using CSS Modules, create a new file with the extension `.module.css` and import it into any component inside the `app` directory:

```css filename="app/blog/blog.module.css"
.blog {
  padding: 24px;
}
```

```tsx filename="app/blog/page.tsx" switcher
import styles from './blog.module.css'

export default function Page() {
  return <main className={styles.blog}></main>
}
```

```jsx filename="app/blog/page.js" switcher
import styles from './blog.module.css'

export default function Page() {
  return <main className={styles.blog}></main>
}
```

</AppOnly>

<PagesOnly>

To start using CSS Modules, create a new file with the extension `.module.css` and import it into any component inside the `pages` directory:

```css filename="styles/blog.module.css"
.blog {
  padding: 24px;
}
```

```tsx filename="pages/blog/index.tsx" switcher
import styles from '@/styles/blog.module.css'

export default function Page() {
  return <main className={styles.blog}></main>
}
```

```jsx filename="pages/blog/index.js" switcher
import styles from '@/styles/blog.module.css'

export default function Page() {
  return <main className={styles.blog}></main>
}
```

</PagesOnly>

## Global CSS

You can use global CSS to apply styles across your application.

<AppOnly>

Create a `app/global.css` file and import it in the root layout to apply the styles to **every route** in your application:

```css filename="app/global.css"
body {
  padding: 20px 20px 60px;
  max-width: 680px;
  margin: 0 auto;
}
```

```tsx filename="app/layout.tsx" switcher
// These styles apply to every route in the application
import './global.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
// These styles apply to every route in the application
import './global.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

> **Good to know:** Global styles can be imported into any layout, page, or component inside the `app` directory. However, since Next.js uses React's built-in support for stylesheets to integrate with Suspense, this currently does not remove stylesheets as you navigate between routes which can lead to conflicts. We recommend using global styles for _truly_ global CSS (like Tailwind's base styles), [Tailwind CSS](#tailwind-css) for component styling, and [CSS Modules](#css-modules) for custom scoped CSS when needed.

</AppOnly>

<PagesOnly>

Import the stylesheet in the `pages/_app.js` file to apply the styles to **every route** in your application:

```jsx filename="pages/_app.js"
import '@/styles/global.css'

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

Due to the global nature of stylesheets, and to avoid conflicts, you should import them inside [`pages/_app.js`](/docs/pages/building-your-application/routing/custom-app).

</PagesOnly>

## External stylesheets

<AppOnly>

Stylesheets published by external packages can be imported anywhere in the `app` directory, including colocated components:

```tsx filename="app/layout.tsx" switcher
import 'bootstrap/dist/css/bootstrap.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="container">{children}</body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
import 'bootstrap/dist/css/bootstrap.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="container">{children}</body>
    </html>
  )
}
```

> **Good to know:** In React 19, `<link rel="stylesheet" href="..." />` can also be used. See the [React `link` documentation](https://react.dev/reference/react-dom/components/link) for more information.

</AppOnly>

<PagesOnly>

Next.js allows you to import CSS files from a JavaScript file. This is possible because Next.js extends the concept of [`import`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/import) beyond JavaScript.

### Import styles from `node_modules`

Since Next.js **9.5.4**, importing a CSS file from `node_modules` is permitted anywhere in your application.

For global stylesheets, like `bootstrap` or `nprogress`, you should import the file inside `pages/_app.js`. For example:

```jsx filename="pages/_app.js"
import 'bootstrap/dist/css/bootstrap.css'

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

To import CSS required by a third-party component, you can do so in your component. For example:

```jsx filename="components/example-dialog.js"
import { useState } from 'react'
import { Dialog } from '@reach/dialog'
import VisuallyHidden from '@reach/visually-hidden'
import '@reach/dialog/styles.css'

function ExampleDialog(props) {
  const [showDialog, setShowDialog] = useState(false)
  const open = () => setShowDialog(true)
  const close = () => setShowDialog(false)

  return (
    <div>
      <button onClick={open}>Open Dialog</button>
      <Dialog isOpen={showDialog} onDismiss={close}>
        <button className="close-button" onClick={close}>
          <VisuallyHidden>Close</VisuallyHidden>
          <span aria-hidden>×</span>
        </button>
        <p>Hello there. I am a dialog</p>
      </Dialog>
    </div>
  )
}
```

</PagesOnly>

## Ordering and Merging

Next.js optimizes CSS during production builds by automatically chunking (merging) stylesheets. The **order of your CSS** depends on the **order you import styles in your code**.

For example, `base-button.module.css` will be ordered before `page.module.css` since `<BaseButton>` is imported before `page.module.css`:

```tsx filename="page.tsx" switcher
import { BaseButton } from './base-button'
import styles from './page.module.css'

export default function Page() {
  return <BaseButton className={styles.primary} />
}
```

```jsx filename="page.js" switcher
import { BaseButton } from './base-button'
import styles from './page.module.css'

export default function Page() {
  return <BaseButton className={styles.primary} />
}
```

```tsx filename="base-button.tsx" switcher
import styles from './base-button.module.css'

export function BaseButton() {
  return <button className={styles.primary} />
}
```

```jsx filename="base-button.js" switcher
import styles from './base-button.module.css'

export function BaseButton() {
  return <button className={styles.primary} />
}
```

### Recommendations

To keep CSS ordering predictable:

- Try to contain CSS imports to a single JavaScript or TypeScript entry file
- Import global styles and Tailwind stylesheets in the root of your application.
- **Use Tailwind CSS** for most styling needs as it covers common design patterns with utility classes.
- Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient.
- Use a consistent naming convention for your CSS modules. For example, using `<name>.module.css` over `<name>.tsx`.
- Extract shared styles into shared components to avoid duplicate imports.
- Turn off linters or formatters that auto-sort imports like ESLint’s [`sort-imports`](https://eslint.org/docs/latest/rules/sort-imports).
- You can use the [`cssChunking`](/docs/app/api-reference/config/next-config-js/cssChunking) option in `next.config.js` to control how CSS is chunked.

## Development vs Production

- In development (`next dev`), CSS updates apply instantly with [Fast Refresh](/docs/architecture/fast-refresh).
- In production (`next build`), all CSS files are automatically concatenated into **many minified and code-split** `.css` files, ensuring the minimal amount of CSS is loaded for a route.
- CSS still loads with JavaScript disabled in production, but JavaScript is required in development for Fast Refresh.
- CSS ordering can behave differently in development, always ensure to check the build (`next build`) to verify the final CSS order.
`````
<!-- END SOURCE: node_modules/next/dist/docs/01-app/01-getting-started/11-css.md -->

### node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md

<!-- BEGIN SOURCE: node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md -->
`````markdown
---
title: Link Component
description: Enable fast client-side navigation with the built-in `next/link` component.
---

{/* The content of this doc is shared between the app and pages router. You can use the `<PagesOnly>Content</PagesOnly>` component to add content that is specific to the Pages Router. Any shared content should not be wrapped in a component. */}

`<Link>` is a React component that extends the HTML `<a>` element to provide [prefetching](/docs/app/getting-started/linking-and-navigating#prefetching) and client-side navigation between routes. It is the primary way to navigate between routes in Next.js.

Basic usage:

<AppOnly>

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return <Link href="/dashboard">Dashboard</Link>
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return <Link href="/dashboard">Dashboard</Link>
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return <Link href="/dashboard">Dashboard</Link>
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return <Link href="/dashboard">Dashboard</Link>
}
```

</PagesOnly>

## Reference

The following props can be passed to the `<Link>` component:

<PagesOnly>

| Prop                        | Example                  | Type              | Required |
| --------------------------- | ------------------------ | ----------------- | -------- |
| [`href`](#href-required)    | `href="/dashboard"`      | String or Object  | Yes      |
| [`as`](#as)                 | `as="/post/abc"`         | String or Object  | -        |
| [`replace`](#replace)       | `replace={false}`        | Boolean           | -        |
| [`scroll`](#scroll)         | `scroll={false}`         | Boolean           | -        |
| [`prefetch`](#prefetch)     | `prefetch={false}`       | Boolean           | -        |
| [`shallow`](#shallow)       | `shallow={false}`        | Boolean           | -        |
| [`locale`](#locale)         | `locale="fr"`            | String or Boolean | -        |
| [`onNavigate`](#onnavigate) | `onNavigate={(e) => {}}` | Function          | -        |

</PagesOnly>

<AppOnly>

| Prop                                  | Example                          | Type                       | Required |
| ------------------------------------- | -------------------------------- | -------------------------- | -------- |
| [`href`](#href-required)              | `href="/dashboard"`              | String or Object           | Yes      |
| [`replace`](#replace)                 | `replace={false}`                | Boolean                    | -        |
| [`scroll`](#scroll)                   | `scroll={false}`                 | Boolean                    | -        |
| [`prefetch`](#prefetch)               | `prefetch={false}`               | Boolean, `"auto"`, or null | -        |
| [`onNavigate`](#onnavigate)           | `onNavigate={(e) => {}}`         | Function                   | -        |
| [`transitionTypes`](#transitiontypes) | `transitionTypes={['slide-in']}` | `string[]`                 | -        |

</AppOnly>

> **Good to know**: `<a>` tag attributes such as `className` or `target="_blank"` can be added to `<Link>` as props and will be passed to the underlying `<a>` element.

### `href` (required)

The path or URL to navigate to.

<AppOnly>

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

// Navigate to /about?name=test
export default function Page() {
  return (
    <Link
      href={{
        pathname: '/about',
        query: { name: 'test' },
      }}
    >
      About
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

// Navigate to /about?name=test
export default function Page() {
  return (
    <Link
      href={{
        pathname: '/about',
        query: { name: 'test' },
      }}
    >
      About
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

// Navigate to /about?name=test
export default function Home() {
  return (
    <Link
      href={{
        pathname: '/about',
        query: { name: 'test' },
      }}
    >
      About
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

// Navigate to /about?name=test
export default function Home() {
  return (
    <Link
      href={{
        pathname: '/about',
        query: { name: 'test' },
      }}
    >
      About
    </Link>
  )
}
```

</PagesOnly>

### `replace`

**Defaults to `false`.** When `true`, `next/link` will replace the current history state instead of adding a new URL into the [browser's history](https://developer.mozilla.org/docs/Web/API/History_API) stack.

<AppOnly>

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" replace>
      Dashboard
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" replace>
      Dashboard
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" replace>
      Dashboard
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" replace>
      Dashboard
    </Link>
  )
}
```

</PagesOnly>

### `scroll`

**Defaults to `true`.** The default scrolling behavior of `<Link>` in Next.js **is to maintain scroll position**, similar to how browsers handle back and forwards navigation. When you navigate to a new [Page](/docs/app/api-reference/file-conventions/page), scroll position will stay the same as long as the Page is visible in the viewport. However, if the Page is not visible in the viewport, Next.js will scroll to the top of the first Page element.

When `scroll = {false}`, Next.js will not attempt to scroll to the first Page element.

> **Good to know**: Next.js checks if `scroll: false` before managing scroll behavior. If scrolling is enabled, it identifies the relevant DOM node for navigation and inspects each top-level element. All non-scrollable elements and those without rendered HTML are bypassed, this includes sticky or fixed positioned elements, and non-visible elements such as those calculated with `getBoundingClientRect`. Next.js then continues through siblings until it identifies a scrollable element that is visible in the viewport.

<AppOnly>

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" scroll={false}>
      Dashboard
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" scroll={false}>
      Dashboard
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" scroll={false}>
      Dashboard
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" scroll={false}>
      Dashboard
    </Link>
  )
}
```

</PagesOnly>

### `prefetch`

<AppOnly>

Prefetching happens when a `<Link />` component enters the user's viewport (initially or through scroll). Next.js prefetches and loads the linked route (denoted by the `href`) and its data in the background to improve the performance of client-side navigations. If the prefetched data has expired by the time the user hovers over a `<Link />`, Next.js will attempt to prefetch it again. **Prefetching is only enabled in production**.

The following values can be passed to the `prefetch` prop:

- **`"auto"` or `null` (default)**: Prefetch behavior depends on whether the route is static or dynamic. For static routes, the full route will be prefetched (including all its data). For dynamic routes, the partial route down to the nearest segment with a [`loading.js`](/docs/app/api-reference/file-conventions/loading#instant-loading-states) boundary will be prefetched.
- **`true`**: The full route is prefetched for both static and dynamic routes. With [Partial Prefetching](/docs/app/guides/adopting-partial-prefetching) enabled, the prefetch includes the [App Shell](/docs/app/glossary#app-shell) and cached content that depends on the link's URL data. See [Optimizing prefetching](/docs/app/guides/optimizing-prefetching).
- `false`: Prefetching will never happen both on entering the viewport and on hover.

> **With Partial Prefetching enabled** ([`partialPrefetching: true`](/docs/app/api-reference/config/next-config-js/partialPrefetching)): the default changes. `auto` prefetches the per-route [App Shell](/docs/app/glossary#app-shell) (the route's static and cached content) instead of the full page. See [Adopting Partial Prefetching](/docs/app/guides/adopting-partial-prefetching) for the full behavior change.

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" prefetch={false}>
      Dashboard
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/dashboard" prefetch={false}>
      Dashboard
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

Prefetching happens when a `<Link />` component enters the user's viewport (initially or through scroll). Next.js prefetches and loads the linked route (denoted by the `href`) and data in the background to improve the performance of client-side navigation. **Prefetching is only enabled in production**.

The following values can be passed to the `prefetch` prop:

- **`true` (default)**: The full route and its data will be prefetched.
- `false`: Prefetching will not happen when entering the viewport, but will happen on hover. If you want to completely remove fetching on hover as well, consider using an `<a>` tag or [incrementally adopting](/docs/app/guides/migrating/app-router-migration) the App Router, which enables disabling prefetching on hover too.

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" prefetch={false}>
      Dashboard
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" prefetch={false}>
      Dashboard
    </Link>
  )
}
```

### `shallow`

Update the path of the current page without rerunning [`getStaticProps`](/docs/pages/building-your-application/data-fetching/get-static-props), [`getServerSideProps`](/docs/pages/building-your-application/data-fetching/get-server-side-props) or [`getInitialProps`](/docs/pages/api-reference/functions/get-initial-props). Defaults to `false`.

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" shallow={false}>
      Dashboard
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/dashboard" shallow={false}>
      Dashboard
    </Link>
  )
}
```

### `locale`

The active locale is automatically prepended. `locale` allows for providing a different locale. When `false` `href` has to include the locale as the default behavior is disabled.

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <>
      {/* Default behavior: locale is prepended */}
      <Link href="/dashboard">Dashboard (with locale)</Link>

      {/* Disable locale prepending */}
      <Link href="/dashboard" locale={false}>
        Dashboard (without locale)
      </Link>

      {/* Specify a different locale */}
      <Link href="/dashboard" locale="fr">
        Dashboard (French)
      </Link>
    </>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <>
      {/* Default behavior: locale is prepended */}
      <Link href="/dashboard">Dashboard (with locale)</Link>

      {/* Disable locale prepending */}
      <Link href="/dashboard" locale={false}>
        Dashboard (without locale)
      </Link>

      {/* Specify a different locale */}
      <Link href="/dashboard" locale="fr">
        Dashboard (French)
      </Link>
    </>
  )
}
```

### `as`

Optional decorator for the path that will be shown in the browser URL bar. Before Next.js 9.5.3 this was used for dynamic routes, check our [previous docs](https://github.com/vercel/next.js/blob/v9.5.2/docs/api-reference/next/link.md#dynamic-routes) to see how it worked.

When this path differs from the one provided in `href` the previous `href`/`as` behavior is used as shown in the [previous docs](https://github.com/vercel/next.js/blob/v9.5.2/docs/api-reference/next/link.md#dynamic-routes).

</PagesOnly>

### `onNavigate`

An event handler called during client-side navigation. The handler receives an event object that includes a `preventDefault()` method, allowing you to cancel the navigation if needed.

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link
      href="/dashboard"
      onNavigate={(e) => {
        // Only executes during SPA navigation
        console.log('Navigating...')

        // Optionally prevent navigation
        // e.preventDefault()
      }}
    >
      Dashboard
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link
      href="/dashboard"
      onNavigate={(e) => {
        // Only executes during SPA navigation
        console.log('Navigating...')

        // Optionally prevent navigation
        // e.preventDefault()
      }}
    >
      Dashboard
    </Link>
  )
}
```

> **Good to know**: While `onClick` and `onNavigate` may seem similar, they serve different purposes. `onClick` executes for all click events, while `onNavigate` only runs during client-side navigation. Some key differences:
>
> - When using modifier keys (`Ctrl`/`Cmd` + Click), `onClick` executes but `onNavigate` doesn't since Next.js prevents default navigation for new tabs.
> - External URLs won't trigger `onNavigate` since it's only for client-side and same-origin navigations.
> - Links with the `download` attribute will work with `onClick` but not `onNavigate` since the browser will treat the linked URL as a download.

### `transitionTypes`

<AppOnly>

A list of transition types to apply to the navigation. These types are passed to [`React.addTransitionType`](https://react.dev/reference/react/addTransitionType) inside the navigation transition, enabling [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition) components to apply different animations based on the type of navigation.

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" transitionTypes={['slide-in']}>
      About
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" transitionTypes={['slide-in']}>
      About
    </Link>
  )
}
```

</AppOnly>

## Examples

The following examples demonstrate how to use the `<Link>` component in different scenarios.

<AppOnly>

### Linking to dynamic route segments

When linking to [dynamic segments](/docs/app/api-reference/file-conventions/dynamic-routes), you can use [template literals and interpolation](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals) to generate a list of links. For example, to generate a list of blog posts:

```tsx filename="app/blog/post-list.tsx" switcher
import Link from 'next/link'

interface Post {
  id: number
  title: string
  slug: string
}

export default function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  )
}
```

```jsx filename="app/blog/post-list.js" switcher
import Link from 'next/link'

export default function PostList({ posts }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  )
}
```

### Checking active links

You can use [`usePathname()`](/docs/app/api-reference/functions/use-pathname) to determine if a link is active. For example, to add a class to the active link, you can check if the current `pathname` matches the `href` of the link:

```tsx filename="app/ui/nav-links.tsx" switcher
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Links() {
  const pathname = usePathname()

  return (
    <nav>
      <Link className={`link ${pathname === '/' ? 'active' : ''}`} href="/">
        Home
      </Link>

      <Link
        className={`link ${pathname === '/about' ? 'active' : ''}`}
        href="/about"
      >
        About
      </Link>
    </nav>
  )
}
```

```jsx filename="app/ui/nav-links.js" switcher
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Links() {
  const pathname = usePathname()

  return (
    <nav>
      <Link className={`link ${pathname === '/' ? 'active' : ''}`} href="/">
        Home
      </Link>

      <Link
        className={`link ${pathname === '/about' ? 'active' : ''}`}
        href="/about"
      >
        About
      </Link>
    </nav>
  )
}
```

</AppOnly>

<PagesOnly>

### Linking to dynamic route segments

For [dynamic route segments](/docs/pages/building-your-application/routing/dynamic-routes#convention), it can be handy to use template literals to create the link's path.

For example, you can generate a list of links to the dynamic route `pages/blog/[slug].js`

```tsx filename="pages/blog/index.tsx" switcher
import Link from 'next/link'

function Posts({ posts }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  )
}
```

```jsx filename="pages/blog/index.js" switcher
import Link from 'next/link'

function Posts({ posts }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  )
}

export default Posts
```

</PagesOnly>

### Scrolling to an `id`

If you'd like to scroll to a specific `id` on navigation, you can append your URL with a `#` hash link or just pass a hash link to the `href` prop. This is possible since `<Link>` renders to an `<a>` element.

```jsx
<Link href="/dashboard#settings">Settings</Link>

// Output
<a href="/dashboard#settings">Settings</a>
```

<AppOnly>

> **Good to know**:
>
> - Next.js will scroll to the [Page](/docs/app/api-reference/file-conventions/page) if it is not visible in the viewport upon navigation.

</AppOnly>

<PagesOnly>

### Passing a URL Object

`Link` can also receive a URL object and it will automatically format it to create the URL string:

```tsx filename="pages/index.ts" switcher
import Link from 'next/link'

function Home() {
  return (
    <ul>
      <li>
        <Link
          href={{
            pathname: '/about',
            query: { name: 'test' },
          }}
        >
          About us
        </Link>
      </li>
      <li>
        <Link
          href={{
            pathname: '/blog/[slug]',
            query: { slug: 'my-post' },
          }}
        >
          Blog Post
        </Link>
      </li>
    </ul>
  )
}

export default Home
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

function Home() {
  return (
    <ul>
      <li>
        <Link
          href={{
            pathname: '/about',
            query: { name: 'test' },
          }}
        >
          About us
        </Link>
      </li>
      <li>
        <Link
          href={{
            pathname: '/blog/[slug]',
            query: { slug: 'my-post' },
          }}
        >
          Blog Post
        </Link>
      </li>
    </ul>
  )
}

export default Home
```

The above example has a link to:

- A predefined route: `/about?name=test`
- A [dynamic route](/docs/pages/building-your-application/routing/dynamic-routes#convention): `/blog/my-post`

You can use every property as defined in the [Node.js URL module documentation](https://nodejs.org/api/url.html#url_url_strings_and_url_objects).

</PagesOnly>

### Replace the URL instead of push

The default behavior of the `Link` component is to `push` a new URL into the `history` stack. You can use the `replace` prop to prevent adding a new entry, as in the following example:

<AppOnly>

```tsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" replace>
      About us
    </Link>
  )
}
```

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" replace>
      About us
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/about" replace>
      About us
    </Link>
  )
}
```

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/about" replace>
      About us
    </Link>
  )
}
```

</PagesOnly>

### Disable scrolling to the top of the page

<AppOnly>

The default scrolling behavior of `<Link>` in Next.js **is to maintain scroll position**, similar to how browsers handle back and forwards navigation. When you navigate to a new [Page](/docs/app/api-reference/file-conventions/page), scroll position will stay the same as long as the Page is visible in the viewport.

However, if the Page is not visible in the viewport, Next.js will scroll to the top of the first Page element. If you'd like to disable this behavior, you can pass `scroll={false}` to the `<Link>` component, or `scroll: false` to `router.push()` or `router.replace()`.

```jsx filename="app/page.js" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/#hashid" scroll={false}>
      Disables scrolling to the top
    </Link>
  )
}
```

```tsx filename="app/page.tsx" switcher
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/#hashid" scroll={false}>
      Disables scrolling to the top
    </Link>
  )
}
```

Using `router.push()` or `router.replace()`:

```jsx
// useRouter
import { useRouter } from 'next/navigation'

const router = useRouter()

router.push('/dashboard', { scroll: false })
```

</AppOnly>

<PagesOnly>

The default behavior of `Link` is to scroll to the top of the page. When there is a hash defined it will scroll to the specific id, like a normal `<a>` tag. To prevent scrolling to the top / hash `scroll={false}` can be added to `Link`:

```jsx filename="pages/index.js" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/#hashid" scroll={false}>
      Disables scrolling to the top
    </Link>
  )
}
```

```tsx filename="pages/index.tsx" switcher
import Link from 'next/link'

export default function Home() {
  return (
    <Link href="/#hashid" scroll={false}>
      Disables scrolling to the top
    </Link>
  )
}
```

</PagesOnly>

### Scroll offset with sticky headers

Because Next.js skips sticky and fixed positioned elements when finding the scroll target, content may end up behind a sticky header after navigation. For example, if your layout has a sticky header:

```tsx filename="app/layout.tsx" switcher
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 h-16 bg-white">
          {/* Navigation */}
        </header>
        {children}
      </body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 h-16 bg-white">
          {/* Navigation */}
        </header>
        {children}
      </body>
    </html>
  )
}
```

You can account for its height using [`scroll-padding-top`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding-top) on the scroll container:

```css filename="app/globals.css"
html {
  scroll-padding-top: 64px; /* Match the height of your sticky header */
}
```

This is a browser CSS property that offsets scroll-based positioning. It applies whenever Next.js uses the native [`scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) API, including hash fragment (`#id`) navigation. Alternatively, you can use [`scroll-margin-top`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin-top) on individual target elements instead of setting a global offset.

### Prefetching links in Proxy

It's common to use [Proxy](/docs/app/api-reference/file-conventions/proxy) for authentication or other purposes that involve rewriting the user to a different page. In order for the `<Link />` component to properly prefetch links with rewrites via Proxy, you need to tell Next.js both the URL to display and the URL to prefetch. This is required to avoid un-necessary fetches to proxy to know the correct route to prefetch.

For example, if you want to serve a `/dashboard` route that has authenticated and visitor views, you can add the following in your Proxy to redirect the user to the correct page:

```ts filename="proxy.ts" switcher
import { NextResponse } from 'next/server'

export function proxy(request: Request) {
  const nextUrl = request.nextUrl
  if (nextUrl.pathname === '/dashboard') {
    if (request.cookies.authToken) {
      return NextResponse.rewrite(new URL('/auth/dashboard', request.url))
    } else {
      return NextResponse.rewrite(new URL('/public/dashboard', request.url))
    }
  }
}
```

```js filename="proxy.js" switcher
import { NextResponse } from 'next/server'

export function proxy(request) {
  const nextUrl = request.nextUrl
  if (nextUrl.pathname === '/dashboard') {
    if (request.cookies.authToken) {
      return NextResponse.rewrite(new URL('/auth/dashboard', request.url))
    } else {
      return NextResponse.rewrite(new URL('/public/dashboard', request.url))
    }
  }
}
```

In this case, you would want to use the following code in your `<Link />` component:

<AppOnly>

```tsx filename="app/page.tsx" switcher
'use client'

import Link from 'next/link'
import useIsAuthed from './hooks/useIsAuthed' // Your auth hook

export default function Page() {
  const isAuthed = useIsAuthed()
  const path = isAuthed ? '/auth/dashboard' : '/public/dashboard'
  return (
    <Link as="/dashboard" href={path}>
      Dashboard
    </Link>
  )
}
```

```js filename="app/page.js" switcher
'use client'

import Link from 'next/link'
import useIsAuthed from './hooks/useIsAuthed' // Your auth hook

export default function Page() {
  const isAuthed = useIsAuthed()
  const path = isAuthed ? '/auth/dashboard' : '/public/dashboard'
  return (
    <Link as="/dashboard" href={path}>
      Dashboard
    </Link>
  )
}
```

</AppOnly>

<PagesOnly>

```tsx filename="pages/index.tsx" switcher
'use client'

import Link from 'next/link'
import useIsAuthed from './hooks/useIsAuthed' // Your auth hook

export default function Home() {
  const isAuthed = useIsAuthed()
  const path = isAuthed ? '/auth/dashboard' : '/public/dashboard'
  return (
    <Link as="/dashboard" href={path}>
      Dashboard
    </Link>
  )
}
```

```js filename="pages/index.js" switcher
'use client'

import Link from 'next/link'
import useIsAuthed from './hooks/useIsAuthed' // Your auth hook

export default function Home() {
  const isAuthed = useIsAuthed()
  const path = isAuthed ? '/auth/dashboard' : '/public/dashboard'
  return (
    <Link as="/dashboard" href={path}>
      Dashboard
    </Link>
  )
}
```

> **Good to know**: If you're using [Dynamic Routes](/docs/pages/building-your-application/routing/dynamic-routes#convention), you'll need to adapt your `as` and `href` props. For example, if you have a Dynamic Route like `/dashboard/authed/[user]` that you want to present differently via proxy, you would write: `<Link href={{ pathname: '/dashboard/authed/[user]', query: { user: username } }} as="/dashboard/[user]">Profile</Link>`.

</PagesOnly>

<AppOnly>

### Blocking navigation

You can use the `onNavigate` prop to block navigation when certain conditions are met, such as when a form has unsaved changes. When you need to block navigation across multiple components in your app (like preventing navigation from any link while a form is being edited), React Context provides a clean way to share this blocking state. First, create a context to track the navigation blocking state:

```tsx filename="app/contexts/navigation-blocker.tsx" switcher
'use client'

import { createContext, useState, useContext } from 'react'

interface NavigationBlockerContextType {
  isBlocked: boolean
  setIsBlocked: (isBlocked: boolean) => void
}

export const NavigationBlockerContext =
  createContext<NavigationBlockerContextType>({
    isBlocked: false,
    setIsBlocked: () => {},
  })

export function NavigationBlockerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isBlocked, setIsBlocked] = useState(false)

  return (
    <NavigationBlockerContext.Provider value={{ isBlocked, setIsBlocked }}>
      {children}
    </NavigationBlockerContext.Provider>
  )
}

export function useNavigationBlocker() {
  return useContext(NavigationBlockerContext)
}
```

```jsx filename="app/contexts/navigation-blocker.js" switcher
'use client'

import { createContext, useState, useContext } from 'react'

export const NavigationBlockerContext = createContext({
  isBlocked: false,
  setIsBlocked: () => {},
})

export function NavigationBlockerProvider({ children }) {
  const [isBlocked, setIsBlocked] = useState(false)

  return (
    <NavigationBlockerContext.Provider value={{ isBlocked, setIsBlocked }}>
      {children}
    </NavigationBlockerContext.Provider>
  )
}

export function useNavigationBlocker() {
  return useContext(NavigationBlockerContext)
}
```

Create a form component that uses the context:

```tsx filename="app/components/form.tsx" switcher
'use client'

import { useNavigationBlocker } from '../contexts/navigation-blocker'

export default function Form() {
  const { setIsBlocked } = useNavigationBlocker()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setIsBlocked(false)
      }}
      onChange={() => setIsBlocked(true)}
    >
      <input type="text" name="name" />
      <button type="submit">Save</button>
    </form>
  )
}
```

```jsx filename="app/components/form.js" switcher
'use client'

import { useNavigationBlocker } from '../contexts/navigation-blocker'

export default function Form() {
  const { setIsBlocked } = useNavigationBlocker()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setIsBlocked(false)
      }}
      onChange={() => setIsBlocked(true)}
    >
      <input type="text" name="name" />
      <button type="submit">Save</button>
    </form>
  )
}
```

Create a custom Link component that blocks navigation:

```tsx filename="app/components/custom-link.tsx" switcher
'use client'

import Link from 'next/link'
import { useNavigationBlocker } from '../contexts/navigation-blocker'

interface CustomLinkProps extends React.ComponentProps<typeof Link> {
  children: React.ReactNode
}

export function CustomLink({ children, ...props }: CustomLinkProps) {
  const { isBlocked } = useNavigationBlocker()

  return (
    <Link
      onNavigate={(e) => {
        if (
          isBlocked &&
          !window.confirm('You have unsaved changes. Leave anyway?')
        ) {
          e.preventDefault()
        }
      }}
      {...props}
    >
      {children}
    </Link>
  )
}
```

```jsx filename="app/components/custom-link.js" switcher
'use client'

import Link from 'next/link'
import { useNavigationBlocker } from '../contexts/navigation-blocker'

export function CustomLink({ children, ...props }) {
  const { isBlocked } = useNavigationBlocker()

  return (
    <Link
      onNavigate={(e) => {
        if (
          isBlocked &&
          !window.confirm('You have unsaved changes. Leave anyway?')
        ) {
          e.preventDefault()
        }
      }}
      {...props}
    >
      {children}
    </Link>
  )
}
```

Create a navigation component:

```tsx filename="app/components/nav.tsx" switcher
'use client'

import { CustomLink as Link } from './custom-link'

export default function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
    </nav>
  )
}
```

```jsx filename="app/components/nav.js" switcher
'use client'

import { CustomLink as Link } from './custom-link'

export default function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
    </nav>
  )
}
```

Finally, wrap your app with the `NavigationBlockerProvider` in the root layout and use the components in your page:

```tsx filename="app/layout.tsx" switcher
import { NavigationBlockerProvider } from './contexts/navigation-blocker'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NavigationBlockerProvider>{children}</NavigationBlockerProvider>
      </body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
import { NavigationBlockerProvider } from './contexts/navigation-blocker'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavigationBlockerProvider>{children}</NavigationBlockerProvider>
      </body>
    </html>
  )
}
```

Then, use the `Nav` and `Form` components in your page:

```tsx filename="app/page.tsx" switcher
import Nav from './components/nav'
import Form from './components/form'

export default function Page() {
  return (
    <div>
      <Nav />
      <main>
        <h1>Welcome to the Dashboard</h1>
        <Form />
      </main>
    </div>
  )
}
```

```jsx filename="app/page.js" switcher
import Nav from './components/nav'
import Form from './components/form'

export default function Page() {
  return (
    <div>
      <Nav />
      <main>
        <h1>Welcome to the Dashboard</h1>
        <Form />
      </main>
    </div>
  )
}
```

When a user tries to navigate away using `CustomLink` while the form has unsaved changes, they'll be prompted to confirm before leaving.

</AppOnly>

## Version history

| Version   | Changes                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v16.2.0` | Add `transitionTypes` prop.                                                                                                                                                  |
| `v15.4.0` | Add `auto` as an alias to the default `prefetch` behavior.                                                                                                                   |
| `v15.3.0` | Add `onNavigate` API                                                                                                                                                         |
| `v13.0.0` | No longer requires a child `<a>` tag. A [codemod](/docs/app/guides/upgrading/codemods#remove-a-tags-from-link-components) is provided to automatically update your codebase. |
| `v10.0.0` | `href` props pointing to a dynamic route are automatically resolved and no longer require an `as` prop.                                                                      |
| `v8.0.0`  | Improved prefetching performance.                                                                                                                                            |
| `v1.0.0`  | `next/link` introduced.                                                                                                                                                      |
`````
<!-- END SOURCE: node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md -->


