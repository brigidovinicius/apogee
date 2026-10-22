import { safeNextPath } from "./validation";
import { googleOAuthErrorMessage } from "./social-auth";

export const GOOGLE_COMPLETION_PATH = "/membros/entrar/google/concluir";
const START_ERROR = "Não foi possível iniciar a entrada com Google. Tente novamente.";

export function googleLoginDestination(value: string) {
  const next = safeNextPath(value);
  const path = new URL(next, "https://apogee.invalid").pathname;
  return path === "/membros/entrar" || path.startsWith("/membros/entrar/") || path === "/membros/cadastro"
    ? "/membros" : next;
}

export function googleCompletionPath(next: string) {
  return `${GOOGLE_COMPLETION_PATH}?next=${encodeURIComponent(googleLoginDestination(next))}`;
}

type Popup = { location: { replace(url: string): void }; close(): void };
type SocialOptions = {
  provider: "google"; disableRedirect: true; callbackURL: string;
  newUserCallbackURL?: string; errorCallbackURL: string; requestSignUp: boolean;
};
type Ports = {
  origin: string;
  open(): Popup | null;
  signIn(options: SocialOptions): Promise<{ data?: { url?: string } | null; error?: { code?: string } | null }>;
  hasSession(): Promise<boolean>;
  replace(path: string): void;
  message(text: string): void;
  finish(): void;
  now(): number;
  schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clear(timer: ReturnType<typeof setTimeout>): void;
};

/** Keep provider documents out of the originating tab's browser history. */
export function createGoogleLoginFlow(ports: Ports, next: string, requestSignUp = false) {
  let active = true;
  let started = false;
  let popup: Popup | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0;
  const destination = googleLoginDestination(next);

  function stop(message?: string) {
    if (!active) return;
    active = false;
    if (timer !== undefined) ports.clear(timer);
    // Google may sever this reference through COOP. Never depend on opener or closed.
    try { popup?.close(); } catch { /* The completion page also offers closing. */ }
    if (message) ports.message(message);
    ports.finish();
  }

  async function poll() {
    if (!active) return;
    let authenticated = false;
    try { authenticated = await ports.hasSession(); } catch { /* Retry transient failures. */ }
    if (!active) return;
    if (authenticated) {
      stop();
      // Full navigation revalidates membership, onboarding and admin permissions server-side.
      ports.replace(destination);
    } else if (ports.now() >= deadline) {
      stop("A entrada com Google não foi concluída. Tente novamente.");
    } else {
      timer = ports.schedule(() => { void poll(); }, 2000);
    }
  }

  return {
    start() {
      if (started || !active) return;
      started = true;
      // Synchronous with the click, before the API request, to respect popup blockers.
      popup = ports.open();
      if (!popup) { stop("Permita a janela de entrada do Google e tente novamente."); return; }
      deadline = ports.now() + 5 * 60_000;
      const completion = googleCompletionPath(destination);
      void ports.signIn({
        provider: "google", disableRedirect: true, callbackURL: completion,
        newUserCallbackURL: requestSignUp ? completion : undefined,
        errorCallbackURL: completion, requestSignUp,
      }).then(result => {
        if (!active) return;
        if (result.error) { stop(googleOAuthErrorMessage(result.error.code) ?? START_ERROR); return; }
        try {
          const url = new URL(result.data?.url ?? "");
          if (url.origin !== "https://accounts.google.com" && url.origin !== ports.origin) throw new Error("Invalid provider origin");
          popup!.location.replace(url.href);
          void poll();
        } catch { stop(START_ERROR); }
      }).catch(() => { stop(START_ERROR); });
    },
    cancel() { stop(); },
  };
}
