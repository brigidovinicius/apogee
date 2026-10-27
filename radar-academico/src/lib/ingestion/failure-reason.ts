/** Fixed diagnostic labels only: never persist arbitrary server errors or URLs. */
export function ingestionFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/robots/i.test(message)) return "robots_unavailable_or_disallowed";
  if (/URL fora|rede não permit|Destino de rede/i.test(message)) return "url_or_network_disallowed";
  if (/redirecionamento/i.test(message)) return "redirect_disallowed_or_exhausted";
  if (/limite|limites/i.test(message)) return "response_limit_exceeded";
  if (/Evidência|comprova|confirmad|Prazo|prazo|edição|edital|ambígu/i.test(message)) return "evidence_changed_or_unconfirmed";
  const http = /Fonte oficial indisponível \(HTTP (\d{3})\)/.exec(message);
  if (http) return `http_${http[1]}`;
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    const code = "code" in current ? current.code : null;
    if (code === "ABORT_ERR" || code === "ETIMEDOUT") return "request_timeout";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns_failure";
    if (typeof code === "string" && /^(?:CERT_|ERR_TLS_|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_)/.test(code)) return "tls_verification_failed";
    current = current.cause;
  }
  return "source_request_failed";
}
