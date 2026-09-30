import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/apogee-config.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { sampleApogee, APOGEE_FOV } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [360, 800]]) {
  const compact = width < 768;
  const aspect = width / height;
  test(`${width}×${height}: continuous retreat, fixed lens, restrained rotation`, () => {
    let previous = sampleApogee(0, compact, aspect);
    assert.equal(APOGEE_FOV, 35);
    assert.ok(Math.abs(previous.diameterRatio - (compact ? 1.8 : 1.75)) < 1e-9);
    for (let index = 1; index <= 1000; index++) {
      const frame = sampleApogee(index / 1000, compact, aspect);
      assert.ok(frame.distance >= previous.distance && frame.distance > 1);
      assert.ok(frame.diameterRatio <= previous.diameterRatio + 1e-10);
      assert.ok(frame.camera.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...frame.camera) - frame.distance) < 1e-9);
      assert.ok(frame.rotation <= 4 * Math.PI / 180);
      previous = frame;
    }
    const end = previous;
    const radiusX = end.diameterRatio / 2;
    const radiusY = radiusX * aspect;
    assert.ok(end.center[0] - radiusX > 0 && end.center[0] + radiusX < 1);
    assert.ok(end.center[1] - radiusY > 0 && end.center[1] + radiusY < 1);
    assert.ok(Math.abs(end.diameterRatio - (compact ? 0.26 : 0.105)) < 1e-9);
    const finalSpeed = end.distance - sampleApogee(0.99, compact, aspect).distance;
    const cruiseSpeed = sampleApogee(0.71, compact, aspect).distance - sampleApogee(0.7, compact, aspect).distance;
    assert.ok(finalSpeed < cruiseSpeed * 0.1, "camera slows considerably at apogee");
  });
}

test("input bounds and deterministic rendering", () => {
  assert.deepEqual(sampleApogee(-3), sampleApogee(0));
  assert.deepEqual(sampleApogee(2), sampleApogee(1));
  assert.deepEqual(sampleApogee(Number.NaN), sampleApogee(0));
  assert.deepEqual(sampleApogee(0.5), sampleApogee(0.5));
});
