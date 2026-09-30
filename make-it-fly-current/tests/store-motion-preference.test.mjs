import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/loja/store-motion-preference.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const resolved = outputText.replace('from "react"', `from "${pathToFileURL(require.resolve("react")).href}"`);
const { parseStoreMotionPreference, resolveStoreMotionEnabled, useStoreMotionPreference, STORE_MOTION_STORAGE_KEY } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`);

test("store defaults to the operating system unless the visitor explicitly chooses a mode", () => {
  for (const value of [null, "", "system", "true", "unknown"]) {
    assert.equal(parseStoreMotionPreference(value), "system");
  }
  assert.equal(parseStoreMotionPreference("full"), "full");
  assert.equal(parseStoreMotionPreference("reduced"), "reduced");
  assert.equal(STORE_MOTION_STORAGE_KEY, "makeitfly:store-motion");
});

test("system mode respects reduced motion and follows system changes", () => {
  assert.equal(resolveStoreMotionEnabled("system", true), false);
  assert.equal(resolveStoreMotionEnabled("system", false), true);
});

test("explicit store enable and pause choices work independently of system preference", () => {
  for (const systemReduced of [true, false]) {
    assert.equal(resolveStoreMotionEnabled("full", systemReduced), true);
    assert.equal(resolveStoreMotionEnabled("reduced", systemReduced), false);
  }
});

test("server rendering stays static and does not require browser APIs", () => {
  function Probe() {
    const { preference, motionEnabled, systemReduced, ready } = useStoreMotionPreference();
    return createElement("output", null, `${preference}:${motionEnabled}:${systemReduced}:${ready}`);
  }
  assert.equal(renderToStaticMarkup(createElement(Probe)), "<output>system:false:true:false</output>");
});
