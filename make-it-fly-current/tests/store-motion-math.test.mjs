import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/loja/store-motion-math.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { stepSpring, floatingOffset } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("spring response is refresh-rate independent for a fixed target", () => {
  const simulate = hz => {
    const state = { value: 0, velocity: 0 };
    for (let i = 0; i < hz; i++) stepSpring(state, 1, 6.5, 1 / hz);
    return state;
  };
  const a = simulate(60), b = simulate(120);
  assert.ok(Math.abs(a.value - b.value) < 1e-12);
  assert.ok(Math.abs(a.velocity - b.velocity) < 1e-12);
  assert.ok(a.value > .98 && a.value < 1);
});

test("spring reverses continuously and settles without Euler instability", () => {
  const state = { value: 0, velocity: 0 };
  for (let i = 0; i < 30; i++) stepSpring(state, 20, 6.5, 1 / 60);
  const previous = state.value;
  stepSpring(state, -20, 6.5, 1 / 60);
  assert.ok(Math.abs(state.value - previous) < 1);
  for (let i = 0; i < 240; i++) stepSpring(state, -20, 6.5, 1 / 60);
  assert.ok(Math.abs(state.value + 20) < .001);
  assert.ok(Math.abs(state.velocity) < .001);
});

test("floating paths stay bounded and scale with depth", () => {
  for (let t = 0; t < 300; t += .17) {
    const near = floatingOffset(t, 1), far = floatingOffset(t, .7);
    assert.ok(Math.abs(near.x) <= 18 && Math.abs(near.y) <= 20);
    assert.ok(Math.abs(near.turn) <= .45);
    assert.ok(Math.abs(far.x - near.x * .7) < 1e-12);
  }
  assert.notDeepEqual(floatingOffset(0, 1), floatingOffset(4, 1));
});
