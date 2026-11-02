"use client";

import { useEffect, useRef } from "react";

type Props = {
  action: string | (() => Promise<void>);
  checkout?: boolean;
};

// Mounting follows an actual navigation. Fetching/prefetching the page alone
// cannot claim the free opportunity or create a Stripe Checkout Session.
export function AutomaticDetailOpening({ action, checkout = false }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (form.current && !submitted.current) {
      submitted.current = true;
      form.current.requestSubmit();
    }
  }, []);

  return <form ref={form} action={action} method={typeof action === "string" ? "post" : undefined} data-radar-detail-opening>
    <p role="status">{checkout ? "Abrindo checkout…" : "Abrindo detalhes…"}</p>
    <noscript><button type="submit">{checkout ? "Ir para pagamento" : "Ver detalhes"}</button></noscript>
  </form>;
}
