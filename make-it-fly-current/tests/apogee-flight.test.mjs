import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/apogee-config.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { sampleEarthFlight, APOGEE_FOV } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const coordinates = sample => [sample.distance, sample.diameterRatio, ...sample.center, sample.rotation, sample.opacity];

for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [360, 800]]) {
  const compact = width < 768;
  const aspect = width / height;

  test(`${width}×${height}: entire-page flight is finite, continuous and exactly reversible`, () => {
    const forward = Array.from({ length: 1001 }, (_, index) => sampleEarthFlight(index / 1000, compact, aspect));
    for (let index = 0; index < forward.length; index++) {
      const sample = forward[index];
      assert.ok(coordinates(sample).every(Number.isFinite));
      assert.ok(sample.camera.every(Number.isFinite));
      assert.ok(sample.distance > 1 && sample.diameterRatio > 0);
      assert.ok(sample.opacity >= 0 && sample.opacity <= 1);
      assert.ok(Math.abs(Math.hypot(...sample.camera) - sample.distance) < 1e-8);
      const projectedDiameter = 1 / (Math.sqrt(sample.distance ** 2 - 1) * Math.tan(APOGEE_FOV * Math.PI / 360) * aspect);
      assert.ok(Math.abs(projectedDiameter - sample.diameterRatio) < 1e-8, "flight uses the actual fixed-lens perspective camera");
      if (index > 0) {
        const previous = forward[index - 1];
        assert.ok(Math.abs(sample.center[0] - previous.center[0]) < 0.035, "horizontal travel has no per-frame jump");
        assert.ok(Math.abs(sample.center[1] - previous.center[1]) < 0.035, "vertical travel has no per-frame jump");
        assert.ok(Math.abs(sample.diameterRatio - previous.diameterRatio) < 0.04, "globe size changes continuously");
        assert.ok(Math.abs(sample.opacity - previous.opacity) < 0.04, "section changes never toggle visibility abruptly");
      }
    }
    for (let index = forward.length - 1; index >= 0; index--) {
      assert.deepEqual(sampleEarthFlight(index / 1000, compact, aspect), forward[index], "return scrolling retraces the same camera and appearance without accumulated state");
    }
  });

  test(`${width}×${height}: Earth remains visible and travels through every section after the hero`, () => {
    const heroExit = sampleEarthFlight(1 / 7, compact, aspect);
    for (let section = 1; section < 7; section++) {
      const start = sampleEarthFlight((section + 0.15) / 7, compact, aspect);
      const middle = sampleEarthFlight((section + 0.5) / 7, compact, aspect);
      const end = sampleEarthFlight((section + 0.85) / 7, compact, aspect);
      assert.ok(middle.opacity > 0.01, `section ${section} must retain the Earth before the footer exit`);
      const movement = Math.abs(end.center[0] - start.center[0])
        + Math.abs(end.center[1] - start.center[1])
        + Math.abs(end.diameterRatio - start.diameterRatio);
      assert.ok(movement > 0.005, `section ${section} must not freeze at the end of the hero`);
      assert.notDeepEqual(coordinates(middle), coordinates(heroExit));
    }
    const ending = sampleEarthFlight(1, compact, aspect);
    const participation = sampleEarthFlight(6 / 7, compact, aspect);
    assert.ok(ending.opacity <= 0.18 && ending.opacity <= participation.opacity * 0.5 + 1e-10,
      "the scene becomes subtle at the end; the footer's opaque foreground provides the final occlusion");
  });

  test(`${width}×${height}: all section boundaries join without a discontinuity`, () => {
    for (let section = 1; section < 7; section++) {
      const stop = section / 7;
      const left = coordinates(sampleEarthFlight(stop - 1e-7, compact, aspect));
      const center = coordinates(sampleEarthFlight(stop, compact, aspect));
      const right = coordinates(sampleEarthFlight(stop + 1e-7, compact, aspect));
      for (let component = 0; component < center.length; component++) {
        assert.ok(Math.abs(left[component] - center[component]) < 1e-4);
        assert.ok(Math.abs(right[component] - center[component]) < 1e-4);
      }
    }
  });
}

test("whole-page camera handles out-of-range input deterministically", () => {
  for (const compact of [false, true]) {
    assert.deepEqual(sampleEarthFlight(-10, compact), sampleEarthFlight(0, compact));
    assert.deepEqual(sampleEarthFlight(10, compact), sampleEarthFlight(1, compact));
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.deepEqual(sampleEarthFlight(invalid, compact), sampleEarthFlight(0, compact));
    }
  }
});
