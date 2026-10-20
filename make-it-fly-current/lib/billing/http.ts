import "server-only";
import { BillingError } from "./config";

export function billingResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export function billingFailure(error: unknown) {
  if (error instanceof BillingError) return billingResponse({ message: error.message }, error.status);
  console.error("[radar-billing] operação não concluída");
  return billingResponse({ message: "Não foi possível concluir agora. Tente novamente." }, 503);
}

// Corpo bruto obrigatório para a assinatura, limitado mesmo sem Content-Length.
export async function webhookBody(request: Request, maxBytes = 262144, timeoutMs = 5000) {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new BillingError(413, "Evento excede o limite.");
  if (!request.body) throw new BillingError(400, "Evento inválido.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = performance.now() + timeoutMs;
  const budget = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new BillingError(408, "Tempo excedido.")), timeoutMs); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), budget]);
      if (request.signal.aborted || performance.now() >= deadline) throw new BillingError(408, "Tempo excedido.");
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new BillingError(413, "Evento excede o limite.");
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
