import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

export function braceExpansionSecurityTests(packageJsonUrl) {
  const require = createRequire(packageJsonUrl);
  const consumers = [
    ["minimatch 3", require.resolve("minimatch")],
    ["ts-morph minimatch", createRequire(require.resolve("@ts-morph/common")).resolve("minimatch")],
    ["typescript-estree minimatch", createRequire(require.resolve("@typescript-eslint/typescript-estree")).resolve("minimatch")],
  ];
  for (const [label, path] of consumers) {
    const consumerRequire = createRequire(path);
    const dependency = consumerRequire("brace-expansion");
    const expand = typeof dependency === "function" ? dependency : dependency.expand;
    const minimatch = require(path);
    const match = typeof minimatch === "function" ? minimatch : minimatch.minimatch;

    test(`${label}: nested groups cannot overflow the consumer's stack`, () => {
      const result = minimatch.braceExpand("{".repeat(4500) + "a,b" + "}".repeat(4500));
      assert.ok(Array.isArray(result) && result.length <= 2);
    });
    test(`${label}: nested comma alternatives respect output bounds without stack overflow`, () => {
      const result = expand("{a,".repeat(4500) + "z" + "}".repeat(4500), { max: 4, maxLength: 64 });
      assert.ok(result.length <= 4);
      assert.ok(result.reduce((n, value) => n + value.length, 0) <= 64);
    });
    test(`${label}: long comma-part chains are parsed without native recursion overflow`, () => {
      const result = expand("{" + "{a},".repeat(8000) + "b}", { max: 1, maxLength: 1 });
      assert.ok(result.length <= 1);
      assert.ok(result.every(value => value.length <= 1));
    });
    test(`${label}: wide comma arrays avoid argument-list stack exhaustion`, () => {
      const result = expand("{{x}," + "a,".repeat(160000) + "b}", { max: 1, maxLength: 1 });
      assert.ok(result.length <= 1);
      assert.ok(result.every(value => value.length <= 1));
    });
    test(`${label}: explicit rewrite budget preserves the remaining input literally`, () => {
      assert.deepEqual(expand("{a}},z}", { maxRewrites: 0 }), ["{a}},z}"]);
    });
    test(`${label}: the default rewrite cap bounds repeated rescans`, () => {
      const pattern = "{a}" + "}".repeat(2000) + ",z}";
      assert.deepEqual(expand(pattern), [pattern]);
    });
    test(`${label}: normal numeric ranges and matching remain compatible`, () => {
      assert.deepEqual(minimatch.braceExpand("src/{app,lib}/file-{1..2}.ts"), ["src/app/file-1.ts", "src/app/file-2.ts", "src/lib/file-1.ts", "src/lib/file-2.ts"]);
      assert.equal(match("src/app/file-1.ts", "src/{app,lib}/file-?.ts"), true);
      assert.equal(match("src/other/file-1.ts", "src/{app,lib}/file-?.ts"), false);
    });
  }
}
