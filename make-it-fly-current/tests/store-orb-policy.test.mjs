import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../app/loja/store-orb-policy.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { resolveOrbFrameMode } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const visible = Object.freeze({ hostVisible: true, sectionVisible: true, heroVisible: true,
  mobile: false, documentHidden: false, modalOpen: false, reducedMotion: false, rendererUnavailable: false });

test("visible orb runs on desktop and mobile while the hero is visible", () => {
  assert.equal(resolveOrbFrameMode(visible), "running");
  assert.equal(resolveOrbFrameMode({ ...visible, mobile: true }), "running");
});

test("fixed mobile orb pauses behind cards and resumes when the hero returns", () => {
  assert.equal(resolveOrbFrameMode({ ...visible, mobile: true, heroVisible: false }), "paused");
  assert.equal(resolveOrbFrameMode({ ...visible, mobile: true, heroVisible: true }), "running");
  assert.equal(resolveOrbFrameMode({ ...visible, heroVisible: false }), "running");
});

test("reduced motion draws a still frame but does not bypass visibility pauses", () => {
  assert.equal(resolveOrbFrameMode({ ...visible, reducedMotion: true }), "static");
  assert.equal(resolveOrbFrameMode({ ...visible, mobile: true, heroVisible: false, reducedMotion: true }), "paused");
});

test("dialogs, hidden tabs, offscreen elements and unavailable renderers pause every mode", () => {
  for (const change of [{ modalOpen: true }, { documentHidden: true }, { hostVisible: false },
    { sectionVisible: false }, { rendererUnavailable: true }]) {
    for (const reducedMotion of [false, true]) {
      assert.equal(resolveOrbFrameMode({ ...visible, reducedMotion, ...change }), "paused");
    }
  }
});
