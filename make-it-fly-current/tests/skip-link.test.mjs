import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("skip link replaces an existing fragment and keeps the current route and filters in history", () => {
  const { SkipLink } = opportunityLoader()("components/site/skip-link.tsx");
  const original = { window: globalThis.window, document: globalThis.document };
  const navigation = [];
  let prevented = false;
  const target = { setAttribute() {}, scrollIntoView() {}, focus() {} };
  try {
    globalThis.window = { location: { href: "http://localhost/oportunidades?pagina=2#mural-title" }, history: { pushState: (...args) => navigation.push(args) } };
    globalThis.document = { getElementById: id => id === "experiencia" ? target : null };
    const link = SkipLink();
    assert.equal(link.type, "a");
    assert.equal(link.props.href, "#experiencia");
    link.props.onClick({ button: 0, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(navigation, [[null, "", "http://localhost/oportunidades?pagina=2#experiencia"]]);
  } finally { globalThis.window = original.window; globalThis.document = original.document; }
});

test("modified skip-link clicks keep native browser behavior", () => {
  const { SkipLink } = opportunityLoader()("components/site/skip-link.tsx");
  let prevented = false;
  SkipLink().props.onClick({ button: 0, ctrlKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});
