import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("institutional shell is reused by the first public and member routes", async () => {
  const [home, preview, homeContent, opportunities, membersLayout, header, footer] = await Promise.all([
    source("app/page.tsx"),
    source("app/home-robonauta/page.tsx"),
    source("components/home/apogee-home.tsx"),
    source("app/oportunidades/page.tsx"),
    source("app/membros/layout.tsx"),
    source("components/site/site-header.tsx"),
    source("components/site/site-footer.tsx"),
  ]);

  for (const route of [home, preview]) {
    assert.match(route, /import \{ ApogeeHome \} from "@\/components\/home\/apogee-home"/);
    assert.match(route, /return <ApogeeHome \/>/);
  }

  for (const route of [homeContent, opportunities, membersLayout]) {
    assert.match(route, /<SiteHeader/);
    assert.match(route, /<SiteFooter/);
  }

  assert.match(homeContent, /<SiteHeader current="home" tone="light" \/>/);
  assert.match(homeContent, /<Robonauta \/>/);
  assert.match(homeContent, /<main id="experiencia" tabIndex=\{-1\}>/);
  assert.doesNotMatch(homeContent, /^["']use client["']/);

  assert.match(header, /<details className=\{styles\.mobileNavigation\}>/);
  assert.match(header, /aria-label="Abrir navegação"/);
  assert.match(header, /aria-current=\{item\.section === current \? "page" : undefined\}/);
  assert.match(footer, /aria-label="Navegação do rodapé"/);
  assert.match(opportunities, /memberHref="\/membros\/entrar\?next=%2Fmembros%2Foportunidades"/);
});

test("shell keeps keyboard focus and mobile motion behavior in shared styles", async () => {
  const styles = await source("components/site/site-shell.module.css");

  assert.match(styles, /\.header a:focus-visible/);
  assert.match(styles, /\.mobileNavigation summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /--apogee-control-min-height/);
});
