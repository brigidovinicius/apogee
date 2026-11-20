"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

export function CheckoutSubmit() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setPending(false); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return <button data-ap-button="checkout" type="submit" disabled={pending} aria-busy={pending} onClick={event => {
    const form = event.currentTarget.form;
    if (!form || pending || !form.reportValidity()) return;
    event.preventDefault();
    setPending(true);
    form.requestSubmit();
  }}>{pending ? "Abrindo checkout…" : "Assinar agora"}{pending ? <LoaderCircle size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}</button>;
}
