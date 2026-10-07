"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./store-orb.module.css";
import { glassVertexShader, glassFragmentShader } from "./store-glass-shader";
import { resolveOrbFrameMode, type OrbFrameMode } from "./store-orb-policy";
import { stepSpring } from "./store-motion-math";

const WATER_OUTLINE =
  "M251 37C359 26 447 112 458 224C471 337 399 450 281 464C163 479 59 405 43 290C27 175 120 50 251 37Z";

/** An SSR-safe glass droplet. The SVG remains visible if WebGL is unavailable. */
export function StoreOrb({ motionEnabled }: { motionEnabled: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const motionEnabledRef = useRef(motionEnabled);
  const syncMotion = useRef<(() => void) | null>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    motionEnabledRef.current = motionEnabled;
    syncMotion.current?.();
  }, [motionEnabled]);

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
        host.dataset.renderState = "fallback";
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
          uVelocity: { value: new THREE.Vector2() },
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

        const mobileLayout = matchMedia("(max-width: 760px)");
        const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
        const showcase = host.closest("section");
        const hero = showcase?.querySelector<HTMLElement>("[data-store-hero]") ?? showcase?.querySelector("h1");
        let reducedMotion = !motionEnabledRef.current || reducedMotionQuery.matches;
        let hostVisible = true;
        let sectionVisible = true;
        let heroVisible = true;
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
        const pointerSpringX = { value: 0, velocity: 0 };
        const pointerSpringY = { value: 0, velocity: 0 };
        let scrollDrive = 0;
        let impulse = 0;
        let impulseTarget = 0;
        let scrollPosition = scrollY;
        let smoothScroll = scrollY;
        let size = host.getBoundingClientRect();

        const setRenderState = (state: OrbFrameMode | "fallback") => {
          if (host.dataset.renderState !== state) host.dataset.renderState = state;
        };

        // Shader compile failures keep the SVG visible instead of a blank canvas.
        renderer.debug.onShaderError = () => {
          shaderFailed = true;
          host.dataset.ready = "false";
          host.dataset.renderer = "fallback";
          setRenderState("fallback");
        };

        const frameMode = () => resolveOrbFrameMode({
          hostVisible, sectionVisible, heroVisible, mobile: mobileLayout.matches,
          documentHidden: document.hidden, modalOpen, reducedMotion,
          rendererUnavailable: disposed || contextLost || shaderFailed,
        });
        const canRender = () => frameMode() !== "paused";
        function draw(time: number) {
          frame = 0;
          if (!canRender()) return;
          const delta = previousTime ? Math.min((time - previousTime) / 1000, .05) : 1 / 60;
          previousTime = time;
          if (!reducedMotion) elapsed += delta;
          const follow = 1 - Math.exp(-delta * 5.5);
          smoothX = stepSpring(pointerSpringX, reducedMotion ? 0 : pointerX, 6.5, delta);
          smoothY = stepSpring(pointerSpringY, reducedMotion ? 0 : pointerY, 6.5, delta);
          smoothScroll += (scrollPosition - smoothScroll) * follow;
          scrollDrive *= Math.exp(-delta * 3.5);
          impulseTarget *= Math.exp(-delta * 2.4);
          impulse += ((reducedMotion ? 0 : impulseTarget) - impulse) * (1 - Math.exp(-delta * 8));
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uPointer.value.set(smoothX, smoothY);
          const velocity = material.uniforms.uVelocity.value;
          velocity.set(reducedMotion ? 0 : pointerSpringX.velocity * .3, reducedMotion ? 0 : pointerSpringY.velocity * .3 - scrollDrive);
          if (velocity.length() > 1) velocity.normalize();
          material.uniforms.uImpulse.value = impulse;
          droplet.rotation.set(smoothY * .085, smoothX * .14 + (reducedMotion ? 0 : Math.sin(elapsed * .18) * .12 + smoothScroll * .00009), -.06 + (reducedMotion ? 0 : Math.sin(elapsed * .23) * .045));
          droplet.position.set(reducedMotion ? 0 : smoothX * .05 + Math.sin(elapsed * .27) * .023, reducedMotion ? 0 : Math.sin(elapsed * .38) * .033 - smoothY * .035, 0);
          try {
            renderer.render(scene, camera);
          } catch {
            shaderFailed = true;
          }
          if (shaderFailed) {
            host.dataset.ready = "false";
            host.dataset.renderer = "fallback";
            setRenderState("fallback");
            return;
          }
          if (host.dataset.ready !== "true") host.dataset.ready = "true";
          if (host.dataset.renderer !== "webgl") host.dataset.renderer = "webgl";
          setRenderState(reducedMotion ? "static" : "running");
          if (!reducedMotion) frame = requestAnimationFrame(draw);
        }
        function resume() {
          cancelAnimationFrame(frame);
          frame = 0;
          previousTime = 0;
          const mode = frameMode();
          setRenderState(mode);
          if (mode !== "paused") frame = requestAnimationFrame(draw);
        }
        function resize() {
          size = host.getBoundingClientRect();
          if (!size.width || !size.height) return;
          if (hero) {
            const heroRect = hero.getBoundingClientRect();
            heroVisible = heroRect.bottom > 0 && heroRect.top < innerHeight;
          }
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
          if (frameMode() === "running") {
            impulseTarget = Math.min(.6, impulseTarget + Math.abs(next - scrollPosition) * .0005);
            scrollDrive = Math.max(-.65, Math.min(.65, scrollDrive + (next - scrollPosition) * .0015));
          } else {
            // Returning from an occluded mobile hero must not replay movement
            // accumulated while its rendering was paused.
            smoothScroll = next;
            impulse = impulseTarget = 0;
            scrollDrive = 0;
          }
          scrollPosition = next;
        }
        function onPointerLeave() { pointerX = 0; pointerY = 0; }
        function onMotionChange() {
          reducedMotion = !motionEnabledRef.current || reducedMotionQuery.matches;
          impulseTarget = 0;
          if (reducedMotion) {
            smoothX = smoothY = impulse = scrollDrive = 0;
            pointerSpringX.value = pointerSpringY.value = 0;
            pointerSpringX.velocity = pointerSpringY.velocity = 0;
          }
          resume();
        }
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
            if (entry.target === hero) heroVisible = entry.isIntersecting;
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
        if (hero) intersectionObserver.observe(hero);
        dialogObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
        syncMotion.current = onMotionChange;
        mobileLayout.addEventListener("change", resize);
        reducedMotionQuery.addEventListener("change", onMotionChange);
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
          syncMotion.current = null;
          mobileLayout.removeEventListener("change", resize);
          reducedMotionQuery.removeEventListener("change", onMotionChange);
          document.removeEventListener("visibilitychange", resume);
          document.removeEventListener("pointerleave", onPointerLeave);
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("scroll", onScroll);
          canvas.removeEventListener("webglcontextlost", onContextLost);
          canvas.removeEventListener("webglcontextrestored", onContextRestored);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
          delete host.dataset.ready;
          delete host.dataset.renderState;
        };
        resize();
      } catch {
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
        host.dataset.renderer = "fallback";
        host.dataset.renderState = "fallback";
        delete host.dataset.ready;
      }
    }

    void createDroplet().catch(() => {
      if (!disposed) { host.dataset.renderer = "fallback"; host.dataset.renderState = "fallback"; }
    });
    return () => { disposed = true; destroyScene?.(); };
  }, []);

  return (
    <div ref={hostRef} className={styles.orb} data-motion={motionEnabled ? "full" : "reduced"} aria-hidden="true">
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
