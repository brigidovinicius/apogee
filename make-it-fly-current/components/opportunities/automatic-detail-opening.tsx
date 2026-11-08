"use client";

import { useEffect, useRef } from "react";
import { flushBehavior, trackBehavior } from "@/components/analytics/behavior-client";

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
      if (checkout) { trackBehavior("action", "checkout_start"); void flushBehavior(); }
      form.current.requestSubmit();
    }
  }, [checkout]);

  return <form ref={form} action={action} method={typeof action === "string" ? "post" : undefined} data-radar-detail-opening>
    <p role="status">{checkout ? "Abrindo checkout…" : "Abrindo detalhes…"}</p>
    <noscript><button type="submit">{checkout ? "Ir para pagamento" : "Ver detalhes"}</button></noscript>
  </form>;
}
