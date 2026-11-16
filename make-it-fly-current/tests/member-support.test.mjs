import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("support remains public through both proxy and page when signed out or authentication fails", async () => {
  const decisions = [];
  const proxy = opportunityLoader({
    "better-auth/cookies": { getSessionCookie: () => null },
    "next/server": { NextResponse: { next: () => "public", redirect: url => { decisions.push(url); return "login"; } } },
  })("proxy.ts").proxy;
  assert.equal(proxy({ nextUrl: new URL("https://apogee.test/membros/suporte"), url: "https://apogee.test/membros/suporte" }), "public");
  assert.equal(proxy({ nextUrl: new URL("https://apogee.test/membros/assinatura"), url: "https://apogee.test/membros/assinatura" }), "login");
  assert.equal(decisions[0].searchParams.get("next"), "/membros/assinatura");
  for (const getCurrentMember of [async () => null, async () => { throw Error("synthetic auth failure"); }]) {
    const page = opportunityLoader({
      "next/link": { __esModule: true, default: "a" },
      "@/lib/members/dal": { getCurrentMember },
      "@/components/members/member-bar": { MemberBar: () => { throw Error("must not render private navigation"); } },
    })("app/membros/suporte/page.tsx").default;
    const html = renderToStaticMarkup(await page());
    assert.match(html, /mailto:contato@apogee.community/);
    assert.match(html, /sem entrar na plataforma/);
    assert.match(html, /interromper avisos/);
    assert.doesNotMatch(html, /synthetic auth failure|Assinatura ativa/);
  }
});
