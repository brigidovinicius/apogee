import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);

// Exercise production TS/TSX functions and markup without a Next server or live credentials.
export function opportunityLoader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = [base, `${base}.ts`, `${base}.tsx`].find((file) => existsSync(file));
        if (target) return load(target);
      }
      return require(name);
    };
    new Function("require", "module", "exports", output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
