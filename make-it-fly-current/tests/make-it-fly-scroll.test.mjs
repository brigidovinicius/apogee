import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { readMakeItFlyScroll, rememberMakeItFlyScroll } = opportunityLoader()("lib/navigation/make-it-fly-scroll.ts");
const href = "https://apogee.test/makeitfly#programacao";

test("leaving Make It Fly stores its exit position without replacing router or custom history state", () => {
  const originalWindow = globalThis.window;
  const routeState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["event"] }, custom: "preserved" };
  let saved;
  globalThis.window = { location: { href, pathname: "/makeitfly" }, scrollX: 0, scrollY: 4800,
    history: { state: routeState, replaceState: (...args) => { saved = args; } } };
  try { rememberMakeItFlyScroll(); } finally { globalThis.window = originalWindow; }
  assert.equal(saved.length, 2, "recording the position must not change the URL");
  assert.equal(saved[0].__PRIVATE_NEXTJS_INTERNALS_TREE, routeState.__PRIVATE_NEXTJS_INTERNALS_TREE);
  assert.equal(saved[0].__NA, true);
  assert.equal(saved[0].custom, "preserved");
  assert.equal(routeState.apogeeMakeItFlyScroll, undefined, "do not mutate the existing state object");
  assert.deepEqual(readMakeItFlyScroll(saved[0], href), { href, left: 0, top: 4800 });
});

test("scroll restoration is bound to the exact Make It Fly history URL", () => {
  const state = { apogeeMakeItFlyScroll: { href, left: 0, top: 4800 } };
  for (const destination of ["https://apogee.test/", "https://apogee.test/makeitfly#inicio",
    "https://apogee.test/makeitfly?preview=1#programacao", "https://apogee.test/makeitfly/participar"]) {
    assert.equal(readMakeItFlyScroll(state, destination), null);
  }
  const home = "https://apogee.test/";
  assert.equal(readMakeItFlyScroll({ apogeeMakeItFlyScroll: { href: home, left: 0, top: 500 } }, home), null);
});

test("missing or malformed history positions do not trigger restoration", () => {
  for (const state of [null, undefined, true, {}, { apogeeMakeItFlyScroll: null }, { apogeeMakeItFlyScroll: "invalid" }]) {
    assert.equal(readMakeItFlyScroll(state, href), null);
  }
  for (const invalid of [-1, NaN, Infinity, "4800", undefined]) {
    assert.equal(readMakeItFlyScroll({ apogeeMakeItFlyScroll: { href, left: 0, top: invalid } }, href), null);
    assert.equal(readMakeItFlyScroll({ apogeeMakeItFlyScroll: { href, left: invalid, top: 4800 } }, href), null);
  }
});

test("recording a position outside the event leaves its history untouched", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { pathname: "/oportunidades" },
    history: { replaceState: () => assert.fail("must not change other routes") } };
  try { rememberMakeItFlyScroll(); } finally { globalThis.window = originalWindow; }
});
