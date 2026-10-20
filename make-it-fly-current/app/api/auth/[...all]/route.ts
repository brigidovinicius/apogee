import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/members/auth";
import { memberClientIp } from "@/lib/members/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler((request) => {
  // Sem IP confiável o limitador do provedor não roda. Recusar antes de inicializar auth/banco.
  if (!memberClientIp(request.headers)) {
    return Promise.resolve(Response.json({ message: "Autenticação temporariamente indisponível." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    }));
  }
  return getAuth().handler(request);
});
