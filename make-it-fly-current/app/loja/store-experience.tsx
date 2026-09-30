"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StoreOrb } from "./store-orb";
import { StoreProductVisual } from "./store-product-visual";
import { InteractiveProductCard } from "@/components/ui/card-7";
import { CommerceHero } from "@/components/ui/commerce-hero";
import styles from "./loja.module.css";

const collection = [
  { slug: "uniforme", name: "Uniforme de voo", detail: "Peça 01", visual: "wearable", caption: "Para vestir uma ideia.", description: "Uma peça para levar o espírito dos encontros para fora deles. A primeira proposta de vestuário da comunidade Apogee Builders Club.", category: "Vestuário" },
  { slug: "caderno", name: "Caderno orbital", detail: "A5", visual: "notebook", caption: "Toda trajetória começa no papel.", description: "Um lugar para guardar perguntas, rascunhos e planos. Um objeto cotidiano pensado para acompanhar ideias em construção.", category: "Papelaria" },
  { slug: "apogeu", name: "Objeto Apogeu", detail: "Objeto 01", visual: "object", caption: "Uma ideia em outra dimensão.", description: "Um estudo de forma inspirado em órbitas e trajetórias. A linguagem da Apogee transformada em um objeto para habitar espaços.", category: "Objetos" },
  { slug: "poster", name: "Pôster de trajetória", detail: "A2", visual: "edition", caption: "O movimento ocupa a parede.", description: "Uma edição gráfica sobre os caminhos que uma ideia pode percorrer. Tipografia, órbitas e a identidade dos nossos encontros.", category: "Edições" },
  { slug: "bolsa", name: "Bolsa de campo", detail: "Peça 02", visual: "bag", caption: "Leve o que faz você ir além.", description: "Uma bolsa para o que acompanha você entre um encontro e outro. A proposta reúne a identidade Apogee e o uso de todos os dias.", category: "Acessórios" },
  { slug: "encontro", name: "Edição de encontro", detail: "Edição 01", visual: "ticket", caption: "Uma lembrança do que começou aqui.", description: "Uma peça gráfica para registrar conexões e encontros. Um estudo de edição comemorativa da comunidade, sem funcionar como ingresso ou reserva.", category: "Edições" },
] as const;

type CollectionItem = (typeof collection)[number];

function CycleText({ children }: { children: string }) {
  return <span className={styles.cycleText}><span>{children}</span><span aria-hidden>{children}</span></span>;
}

