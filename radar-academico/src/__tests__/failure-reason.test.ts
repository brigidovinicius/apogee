import { expect, it } from "vitest";
import { ingestionFailureReason } from "@/lib/ingestion/failure-reason";

it.each([
  ["robots.txt indisponível para revisão","robots_unavailable_or_disallowed"],
  ["Acesso bloqueado por robots.txt","robots_unavailable_or_disallowed"],
  ["URL fora do registro oficial","url_or_network_disallowed"],
  ["Limite de redirecionamentos ou destino inválido","redirect_disallowed_or_exhausted"],
  ["Resposta da fonte fora dos limites","response_limit_exceeded"],
  ["Disponibilidade sem comprovação","evidence_changed_or_unconfirmed"],
  ["Fonte oficial indisponível (HTTP 404)","http_404"],
])("classifies a known failure without persisting arbitrary text: %s", (message,reason) => {
  expect(ingestionFailureReason(new Error(message))).toBe(reason);
});

it.each([["ABORT_ERR","request_timeout"],["ENOTFOUND","dns_failure"],["CERT_HAS_EXPIRED","tls_verification_failed"]])(
  "preserves the transport category through safe error wrappers: %s", (code,reason) => {
    const cause=Object.assign(new Error("private response body"),{code});
    expect(ingestionFailureReason(new Error("Falha ao consultar fonte oficial",{cause}))).toBe(reason);
  });

it("never stores raw upstream errors, query strings, credentials or response bodies", () => {
  const sensitive="postgres://private:secret@internal/api?token=secret upstream-private-body";
  expect(ingestionFailureReason(new Error(sensitive))).toBe("source_request_failed");
  expect(ingestionFailureReason(sensitive)).toBe("source_request_failed");
});
