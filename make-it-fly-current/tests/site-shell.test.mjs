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

  assert.match(home, /import \{ EditorialHome \} from "@\/components\/home\/editorial-home"/);
  assert.match(home, /<EditorialHome \/>/);
  for (const route of [preview]) {
    assert.match(route, /import \{ ApogeeHome \} from "@\/components\/home\/apogee-home"/);
    assert.match(route, /<ApogeeHome \/>/);
  }

  const editorial = await source("components/home/editorial-home.tsx");
  assert.match(editorial, /<HomeRadar presentation="earth"/);
  assert.match(editorial, /<main id="experiencia" tabIndex=\{-1\}>/);
  assert.doesNotMatch(editorial, /^["']use client["']|DEMO_OPPORTUNITIES|localStorage|Prévia local/);
  const earth = await source("components/home/earth-radar/earth-radar-preview.tsx");
  assert.match(earth, /<SiteFooter \/>/);
  assert.match(earth, /<main id="experiencia" tabIndex=\{-1\}>/);
  assert.doesNotMatch(earth, /DEMO_OPPORTUNITIES|localStorage|Prévia local/);

  for (const route of [editorial, homeContent, opportunities, membersLayout]) {
    assert.match(route, /<SiteHeader/);
    assert.match(route, /<SiteFooter/);
  }

  assert.match(homeContent, /<SiteHeader current="home" tone="light" \/>/);
  assert.match(homeContent, /<Robonauta \/>/);
  assert.match(homeContent, /<main id="experiencia" tabIndex=\{-1\}>/);
  assert.doesNotMatch(homeContent, /^["']use client["']/);

  assert.match(header, /<SiteMobileNavigation>/);
  assert.match(footer, /aria-label="Navegação do rodapé"/);
  assert.match(opportunities, /memberHref=\{memberHref\}/);
  assert.match(opportunities, /memberRadarLoginHref\(params\)/);
});

test("shell keeps keyboard focus and mobile motion behavior in shared styles", async () => {
  const styles = await source("components/site/site-shell.module.css");

  assert.match(styles, /\.header a:focus-visible/);
  assert.match(styles, /\.mobileNavigation summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /--apogee-control-min-height/);
});
