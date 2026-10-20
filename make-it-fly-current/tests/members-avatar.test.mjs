import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadSource(path, stubs = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((name) => name === "@/lib/request-body" ? opportunityLoader()("lib/request-body.ts") : stubs[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

const avatar = await loadSource("../lib/members/avatar.ts", {
  "server-only": {},
  "./db": {},
  "./schema": {},
});
const urls = await loadSource("../lib/members/avatar-url.ts");

test("a valid photo becomes a small WebP with metadata removed", async () => {
  const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#43556b" } }).jpeg().toBuffer();
  const converted = await avatar.convertAvatar(new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(converted).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width <= 512 && metadata.height <= 512);
  assert.ok(converted.byteLength <= 256 * 1024);
  assert.equal(metadata.exif, undefined);
});

test("avatar conversion rejects a forged MIME type and oversized input", async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#43556b" } }).png().toBuffer();
  await assert.rejects(avatar.convertAvatar(new File([png], "fake.jpg", { type: "image/jpeg" })), /formato da foto/i);
  await assert.rejects(avatar.convertAvatar(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" })), /até 5 MB/i);
});

test("photo uploads require the same origin and cap streamed multipart bodies", async () => {
  const url = "https://www.apogee.community/api/membros/avatar";
  assert.throws(() => avatar.checkAvatarOrigin(new Request(url, { method: "POST" })), /Origem não autorizada/);
  avatar.checkAvatarOrigin(new Request(url, { method: "POST", headers: { Origin: "https://www.apogee.community" } }));

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6 * 1024 * 1024 + 1));
      controller.close();
    },
  });
  const request = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=avatar-test" },
    body,
    duplex: "half",
  });
  await assert.rejects(avatar.boundedAvatarForm(request), /excede 6 MB/);
});

test("only internal versioned photo URLs render as member avatars", () => {
  assert.equal(urls.memberAvatarUrl("/api/membros/avatar/user_123?v=123e4567-e89b-12d3-a456-426614174000", "user_123"),
    "/api/membros/avatar/user_123?v=123e4567-e89b-12d3-a456-426614174000");
  assert.equal(urls.memberAvatarUrl("/api/membros/avatar/user_123?v=123e4567-e89b-12d3-a456-426614174000", "another_user"), null);
  for (const value of ["https://example.com/photo.jpg", "javascript:alert(1)", "/api/membros/avatar/../admin?v=123e4567-e89b-12d3-a456-426614174000", null]) {
    assert.equal(urls.memberAvatarUrl(value, "user_123"), null);
  }
});
