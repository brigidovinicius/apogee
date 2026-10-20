import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";

export { DROP_CONSENT_TEXT, DROP_CONSENT_VERSION } from "./drop-consent";
const signupSchema = z.strictObject({
  name: z.string().trim().min(2, "Informe seu nome.").max(120).regex(/^[^\p{C}]+$/u, "Confira seu nome."),
  phone: z.string().trim().max(32).regex(/^\+?[0-9() .-]+$/, "Informe um telefone válido, com DDD.").transform(value => value.replace(/[^0-9+]/g, "")).refine(value => /^\+?[0-9]{10,15}$/.test(value), "Informe um telefone válido, com DDD."),
  email: z.string().trim().toLowerCase().max(254).email("Informe um e-mail válido."),
  consent: z.literal(true, { error: "Autorize o recebimento das novidades para se cadastrar." }),
  website: z.string().max(200).optional(),
});
export type DropSignup = Omit<z.infer<typeof signupSchema>, "website" | "consent">;
type Dependencies = {
  allowedOrigins: string[];
  secret: string;
  clientIp: (headers: Headers) => string | null;
  consumeLimit: (key: string, max: number, seconds: number) => Promise<boolean>;
  save: (signup: DropSignup) => Promise<void>;
};
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

export async function handleDropSignup(request: Request, deps: Dependencies): Promise<Response> {
  if (!deps.allowedOrigins.includes(request.headers.get("origin") ?? "") || request.headers.get("sec-fetch-site") === "cross-site") return respond({ message: "Origem da solicitação não permitida." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return respond({ message: "Envie os dados em JSON." }, 415);
  try {
    let body: unknown;
    try { body = JSON.parse((await readRequestBody(request, 4096)).toString("utf8")); }
    catch (error) {
      if (error instanceof RequestBodyError) return respond({ message: error.message }, error.status);
      return respond({ message: "Solicitação inválida." }, 400);
    }
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) return respond({ message: parsed.error.issues[0]?.message ?? "Confira os dados informados." }, 400);
    if (parsed.data.website) return respond({ ok: true });
    const ip = deps.clientIp(request.headers);
    if (!ip || deps.secret.length < 32) return respond({ message: "Cadastro indisponível no momento. Tente novamente mais tarde." }, 503);
    const digest = (kind: string, value: string) => createHmac("sha256", deps.secret).update(`store-drops:${kind}:${value}`).digest("hex");
    if (!await deps.consumeLimit(`store-drops:ip:${digest("ip", ip)}`, 10, 3600)) return respond({ message: "Muitas tentativas. Aguarde um pouco e tente novamente." }, 429);
    if (!await deps.consumeLimit(`store-drops:email:${digest("email", parsed.data.email)}`, 3, 3600)) return respond({ message: "Muitas tentativas. Aguarde um pouco e tente novamente." }, 429);
    if (!await deps.consumeLimit("store-drops:global", 200, 3600)) return respond({ message: "Muitas tentativas. Aguarde um pouco e tente novamente." }, 429);
    const { name, phone, email } = parsed.data;
    await deps.save({ name, phone, email });
    return respond({ ok: true });
  } catch {
    // Never log names, contacts, request bodies, database errors or secrets.
    return respond({ message: "Não foi possível salvar seu cadastro agora. Tente novamente." }, 503);
  }
}
