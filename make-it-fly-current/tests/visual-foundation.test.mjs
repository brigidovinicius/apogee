import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const repoSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("visual foundation keeps the approved Stage 1 brand contract and semantic scales", async () => {
  const [site, radar] = await Promise.all([
    appSource("app/globals.css"),
    repoSource("radar-academico/src/app/globals.css"),
  ]);

  for (const source of [site, radar]) {
    assert.match(source, /Etapa 1 aprovada \(e147ddf\)/);
    for (const token of [
      "--apogee-navy",
      "--apogee-black",
      "--apogee-white",
      "--apogee-sky",
      "--apogee-space-1",
      "--apogee-space-8",
      "--apogee-font-sans",
      "--apogee-font-heading",
      "--apogee-text-title",
      "--apogee-focus-ring",
      "--apogee-focus-offset",
    ]) assert.match(source, new RegExp(token));
  }
});

test("reusable controls use the shared focus treatment and preserve member form exports", async () => {
  const [button, field, fieldCss, memberField] = await Promise.all([
    appSource("components/ui/button.tsx"),
    appSource("components/ui/form-field.tsx"),
    appSource("components/ui/form-field.module.css"),
    appSource("components/members/form-field.tsx"),
  ]);

  assert.match(button, /apogeeSecondary/);
  assert.match(button, /--apogee-focus-ring/);
  assert.match(field, /export function FormField/);
  assert.match(field, /aria-describedby/);
  assert.match(fieldCss, /\.control:focus-visible/);
  assert.match(fieldCss, /--apogee-control-min-height/);
  assert.match(memberField, /FormField as Field/);
});
