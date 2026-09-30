import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadPreparation() {
  const source = await readFile(new URL("../components/gallery/prepare-photo.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: "prepare-photo.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", output)(exports);
  return exports;
}

test("photo preparation falls back to JPEG when canvas cannot export WebP", async () => {
  const { preparePhoto } = await loadPreparation();
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const attempts = [];
  const revoked = [];
  globalThis.Image = class {
    naturalWidth = 4032;
    naturalHeight = 3024;
    async decode() {}
  };
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob(callback, format, quality) {
        attempts.push({ format, quality, width: this.width });
        callback(new Blob([new Uint8Array(format === "image/webp" ? 30 : 120)], {
          type: format === "image/webp" ? "image/png" : "image/jpeg",
        }));
      },
    }),
  };
  URL.createObjectURL = () => "blob:test-photo";
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const prepared = await preparePhoto({ name: "mobile.jpg", type: "image/jpeg" });
    assert.equal(prepared.type, "image/jpeg");
    assert.equal(attempts[0].format, "image/webp");
    assert.equal(attempts[1].format, "image/jpeg");
    assert.equal(attempts[0].width, 2400);
    assert.deepEqual(revoked, ["blob:test-photo"]);
  } finally {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});

test("photo preparation keeps reducing highly detailed mobile images until they fit", async () => {
  const { preparePhoto } = await loadPreparation();
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const widths = [];
  globalThis.Image = class {
    naturalWidth = 8064;
    naturalHeight = 6048;
    async decode() {}
  };
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob(callback, format) {
        widths.push(this.width);
        callback(new Blob([new Uint8Array(this.width <= 1100 ? 100 : 2_500_001)], { type: format }));
      },
    }),
  };
  URL.createObjectURL = () => "blob:large-photo";
  URL.revokeObjectURL = () => {};
  try {
    const prepared = await preparePhoto({ name: "iphone-48mp.jpg", type: "image/jpeg" });
    assert.equal(prepared.type, "image/webp");
    assert.ok(widths.includes(1100));
    assert.ok(widths.includes(2400));
  } finally {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});
