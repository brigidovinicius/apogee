import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/apogee-motion-policy.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { resolveApogeeMotion, nextSceneVersion } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const defaults = { mounted: true, lowPower: false, failed: false };

test("automatic motion policy covers all eight combinations of hydration and safeguards", () => {
  for (let mask = 0; mask < 8; mask++) {
    const [mounted, lowPower, failed] = [0, 1, 2].map(bit => Boolean(mask & (1 << bit)));
    const input = { mounted, lowPower, failed };
    const result = resolveApogeeMotion(input);
    assert.deepEqual(result, { canAnimate: mounted && !lowPower && !failed }, JSON.stringify(input));
  }
});

test("an eligible mounted scene starts automatically without an opt-in input", () => {
  assert.deepEqual(resolveApogeeMotion(defaults), { canAnimate: true });
  assert.deepEqual(Object.keys(resolveApogeeMotion(defaults)), ["canAnimate"]);
});

test("automatic startup cannot bypass SSR, low-power mode or a failed renderer", () => {
  for (const blocked of [{ mounted: false }, { lowPower: true }, { failed: true }]) {
    assert.deepEqual(resolveApogeeMotion({ ...defaults, ...blocked }), { canAnimate: false });
  }
});

test("policy and generation evaluation are pure and leave inputs unchanged", () => {
  const input = Object.freeze({ ...defaults });
  assert.deepEqual(resolveApogeeMotion(input), resolveApogeeMotion(input));
  assert.deepEqual(input, defaults);
  const previous = Object.freeze({ mounted: true, lowPower: true, sceneVersion: 7 });
  const next = Object.freeze({ lowPower: false });
  assert.equal(nextSceneVersion(previous, next), 8);
  assert.equal(previous.sceneVersion, 7);
});

test("hydration starts a new generation only if animation actually becomes eligible", () => {
  const server = { mounted: false, lowPower: false, sceneVersion: 0 };
  assert.equal(nextSceneVersion(server, { lowPower: true }), 0);
  assert.equal(nextSceneVersion(server, { lowPower: false }), 1);
});

test("generation remains stable when the effective animated/static mode does not change", () => {
  assert.equal(nextSceneVersion(
    { mounted: true, lowPower: false, sceneVersion: 5 },
    { lowPower: false },
  ), 5);
  assert.equal(nextSceneVersion(
    { mounted: true, lowPower: true, sceneVersion: 5 },
    { lowPower: true },
  ), 5);
});

test("automatic eligibility transitions invalidate readiness from the previous Canvas", () => {
  let previous = { mounted: false, lowPower: false, sceneVersion: 0 };
  const versions = [];
  for (const lowPower of [false, true, false]) {
    const next = { lowPower };
    const sceneVersion = nextSceneVersion(previous, next);
    previous = { mounted: true, ...next, sceneVersion };
    versions.push(sceneVersion);
  }
  assert.deepEqual(versions, [1, 2, 3]);
  const readyVersionFromFirstCanvas = versions[0];
  assert.notEqual(readyVersionFromFirstCanvas, previous.sceneVersion);
});

test("entering and leaving low-power mode create distinct scene generations", () => {
  const animated = { mounted: true, lowPower: false, sceneVersion: 3 };
  const lowPower = { lowPower: true };
  const staticVersion = nextSceneVersion(animated, lowPower);
  assert.equal(staticVersion, 4);
  assert.equal(nextSceneVersion(
    { mounted: true, ...lowPower, sceneVersion: staticVersion },
    { lowPower: false },
  ), 5);
});
