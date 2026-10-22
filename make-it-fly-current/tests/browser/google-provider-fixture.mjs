// Browser history fixture only. Identity is subsequently verified by the real
// local Better Auth password form and PostgreSQL, never by this provider page.
import { createServer } from "node:http";

const origin = "http://127.0.0.1:4381";
const providerOrigin = "http://127.0.0.1:4384";
const completionPath = "/membros/entrar/google/concluir";
const escape = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function createGoogleProviderFixture() {
  const provider = createServer((req, res) => {
    const url = new URL(req.url, providerOrigin);
    const completion = new URL(url.searchParams.get("completion") || "/", origin);
    if (url.pathname !== "/authorize" || completion.origin !== origin || completion.pathname !== completionPath) {
      res.writeHead(404); res.end(); return;
    }
    const login = `${origin}/membros/entrar?next=${encodeURIComponent(completion.pathname + completion.search)}`;
    completion.searchParams.set("error", "access_denied");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
      "cross-origin-opener-policy": "same-origin" });
    res.end(`<!doctype html><html lang="pt-BR"><title>Provedor Google simulado</title>
      <h1>Google simulado para teste local</h1><p>A autenticação seguinte usa a sessão real do backend local.</p>
      <p><a href="${escape(login)}">Continuar para autenticação local</a></p>
      <p><a href="${escape(completion.href)}">Cancelar autorização</a></p></html>`);
  });
  async function handle(req, res) {
    const url = new URL(req.url, origin);
    if (url.pathname === "/__preview/google/start") {
      res.writeHead(302, { location: `${providerOrigin}/authorize?${url.searchParams}`, "cache-control": "no-store" });
      res.end(); return true;
    }
    if (url.pathname !== "/api/auth/sign-in/social" || req.method !== "POST") return false;
    try {
      if (req.headers.origin !== origin) throw Error();
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 8192) throw Error(); }
      const input = JSON.parse(body);
      const completion = new URL(input.callbackURL, origin);
      if (input.provider !== "google" || input.disableRedirect !== true || input.requestSignUp
        || completion.origin !== origin || completion.pathname !== completionPath) throw Error();
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ url: `${origin}/__preview/google/start?completion=${encodeURIComponent(completion.pathname + completion.search)}`, redirect: false }));
    } catch { res.writeHead(400); res.end(); }
    return true;
  }
  return { provider, handle };
}
