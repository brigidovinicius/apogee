import "server-only";
import { randomUUID } from "node:crypto";

export function applicationOrigin(): string {
  const url = new URL(process.env.BETTER_AUTH_URL ?? "");
  const localHttp = url.protocol === "http:" && (
    (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)) ||
    (process.env.APOGEE_LOCAL_PREVIEW === "1" && url.origin === "http://127.0.0.1:4381")
  );
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !localHttp)) {
    throw new Error("Origem confiável da aplicação inválida.");
  }
  return url.origin;
}

export function memberMailAvailable(): boolean {
  return process.env.MEMBERS_EMAIL_ENABLED === "true" &&
    process.env.MEMBERS_RESEND_DOMAIN_VERIFIED === "true" &&
    /^re_[A-Za-z0-9_-]{10,}$/.test(process.env.MEMBERS_RESEND_API_KEY ?? "") &&
    process.env.MEMBERS_RESEND_FROM === "contato@apogee.community";
}

// Mesmo provedor e contrato de envio do Radar; texto puro, sem nomes interpretados.
// provider_accepted significa submissão confirmada, nunca entrega à caixa.
export async function sendMemberMail(message: { to: string; subject: string; text: string; key?: string }): Promise<void> {
  if (!memberMailAvailable()) throw new Error("Envio de e-mail indisponível.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.MEMBERS_RESEND_API_KEY}`, "Content-Type": "application/json",
      "Idempotency-Key": `members-${message.key ?? randomUUID()}` },
    body: JSON.stringify({ from: `Apogee <${process.env.MEMBERS_RESEND_FROM}>`, to: [message.to], subject: message.subject, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Envio não confirmado pelo provedor.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id) {
    throw new Error("Envio não confirmado pelo provedor.");
  }
}
