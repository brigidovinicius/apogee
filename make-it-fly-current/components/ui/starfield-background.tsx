"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Warp da abertura. A animacao pausa quando sai da primeira tela ou quando a
 * aba fica oculta, evitando competir com o WebGL da lua durante todo o site.
 */
export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ctx = context;
    let frame = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let stars: Star[] = [];
    let speed = prefersReducedMotion ? 0.55 : 1.8;
    let visible = true;

    class Star {
      x = 0;
      y = 0;
      z = 1;
      previousZ = 1;

      constructor() {
        this.reset(Math.random() * viewportWidth);
      }

      reset(z = viewportWidth) {
        this.x = Math.random() * viewportWidth - viewportWidth / 2;
        this.y = Math.random() * viewportHeight - viewportHeight / 2;
        this.z = Math.max(1, z);
        this.previousZ = this.z;
      }

      update() {
        this.z -= speed;
        if (this.z < 1) this.reset();
      }

      draw() {
        const centerX = viewportWidth / 2;
        const centerY = viewportHeight / 2;
        const sx = (this.x / this.z) * centerX + centerX;
        const sy = (this.y / this.z) * centerX + centerY;
        const px = (this.x / this.previousZ) * centerX + centerX;
        const py = (this.y / this.previousZ) * centerX + centerY;
        const depth = 1 - this.z / viewportWidth;

        this.previousZ = this.z;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.lineWidth = Math.max(0.3, depth * 2.15);
        ctx.strokeStyle = `rgba(214, 232, 255, ${Math.max(0, depth * 0.82)})`;
        ctx.stroke();
      }
    }

    const resize = () => {
      viewportWidth = canvas.clientWidth || window.innerWidth;
      viewportHeight = canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(viewportWidth * dpr);
      canvas.height = Math.round(viewportHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = prefersReducedMotion
        ? 150
        : viewportWidth < 640
          ? 300
          : 580;
      stars = Array.from({ length: density }, () => new Star());
      paint();
    };

    const paint = () => {
      ctx.fillStyle = "rgba(2, 8, 23, 0.24)";
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      for (const star of stars) {
        star.update();
        star.draw();
      }
    };

    const animate = () => {
      if (!visible || document.hidden) {
        frame = 0;
        return;
      }
      paint();
      frame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (!frame && visible && !document.hidden) {
        frame = requestAnimationFrame(animate);
      }
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const distance = Math.abs(event.clientX - window.innerWidth / 2);
      const proximity = 1 - Math.min(1, distance / (window.innerWidth / 2));
      speed = 1.8 + proximity * 11;
    };

    const handleScroll = () => {
      const fade = Math.max(
        0,
        Math.min(1, 1 - window.scrollY / Math.max(window.innerHeight, 1))
      );
      canvas.style.opacity = String(fade);
      visible = fade > 0.01;
      if (visible) start();
      else stop();
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
    }

    resize();
    handleScroll();
    start();

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full bg-flight-ink"
    />
  );
}

export default StarfieldBackground;
