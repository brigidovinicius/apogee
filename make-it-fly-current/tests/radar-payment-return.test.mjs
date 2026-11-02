import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("a return awaiting the webhook cannot offer another purchase or grant access from the URL", async () => {
  let active = false;
  const Page = opportunityLoader({
    "@/lib/members/dal": { requireSignedInMember: async () => ({ id: "pending-buyer" }) },
    "@/lib/billing/config": { RADAR_ACCESS_PATH: "/membros/radar/acesso", radarBillingEnabled: () => true, billingConfig: () => ({ livemode: false }) },
    "@/lib/billing/store": { radarAccess: async () => ({ active }), radarPurchaseNeedsVerification: async () => false },
    "@/components/members/payment-confirmation": { PaymentConfirmation: () => React.createElement("p", null, "Aguardando a confirmação") },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  })("app/membros/radar/acesso/page.tsx").default;
  const render = params => Page({ searchParams: Promise.resolve({ next: "/membros/oportunidades/second", ...params }) }).then(renderToStaticMarkup);
  let html = await render({ payment: "received" });
  assert.match(html, /Aguardando a confirmação/);
  assert.doesNotMatch(html, /Comprar acesso vitalício|Seu acesso ao Radar está liberado/);
  html = await render({ payment: "cancelled" });
  assert.match(html, /O checkout foi encerrado/);
  assert.match(html, /Comprar acesso vitalício/);
  active = true;
  html = await render({ payment: "received" });
  assert.match(html, /Seu acesso ao Radar está liberado/);
  assert.match(html, /href="\/membros\/oportunidades\/second"/);
  assert.doesNotMatch(html, /Comprar acesso vitalício|Aguardando a confirmação/);
});
