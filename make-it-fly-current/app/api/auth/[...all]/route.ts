import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/members/auth";
import { memberClientIp } from "@/lib/members/client-ip";
import { reportAuthTrustRejection } from "@/lib/members/auth-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler((request) => {
  // Sem IP confiável o limitador do provedor não roda. Recusar antes de inicializar auth/banco.
  if (!memberClientIp(request.headers)) {
    const id = reportAuthTrustRejection(request);
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (id) headers.set("X-Apogee-Error-Id", id);
    return Promise.resolve(Response.json({ message: "Autenticação temporariamente indisponível." }, {
      status: 503, headers,
    }));
  }
  return getAuth().handler(request);
});
