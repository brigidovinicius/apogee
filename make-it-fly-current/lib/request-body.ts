import "server-only";

export class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// Absolute budgets for the entire stream, never reset by individual chunks.
export const JSON_BODY_TIMEOUT_MS = 5_000;
export const UPLOAD_BODY_TIMEOUT_MS = 30_000;

export async function readRequestBody(request: Request, maxBytes: number, timeoutMs = JSON_BODY_TIMEOUT_MS): Promise<Buffer<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    void request.body?.cancel().catch(() => {});
    throw new RequestBodyError(413, "Solicitação excede o tamanho permitido.");
  }
  if (!request.body) throw new RequestBodyError(400, "Solicitação inválida.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const deadline = performance.now() + timeoutMs;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new RequestBodyError(400, "Envio interrompido."));
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => reject(new RequestBodyError(408, "Tempo de envio excedido. Tente novamente.")), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (request.signal.aborted) throw new RequestBodyError(400, "Envio interrompido.");
      // Also enforce the budget when continuous chunks delay the timer callback.
      if (performance.now() >= deadline) throw new RequestBodyError(408, "Tempo de envio excedido. Tente novamente.");
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new RequestBodyError(413, "Solicitação excede o tamanho permitido.");
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    // A broken source can hang or reject cancel(); never await its cleanup.
    void reader.cancel().catch(() => {});
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Não foi possível ler o envio.");
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
