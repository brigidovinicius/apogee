import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("critical member and opportunity routes provide a loading and recovery state", async () => {
  const [memberLoading, memberError, opportunityLoading, opportunityError] = await Promise.all([
    source("app/membros/loading.tsx"),
    source("app/membros/error.tsx"),
    source("app/oportunidades/loading.tsx"),
    source("app/oportunidades/error.tsx"),
  ]);

  for (const loading of [memberLoading, opportunityLoading]) {
    assert.match(loading, /<StatePanel/);
    assert.match(loading, /busy/);
  }

  for (const error of [memberError, opportunityError]) {
    assert.match(error, /<RouteErrorState retry=\{reset\}/);
  }
});

test("shared state panel announces progress and error recovery keeps a keyboard-operable action", async () => {
  const [panel, errorState, globals] = await Promise.all([
    source("components/ui/state-panel.tsx"),
    source("components/ui/route-error-state.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(panel, /aria-busy=\{busy \|\| undefined\}/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /role=\{role\}/);
  assert.match(errorState, /type="button" onClick=\{retry\}/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
});
