import type { MotionValue } from "framer-motion";

type SignatureState = "loading" | "playing" | "waiting" | "blocked";

export function resolveSignatureMode({ reducedMotion, touch, saveData }: {
  reducedMotion: boolean; touch: boolean; saveData: boolean;
}) {
  if (reducedMotion) return "static";
  return touch || saveData ? "lightweight" : "video";
}

// O início de cada passagem fica a 10s do anterior: 8s de brilho e 2s de repouso.
export function startSignatureLoop(media: HTMLVideoElement, onState: (state: SignatureState) => void) {
  let disposed = false;
  let pending = false;
  let blocked = false;
  let visible = true;
  let timer = 0;
  let startedAt: number | null = null;
  media.muted = media.defaultMuted = true;
  media.playsInline = true;

  function stop() {
    window.clearTimeout(timer);
    timer = 0;
    media.pause();
  }
  function play() {
    if (disposed || pending || document.hidden || !visible) return;
    pending = true;
    void media.play().catch((error: unknown) => {
      if (disposed) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      blocked = true;
      onState("blocked");
    }).finally(() => { pending = false; });
  }
  function restart() {
    startedAt = null;
    media.currentTime = 0;
    play();
  }
  function playing() {
    if (disposed || document.hidden || !visible) { media.pause(); return; }
    blocked = false;
    startedAt ??= performance.now();
    onState("playing");
  }
  function ended() {
    onState("waiting");
    window.clearTimeout(timer);
    const elapsed = performance.now() - (startedAt ?? performance.now());
    if (!document.hidden && visible) timer = window.setTimeout(restart, Math.max(0, 10_000 - elapsed));
  }
  function visibility() {
    if (document.hidden) stop();
    else if (visible) restart();
  }
  function retry() { if (blocked) play(); }
  const observer = new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (!visible) stop();
    else if (!wasVisible) restart();
  });
  observer.observe(media);
  media.addEventListener("playing", playing);
  media.addEventListener("ended", ended);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("touchend", retry, { passive: true });
  window.addEventListener("pointerup", retry, { passive: true });
  window.addEventListener("keydown", retry);
  play();
  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    media.removeEventListener("playing", playing);
    media.removeEventListener("ended", ended);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("touchend", retry);
    window.removeEventListener("pointerup", retry);
    window.removeEventListener("keydown", retry);
  };
}

export function startEarthScrubbing(
  media: HTMLVideoElement,
  progress: Pick<MotionValue<number>, "get" | "on">,
  onReady: () => void,
  onBlocked: (blocked: boolean) => void,
) {
  let disposed = false;
  let frame = 0;
  let pending = false;
  let initialized = false;
  media.muted = media.defaultMuted = true;
  media.playsInline = true;

  function sync() {
    frame = 0;
    // Safari pode disponibilizar só metadata até o primeiro play/seek.
    if (disposed || media.readyState < 1 || !Number.isFinite(media.duration) || media.seeking) return;
    const target = Math.min(1, Math.max(0, progress.get())) * Math.max(0, media.duration - 1 / 30);
    if (Math.abs(media.currentTime - target) > 1 / 60) media.currentTime = target;
  }
  function schedule() { if (!frame) frame = window.requestAnimationFrame(sync); }
  function decoded() {
    if (disposed) return;
    if (media.readyState >= 2) { onReady(); onBlocked(false); }
    schedule();
  }
  function activate() {
    if (disposed || initialized || pending || document.hidden) return;
    pending = true;
    // Um play silencioso inicial libera a decodificação no Safari/iPhone.
    // Só depois o vídeo fica pausado e a rolagem assume o controle.
    void media.play().then(() => {
      if (disposed) return;
      initialized = true;
      media.pause();
      onBlocked(false);
      decoded();
    }).catch((error: unknown) => {
      if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
      onBlocked(true);
    }).finally(() => { pending = false; });
  }
  function visibility() {
    if (document.hidden) media.pause();
    else { activate(); schedule(); }
  }
  const unsubscribe = progress.on("change", schedule);
  media.addEventListener("loadedmetadata", schedule);
  media.addEventListener("loadeddata", decoded);
  media.addEventListener("seeked", decoded);
  media.addEventListener("canplay", decoded);
  document.addEventListener("visibilitychange", visibility);
  // Se a política do aparelho negar autoplay, tentar no próximo gesto real.
  window.addEventListener("touchend", activate, { passive: true });
  window.addEventListener("pointerup", activate, { passive: true });
  window.addEventListener("keydown", activate);
  activate();
  schedule();
  return {
    activate,
    dispose() {
      disposed = true;
      unsubscribe();
      window.cancelAnimationFrame(frame);
      media.pause();
      media.removeEventListener("loadedmetadata", schedule);
      media.removeEventListener("loadeddata", decoded);
      media.removeEventListener("seeked", decoded);
      media.removeEventListener("canplay", decoded);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("touchend", activate);
      window.removeEventListener("pointerup", activate);
      window.removeEventListener("keydown", activate);
    },
  };
}
