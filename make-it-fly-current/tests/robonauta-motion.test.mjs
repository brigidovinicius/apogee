import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/robonauta-motion.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { HEAD_YAW_LIMIT, HEAD_PITCH_LIMIT, pointerToHeadPose, createHeadMotionState, stepHeadMotion } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const bounds = { left: 120, top: 80, width: 640, height: 480 };
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) < tolerance);

test("head follows pointer continuously in both axes and uses the area's page position", () => {
  assert.deepEqual(pointerToHeadPose(440, 320, bounds), { yaw: 0, pitch: 0 });
  assert.deepEqual(pointerToHeadPose(760, 560, bounds), { yaw: HEAD_YAW_LIMIT, pitch: HEAD_PITCH_LIMIT });
  assert.deepEqual(pointerToHeadPose(120, 80, bounds), { yaw: -HEAD_YAW_LIMIT, pitch: -HEAD_PITCH_LIMIT });
  close(pointerToHeadPose(600, 200, bounds).yaw, HEAD_YAW_LIMIT / 2);
  close(pointerToHeadPose(600, 200, bounds).pitch, -HEAD_PITCH_LIMIT / 2);
  assert.ok(pointerToHeadPose(441, 320, bounds).yaw > 0, "there must be no dead zone around the face");
});

test("pointer bounds, leaving the stage and unavailable layout produce safe poses", () => {
  assert.deepEqual(pointerToHeadPose(-9000, 9000, bounds), { yaw: -HEAD_YAW_LIMIT, pitch: HEAD_PITCH_LIMIT });
  assert.deepEqual(pointerToHeadPose(760, 560, bounds, false), { yaw: 0, pitch: 0 });
  for (const invalidBounds of [
    { ...bounds, width: 0 },
    { ...bounds, height: -1 },
    { ...bounds, left: Infinity },
    { ...bounds, top: NaN },
  ]) assert.deepEqual(pointerToHeadPose(760, 560, invalidBounds), { yaw: 0, pitch: 0 });
  assert.deepEqual(pointerToHeadPose(NaN, 560, bounds), { yaw: 0, pitch: 0 });
});

test("head spring reaches the same pose and velocity at 24, 30, 60, 120 and 240 fps", () => {
  const target = { yaw: HEAD_YAW_LIMIT, pitch: -HEAD_PITCH_LIMIT };
  const simulate = hz => {
    let state = createHeadMotionState();
    for (let frame = 0; frame < hz; frame++) state = stepHeadMotion(state, target, 1 / hz);
    return state;
  };
  const baseline = simulate(60);
  for (const hz of [24, 30, 120, 240]) {
    const result = simulate(hz);
    for (const key of Object.keys(baseline)) close(result[key], baseline[key]);
  }
  assert.ok(baseline.yaw > HEAD_YAW_LIMIT * 0.99 && baseline.yaw < HEAD_YAW_LIMIT);
});

test("a pointer reversal retains momentum and leaving the stage settles naturally at neutral", () => {
  let state = createHeadMotionState();
  const right = pointerToHeadPose(760, 560, bounds);
  for (let frame = 0; frame < 12; frame++) state = stepHeadMotion(state, right, 1 / 60);
  const beforeReversal = state;
  const left = pointerToHeadPose(120, 80, bounds);
  state = stepHeadMotion(state, left, 1 / 60);
  assert.ok(Math.abs(state.yaw - beforeReversal.yaw) < 0.02, "reversal should not teleport the head");
  assert.ok(state.yaw > 0, "head must travel through intermediate angles");
  for (let frame = 0; frame < 120; frame++) state = stepHeadMotion(state, left, 1 / 60);
  close(state.yaw, -HEAD_YAW_LIMIT, 1e-6);
  const neutral = pointerToHeadPose(120, 80, bounds, false);
  for (let frame = 0; frame < 120; frame++) state = stepHeadMotion(state, neutral, 1 / 60);
  close(state.yaw, 0, 1e-6);
  close(state.pitch, 0, 1e-6);
  close(state.yawVelocity, 0, 1e-6);
});

test("paused or corrupted input cannot produce NaN, rotation beyond limits or state mutation", () => {
  const state = Object.freeze({ yaw: HEAD_YAW_LIMIT, pitch: -HEAD_PITCH_LIMIT, yawVelocity: 4, pitchVelocity: -4 });
  const target = Object.freeze({ yaw: 999, pitch: -999 });
  for (const seconds of [0, -1, NaN, Infinity, 1 / 60, 10, Number.MAX_VALUE]) {
    const next = stepHeadMotion(state, target, seconds);
    assert.notEqual(next, state);
    assert.ok(Object.values(next).every(Number.isFinite));
    assert.ok(Math.abs(next.yaw) <= HEAD_YAW_LIMIT);
    assert.ok(Math.abs(next.pitch) <= HEAD_PITCH_LIMIT);
  }
  const repaired = stepHeadMotion({ yaw: NaN, pitch: Infinity, yawVelocity: NaN, pitchVelocity: -Infinity }, { yaw: NaN, pitch: Infinity }, 1 / 60, NaN);
  assert.deepEqual(repaired, createHeadMotionState());
  assert.deepEqual(stepHeadMotion(createHeadMotionState(), target, -1), createHeadMotionState());
});
