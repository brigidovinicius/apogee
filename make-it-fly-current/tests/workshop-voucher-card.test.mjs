import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader({
  "next/link": ({ children, href, className }) => createElement("a", { href, className }, children),
  "next/image": ({ src, alt }) => createElement("img", { src, alt }),
});
const { WorkshopVoucherCard } = load("components/workshop-voucher/card.tsx");
const { VOUCHER_PATH } = load("lib/workshop-voucher/input.ts");
const brands = load("content/benefit-brands.json");

function useVoucherKey(t, value) {
  const old = process.env.WORKSHOP_VOUCHER_KEY;
  t.after(() => {
    if (old === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
    else process.env.WORKSHOP_VOUCHER_KEY = old;
  });
  if (value === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
  else process.env.WORKSHOP_VOUCHER_KEY = value;
}

test("the OpenAI brand is registered with a local image", () => {
  const brand = brands.OpenAI;
  assert.equal(brand?.image, "/brand/benefits/openai.png");
  assert.match(brand.source, /^https:\/\/(?:openai\.com|t0\.gstatic\.com)\//);
  assert.ok(["light", "dark"].includes(brand.background));
  assert.ok(existsSync(new URL(`../public${brand.image}`, import.meta.url)));
});

test("the voucher card follows the benefit card layout with the OpenAI mark", t => {
  useVoucherKey(t, "8c".repeat(32));
  const html = renderToStaticMarkup(createElement(WorkshopVoucherCard));
  assert.match(html, /class="card offerCard"/);
  assert.ok(html.includes('src="/brand/benefits/openai.png"'));
  assert.ok(html.includes("<p>OpenAI</p>"));
  assert.ok(html.includes("Evento · Codex Community Workshop"));
  assert.ok(html.includes(`<a href="${VOUCHER_PATH}">Voucher OpenAI</a>`));
  assert.ok(html.includes("<strong>Quem pode resgatar</strong>"));
  assert.ok(html.includes(`<a href="${VOUCHER_PATH}" class="offerLink">Acessar meu voucher</a>`));
  assert.ok(!html.includes("Salvar"));
});

test("the voucher card stays hidden without the voucher key", t => {
  useVoucherKey(t, undefined);
  assert.equal(renderToStaticMarkup(createElement(WorkshopVoucherCard)), "");
});