export function StoreExperience() {
  const motionEnabled = true;
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
    const duration = motionEnabled ? 400 : 0;
    closeTimer.current = setTimeout(() => {
      setSelected(null);
      setMenuOpen(false);
      setReleaseOpen(false);
      setClosing(false);
    }, duration);
  };

  return (
    <div className={styles.page} data-motion="full">
      <div className={styles.loader} aria-hidden>
        <span className={styles.logoNavy} role="img" aria-label="Apogee" />
        <span className={styles.loaderLabel}>Carregando coleção <i /></span>
      </div>

      <main id="experiencia">
        <CommerceHero
          className={styles.apogeeHero}
          brand={<span className={styles.logoNavy} aria-hidden="true" />}
          title={<><span>Itens para quem vai</span><br /><span>mudar o mundo</span></>}
          description="Peças, objetos e edições da comunidade Apogee Builders Club. Explore os estudos da nossa primeira coleção."
          navigation={[{ name: "Início", href: "/" }, { name: "Coleção", href: "#produtos" }, { name: "Nossa história", href: "/galeria" }]}
          categories={[]}
          motionEnabled={motionEnabled}
          onMenuRequest={() => setMenuOpen(true)}
          menuOpen={menuOpen}
          menuControls="store-mobile-menu"
          background={<div className={styles.commerceOrb} aria-hidden><div className={styles.orbTravel} data-store-orb-travel><StoreOrb motionEnabled={motionEnabled} /></div></div>}
          headerActions={<div className={styles.headerActions}>
          <button className={styles.release} type="button" onClick={() => setReleaseOpen(true)} aria-label="Em breve" aria-haspopup="dialog">
            <CycleText>Em breve</CycleText><span className={styles.releaseCount}>1</span>
          </button>
        </div>}
        >
          <a className={styles.pill} href="#produtos"><CycleText>Ver a coleção</CycleText></a>
        </CommerceHero>

        <section className={styles.showcase} id="produtos" aria-labelledby="collection-title">
          <div className={styles.collectionIntro}><div><p>Apogee Builders Club · em desenvolvimento</p><h2 id="collection-title">Primeira coleção.</h2></div><p>Seis estudos de peças para levar nossas ideias além dos encontros.</p></div>
          <div className={styles.productStream}>
            {collection.map((item, index) => (
              <div className={styles.productSlot} data-store-slot id={`produto-${item.slug}`} key={item.slug}>
                <InteractiveProductCard
                  className={styles.productCard}
                  data-store-card
                  data-product-kind={item.visual}
                  title={item.name}
                  description={`${item.category} · ${item.detail}`}
                  brand={<span className={styles.cardBrand} role="img" aria-label="Apogee" />}
                  badge="Protótipo"
                  visual={<div className={styles.cardArtwork}><StoreProductVisual kind={item.visual} /></div>}
                  footer={<div className={styles.cardFooter}><span>{item.caption}<small>Ver estudo da peça <span aria-hidden>↗</span></small></span><span className={styles.cardNumber} aria-hidden>{String(index + 1).padStart(2, "0")}</span></div>}
                  showIndicators={false}
                  motionEnabled={false}
                  onActivate={() => setSelected(item)}
                  actionLabel={`Ver protótipo ${item.name}`}
                />
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerBrand}><span className={styles.logoWhite} role="img" aria-label="Apogee" /><p className={styles.footerEyebrow}>Builders Club · primeira coleção</p></div>
          <h2>Para quem tem<br />sede de mudar<br />o mundo</h2>
          <div className={styles.footerContent}>
            <Link className={styles.pill} href="/galeria"><CycleText>Nossa história</CycleText></Link>
            <p>Ideias, encontros e objetos da comunidade Apogee. A primeira coleção está em desenvolvimento.</p>
            <nav aria-label="Navegação do rodapé"><Link href="/"><CycleText>Apogee</CycleText></Link><Link href="/galeria"><CycleText>Galeria</CycleText></Link><a href="#colecao"><CycleText>Voltar ao início ↑</CycleText></a></nav>
          </div>
          <div className={styles.footerBottom}><span>© Apogee Builders Club</span><span>Building the future.</span></div>
        </footer>
      </main>

      <dialog ref={productDialog} className={styles.productDialog} data-closing={closing} aria-labelledby="product-title" onCancel={(event) => { event.preventDefault(); closeModal(); }}>
        {selected && <>
          <div className={styles.productDialogHeader}><span className={styles.logoNavy} role="img" aria-label="Apogee" /><button type="button" className={styles.closeButton} onClick={closeModal} autoFocus><CycleText>Voltar à coleção</CycleText><span aria-hidden>×</span></button></div>
          <div className={styles.productHero}>
            <span className={styles.productBarcode} aria-hidden />
            <span className={styles.productCategory}>{selected.category} <span aria-hidden>✦</span></span>
            <div className={styles.productMarquee} aria-hidden><div>{[0, 1, 2, 3].map((i) => <span key={i}>{selected.name} — {selected.detail}&nbsp;</span>)}</div></div>
            <div className={styles.detailObject}><StoreProductVisual kind={selected.visual} /></div>
            <div className={styles.detailNumber}><span>Protótipo</span><strong>{String(collection.indexOf(selected) + 1).padStart(2, "0")}</strong></div>
            <div className={styles.productSticker}>Primeira<br />coleção<br /><span aria-hidden>↗</span></div>
            <button type="button" className={`${styles.pill} ${styles.productExplore}`} onClick={() => productDialog.current?.querySelector("[data-product-story]")?.scrollIntoView({ behavior: motionEnabled ? "smooth" : "instant", block: "start" })}><CycleText>Conhecer a peça ↓</CycleText></button>
          </div>
          <section className={styles.productStory} data-product-story>
            <div><p>Primeira coleção · {selected.detail}</p><h2 id="product-title">{selected.name}</h2><h3>{selected.caption}</h3></div>
            <div><p>{selected.description}</p><p className={styles.developmentNote}>Estudo visual da coleção. Materiais, medidas e produção ainda estão em definição. Este item não está à venda.</p><Link className={styles.pill} href="/galeria"><CycleText>Conheça a comunidade ↗</CycleText></Link></div>
          </section>
        </>}
      </dialog>

      <dialog ref={releaseDialog} className={styles.releaseDialog} data-closing={closing} aria-labelledby="release-title" onCancel={(event) => { event.preventDefault(); closeModal(); }} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className={styles.releasePanel}><div className={styles.releasePanelHeader}><span>Primeira coleção <sup>[1]</sup></span><button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Fechar" autoFocus>×</button></div><div><p>Apogee Builders Club</p><h2 id="release-title">Em breve,<br />fora do papel.</h2><p>A loja está em preparação. Esta é uma seleção em desenvolvimento: estudos de peças, objetos e edições da nossa comunidade.</p><Link className={styles.pill} href="/galeria"><CycleText>Conheça nossa história</CycleText></Link></div></div>
      </dialog>

      <dialog ref={menuDialog} id="store-mobile-menu" className={styles.mobileMenu} data-closing={closing} aria-label="Menu da loja" onCancel={(event) => { event.preventDefault(); closeModal(); }}>
        <div className={styles.menuHeader}><span className={styles.logoNavy} role="img" aria-label="Apogee" /><button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Fechar menu" autoFocus>×</button></div>
        <nav aria-label="Menu móvel"><a href="#produtos" onClick={closeModal}>Coleção<span>↗</span></a><Link href="/galeria">Nossa história<span>↗</span></Link><Link href="/">Início<span>↗</span></Link></nav>
        <div className={styles.menuBottom}><p>Building the future.</p><span className={styles.menuSignature} role="img" aria-label="Apogee" /></div>
      </dialog>
    </div>
  );
}
