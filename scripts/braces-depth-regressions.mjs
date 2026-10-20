import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function bracesDepthCases(packageJsonUrl) {
  const require = createRequire(packageJsonUrl);
  const globRequire = createRequire(require.resolve("fast-glob"));
  const matchRequire = createRequire(globRequire.resolve("micromatch"));
  const braces = matchRequire("braces");
  const micromatch = globRequire("micromatch");
  const glob = require("fast-glob");
  const cases = [];
  const guarded = error => error instanceof SyntaxError && error.code === "BRACES_DEPTH_LIMIT";
  for (const [kind, open, close] of [["braces", "{", "}"], ["parentheses", "(", ")"]]) {
    const pattern = open.repeat(4500) + "x" + close.repeat(4500);
    for (const operation of ["default", "parse", "compile", "expand", "stringify"]) {
      cases.push([`${operation} rejects deeply nested ${kind} with a controlled depth error`, () => {
        const run = operation === "default" ? braces : braces[operation];
        assert.throws(() => run(pattern, { maxLength: Infinity, maxDepth: Infinity }), guarded);
      }]);
    }
  }
  for (const operation of ["compile", "expand", "stringify"]) {
    cases.push([`${operation} also guards an AST supplied directly`, () => {
      const ast = { type: "root", nodes: [] };
      let parent = ast;
      for (let i = 0; i < 4500; i++) {
        const child = { type: "paren", nodes: [], parent };
        parent.nodes.push(child);
        parent = child;
      }
      parent.nodes.push({ type: "text", value: "x", parent });
      assert.throws(() => braces[operation](ast), guarded);
    }]);
  }
  cases.push(["normal alternatives and numeric ranges keep their exact results", () => {
    assert.deepEqual(braces.expand("src/{app,lib}/file-{1..2}.ts"), ["src/app/file-1.ts", "src/app/file-2.ts", "src/lib/file-1.ts", "src/lib/file-2.ts"]);
    assert.deepEqual(micromatch.braceExpand("src/{app,lib}/file-{1..2}.ts"), ["src/app/file-1.ts", "src/app/file-2.ts", "src/lib/file-1.ts", "src/lib/file-2.ts"]);
  }]);
  cases.push(["128 nesting levels remain supported and the next level is rejected", () => {
    const pattern = "{".repeat(128) + "x" + "}".repeat(128);
    assert.equal(braces.compile(pattern), pattern);
    assert.equal(braces.stringify(braces.parse(pattern)), pattern);
    assert.throws(() => braces.parse("{" + pattern + "}"), guarded);
  }]);
  cases.push(["escaped braces and quoted literal braces are not counted as nesting", () => {
    assert.equal(braces.compile("\\{".repeat(1000)), "{".repeat(1000));
    assert.equal(braces.compile('"' + "{".repeat(1000) + '"'), "{".repeat(1000));
  }]);
  cases.push(["fast-glob still finds real fixture files with brace alternatives", async () => {
    const directory = await mkdtemp(join(tmpdir(), "braces-dep03-fixture-"));
    try {
      for (const folder of ["app", "lib"]) {
        await mkdir(join(directory, "src", folder), { recursive: true });
        await writeFile(join(directory, "src", folder, "example.ts"), "synthetic\n");
      }
      assert.deepEqual(glob.sync("src/{app,lib}/**/*.ts", { cwd: directory }).sort(), ["src/app/example.ts", "src/lib/example.ts"]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }]);
  return cases;
}
