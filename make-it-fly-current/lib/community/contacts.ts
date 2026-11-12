import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";
import type { ContactCampaign } from "./consent";

const contactSchema = z.strictObject({
  campaign: z.literal("codex"),
  name: z.string().trim().min(2, "Informe seu nome.").max(100).regex(/^[^\p{C}]+$/u, "Confira seu nome."),
  email: z.string().trim().toLowerCase().max(254).email("Informe um e-mail válido."),
  goal: z.string().trim().max(600).refine(value => !value.includes("\0")).optional().default(""),
  consent: z.literal(true, { error: "Autorize o aviso por e-mail para continuar." }),
  website: z.string().max(200).optional(),
});

export type CommunityContact = { campaign: ContactCampaign; name: string; email: string; goal: string };
type Dependencies = {
  allowedOrigins: string[];
  secret: string;
  clientIp: (headers: Headers) => string | null;
  consumeLimit: (key: string, max: number, seconds: number) => Promise<boolean>;
  save: (contact: CommunityContact) => Promise<void>;
};
const respond = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});

export async function handleCommunityContact(request: Request, deps: Dependencies): Promise<Response> {
  if (!deps.allowedOrigins.includes(request.headers.get("origin") ?? "") || request.headers.get("sec-fetch-site") === "cross-site") {
    return respond({ message: "Origem da solicitação não permitida." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return respond({ message: "Envie os dados em JSON." }, 415);
  }
  try {
    let body: unknown;
    try { body = JSON.parse((await readRequestBody(request, 8192)).toString("utf8")); }
    catch (error) {
      return respond({ message: error instanceof RequestBodyError ? error.message : "Solicitação inválida." }, error instanceof RequestBodyError ? error.status : 400);
    }
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) return respond({ message: parsed.error.issues[0]?.message ?? "Confira os dados informados." }, 400);
    if (parsed.data.website) return respond({ ok: true });
    const ip = deps.clientIp(request.headers);
    if (!ip || deps.secret.length < 32) return respond({ message: "Cadastro indisponível no momento. Tente novamente mais tarde." }, 503);
    const digest = (kind: string, value: string) => createHmac("sha256", deps.secret).update(`community-contact:${kind}:${value}`).digest("hex");
    const limits: [string, number][] = [
      [`community-contact:ip:${digest("ip", ip)}`, 12],
      [`community-contact:email:${digest("email", parsed.data.email)}`, 3],
      ["community-contact:global", 500],
    ];
    for (const [key, max] of limits) {
      if (!await deps.consumeLimit(key, max, 3600)) return respond({ message: "Muitas tentativas. Aguarde um pouco e tente novamente." }, 429);
    }
    const { campaign, name, email, goal } = parsed.data;
    await deps.save({ campaign, name, email, goal });
    return respond({ ok: true });
  } catch {
    // Contacts, answers, database errors and secrets never enter the logs or response.
    return respond({ message: "Não foi possível salvar seu pedido agora. Tente novamente." }, 503);
  }
}
