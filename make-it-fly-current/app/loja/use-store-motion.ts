"use client";

import { useEffect, useRef } from "react";
import { floatingOffset, stepSpring } from "./store-motion-math";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Exponential damping uses elapsed seconds so 60 Hz and 120 Hz feel the same.
const damp = (value: number, target: number, speed: number, delta: number) =>
  value + (target - value) * -Math.expm1(-speed * delta);

/** Keep scrolling native; smooth the objects and light, never the document itself. */
export function useStoreMotion(motionEnabled: boolean) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const page = element;

    const reduced = { matches: !motionEnabled };
    const desktop = matchMedia("(min-width: 761px) and (hover: hover) and (pointer: fine)");
    const cursor = page.querySelector<HTMLElement>("[data-store-cursor]");
    const orbTravel = page.querySelector<HTMLElement>("[data-store-orb-travel]");
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
      depth: [1, .85, .78, 1, .85, .78][index % 6],
      driftX: { value: 0, velocity: 0 },
      driftY: { value: 0, velocity: 0 },
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
    let nextHitTest = 0;
    let viewportHeight = innerHeight;
    let viewportWidth = innerWidth;
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
    const styles = new WeakMap<HTMLElement, Map<string, string>>();

    const setStyle = (target: HTMLElement, property: string, value: string) => {
      let values = styles.get(target);
      if (!values) { values = new Map(); styles.set(target, values); }
      if (values.get(property) === value) return;
      target.style.setProperty(property, value);
      values.set(property, value);
    };
    const setData = (target: HTMLElement, key: string, value: boolean) => {
      const next = String(value);
      if (target.dataset[key] !== next) target.dataset[key] = next;
    };
    const setHovered = (next: HTMLElement | null) => {
      if (hovered === next) return;
      if (hovered) setData(hovered, "hovered", false);
      hovered = next;
      if (hovered) setData(hovered, "hovered", true);
    };
    const resetCardPointer = (state: (typeof cards)[number]) => {
      if (!state.card) return;
      state.hover = state.tiltX = state.tiltY = 0;
      state.glintX = 50;
      state.glintY = 40;
      setData(state.card, "hovered", false);
      setStyle(state.card, "--pointer-x", "0deg");
      setStyle(state.card, "--pointer-y", "0deg");
      setStyle(state.card, "--hover-lift", "0px");
      setStyle(state.card, "--hover-scale", "1");
      setStyle(state.card, "--hover-progress", "0");
      setStyle(state.card, "--glint-x", "50%");
      setStyle(state.card, "--glint-y", "40%");
    };

    const requestFrame = () => {
      if (!frame && !document.hidden && !modalOpen) frame = requestAnimationFrame(draw);
    };

    function draw(time: number) {
      frame = 0;
      const delta = Math.min((time - (lastTime || time - 16.67)) / 1000, 0.05);
      lastTime = time;
      const scroll = window.scrollY;
      const animate = !reduced.matches && !modalOpen;
      const interactive = animate && desktop.matches;

      // Read layout together, and only after layout/viewport changes. The slot
      // itself never transforms, so its document coordinates remain stable.
      if (measureNeeded) {
        viewportHeight = innerHeight;
        viewportWidth = innerWidth;
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
      if ((hitTestNeeded || time >= nextHitTest) && hasPointer && interactive) {
        const target = document.elementFromPoint(pointerX, pointerY)?.closest<HTMLElement>("[data-store-card]") ?? null;
        setHovered(cards.some((state) => state.visible && state.card === target) ? target : null);
        nextHitTest = time + 80;
      }
      hitTestNeeded = false;

      const targetProgress = clamp(scroll / maxScroll, 0, 1);
      progress = reduced.matches ? targetProgress : damp(progress, targetProgress, 8, delta);
      const targetOrbX = interactive ? Math.sin(progress * Math.PI * 3) * 16 : 0;
      const targetOrbY = interactive ? Math.sin(progress * Math.PI * 2) * 14 : 0;
      // A short second damping pass rounds trajectory changes without a CSS
      // transition being restarted on every incoming scroll event.
      orbX = reduced.matches ? 0 : damp(orbX, targetOrbX, 5, delta);
      orbY = reduced.matches ? 0 : damp(orbY, targetOrbY, 5, delta);
      let needsFrame = Math.abs(progress - targetProgress) > 0.0001
        || Math.abs(orbX - targetOrbX) + Math.abs(orbY - targetOrbY) > 0.005;

      // All DOM writes occur after the measurement/hit-test phase.
      setData(page, "cursorActive", interactive && hasPointer && Boolean(hovered));
      if (orbTravel) setStyle(orbTravel, "transform", interactive
        ? `translate3d(${orbX.toFixed(3)}vw,${orbY.toFixed(3)}vh,0)`
        : "none");

      if (cursor && interactive && hasPointer) {
        cursorX = damp(cursorX, pointerX + 18, 19, delta);
        cursorY = damp(cursorY, pointerY + 18, 19, delta);
        setStyle(cursor, "transform", `translate3d(${cursorX.toFixed(2)}px,${cursorY.toFixed(2)}px,0)`);
        needsFrame ||= Math.abs(cursorX - pointerX - 18) + Math.abs(cursorY - pointerY - 18) > 0.1;
      }

      for (const state of cards) {
        if (!state.card) continue;
        // Entrance is scrubbed by actual viewport travel, not a timer started
        // outside the viewport. The stable slot avoids transform feedback.
        const entranceDistance = Math.max(1, Math.min(state.height * 0.45, viewportHeight * 0.28));
        const entrance = reduced.matches ? 1 : clamp((viewportHeight - state.top + scroll) / entranceDistance, 0, 1);
        const reveal = entrance * entrance * (3 - 2 * entrance);
        setStyle(state.card, "--reveal-opacity", reveal.toFixed(4));
        setStyle(state.card, "--reveal-y", `${((1 - reveal) * 40).toFixed(2)}px`);
        if (!state.visible) continue;
        const isHovered = interactive && hovered === state.card;
        const phase = clamp((state.top + state.height / 2 - scroll - viewportHeight / 2) / viewportHeight, -1, 1);
        const localX = isHovered ? clamp((pointerX - state.left) / state.width, 0, 1) : 0.5;
        const localY = isHovered ? clamp((pointerY - state.top + scroll) / state.height, 0, 1) : 0.4;

        if (animate) state.time += delta;
        // Cards move at different depths. Pointer drift is applied to the whole
        // tile. The reusable card consumes the pointer tilt on its 3D shell;
        // its artwork keeps only a small independent scroll movement.
        const orbit = floatingOffset(state.time, state.depth);
        const pointerDriftX = interactive && hasPointer ? (pointerX / viewportWidth - .5) * 32 * state.depth : 0;
        const pointerDriftY = interactive && hasPointer ? (pointerY / viewportHeight - .5) * 20 * state.depth : 0;
        const floatX = interactive ? orbit.x + pointerDriftX : 0;
        const floatY = interactive ? orbit.y + pointerDriftY + phase * (1 - state.depth) * 90 : 0;
        const floatTurn = interactive ? orbit.turn : 0;
        const blend = reduced.matches ? 1 : -Math.expm1(-8 * delta);
        state.floatX = stepSpring(state.driftX, floatX, 6.5, delta);
        state.floatY = stepSpring(state.driftY, floatY, 6.5, delta);
        if (reduced.matches) { state.floatX = state.floatY = 0; state.driftX.value = state.driftY.value = 0; state.driftX.velocity = state.driftY.velocity = 0; }
        state.floatTurn += (floatTurn - state.floatTurn) * blend;
        state.turn += ((animate ? phase * (desktop.matches ? 3 : 1.5) : 0) - state.turn) * blend;
        state.lift += ((animate ? phase * (desktop.matches ? -14 : -8) : 0) - state.lift) * blend;
        state.hover = damp(state.hover, isHovered ? 1 : 0, 10, delta);
        state.tiltX = damp(state.tiltX, isHovered ? (localX - 0.5) * 16 : 0, 11, delta);
        state.tiltY = damp(state.tiltY, isHovered ? (localY - 0.5) * -16 : 0, 11, delta);
        state.glintX = damp(state.glintX, localX * 100, 9, delta);
        state.glintY = damp(state.glintY, localY * 100, 9, delta);

        setStyle(state.slot, "--float-x", `${state.floatX.toFixed(2)}px`);
        setStyle(state.slot, "--float-y", `${state.floatY.toFixed(2)}px`);
        setStyle(state.slot, "--float-turn", `${state.floatTurn.toFixed(3)}deg`);
        setStyle(state.slot, "--product-turn", `${state.turn.toFixed(3)}deg`);
        setStyle(state.slot, "--product-lift", `${state.lift.toFixed(2)}px`);
        setStyle(state.card, "--pointer-x", `${state.tiltX.toFixed(3)}deg`);
        setStyle(state.card, "--pointer-y", `${state.tiltY.toFixed(3)}deg`);
        setStyle(state.card, "--hover-lift", `${(state.hover * -8).toFixed(2)}px`);
        setStyle(state.card, "--hover-scale", (1 + state.hover * 0.05).toFixed(4));
        setStyle(state.card, "--hover-progress", state.hover.toFixed(4));
        setStyle(state.card, "--glint-x", `${state.glintX.toFixed(2)}%`);
        setStyle(state.card, "--glint-y", `${state.glintY.toFixed(2)}%`);
        needsFrame ||= interactive;
      }

      if (needsFrame && !reduced.matches && !modalOpen) requestFrame();
      else lastTime = 0;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const state = cards.find(({ slot }) => slot === entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        setData(state.slot, "inView", entry.isIntersecting);
        if (!entry.isIntersecting) {
          if (hovered === state.card) setHovered(null);
          resetCardPointer(state);
        }
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
      resetPointer();
      cards.forEach(resetCardPointer);
      requestFrame();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(page);
    const resetPointer = () => {
      setHovered(null);
      hasPointer = false;
      setData(page, "cursorActive", false);
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
      setHovered(target?.closest<HTMLElement>("[data-store-card]") ?? null);
      requestFrame();
    };
    const syncPause = () => {
      modalOpen = Boolean(page.querySelector("dialog[open]"));
      setData(page, "motionPaused", modalOpen || document.hidden || reduced.matches);
      setData(page, "pageHidden", document.hidden);
      if (modalOpen || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        setHovered(null);
        hasPointer = false;
        setData(page, "cursorActive", false);
        cards.forEach(resetCardPointer);
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
      cards.forEach(resetCardPointer);
      if (orbTravel && (reduced.matches || !desktop.matches)) setStyle(orbTravel, "transform", "none");
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
    desktop.addEventListener("change", onPreference);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      dialogObserver.disconnect();
      cancelAnimationFrame(frame);
      setHovered(null);
      setData(page, "cursorActive", false);
      delete page.dataset.motionReady;
      html.style.scrollBehavior = previousBehavior;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("keydown", resetPointer);
      document.removeEventListener("visibilitychange", syncPause);
      page.removeEventListener("pointermove", onPointer);
      page.removeEventListener("pointerleave", resetPointer);
      desktop.removeEventListener("change", onPreference);
    };
  }, [motionEnabled]);

  return root;
}
