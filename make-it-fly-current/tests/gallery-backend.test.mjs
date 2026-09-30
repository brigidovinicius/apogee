import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

async function loadInstagram() {
  const source = await readFile(new URL("../lib/instagram.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: "instagram.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", output)(exports);
  return exports;
}

async function loadGallery() {
  const instagram = await loadInstagram();
  const source = await readFile(new URL("../lib/gallery.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: "gallery.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./instagram") return instagram;
    return require(specifier);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test("Instagram credit accepts @handles and profile links, but rejects post links", async () => {
  const { normalizeInstagram } = await loadInstagram();
  assert.equal(normalizeInstagram(" @pessoa.teste "), "pessoa.teste");
  assert.equal(normalizeInstagram("https://www.instagram.com/pessoa.teste/?igsh=abc"), "pessoa.teste");
  assert.equal(normalizeInstagram("instagram.com/pessoa.teste/"), "pessoa.teste");
  assert.equal(normalizeInstagram("https://www.instagram.com/p/abc/"), null);
  assert.equal(normalizeInstagram("https://instagram.com.evil.test/pessoa"), null);
});

function setGalleryEnvironment() {
  process.env.SUPABASE_URL = "https://test.supabase.co/";
  process.env.SUPABASE_SECRET_KEY = `sb_secret_${"x".repeat(36)}`;
  process.env.APPLICATION_SIGNING_SECRET = "test-signing-secret-longer-than-32-chars";
  process.env.VERCEL = "0";
}

test("gallery rejects cross-origin uploads before touching storage", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Storage must not be contacted"); };
  try {
    const response = await gallery.uploadCommunityPhoto(new Request("https://makeitfly.vercel.app/api/gallery", {
      method: "POST",
      headers: { origin: "https://another.example", "content-length": "100", "content-type": "multipart/form-data; boundary=test" },
      body: "wrong origin",
    }));
    assert.equal(response.status, 403);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("gallery stores processed WebP and credits, then lists only real submissions", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const original = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#aabbcc" } }).webp().toBuffer();
  const form = new FormData();
  form.append("photo", new File([original], "photo.webp", { type: "image/webp" }));
  form.append("author", "Pessoa Teste");
  form.append("instagram", "https://www.instagram.com/pessoa.teste/");
  form.append("anonymous", "false");
  form.append("consent", "true");
  const requests = [];
  let credit;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes("/object/list/")) return Response.json([{ name: `${credit.id}.json` }]);
    if (String(url).includes("/entries/") && init.method === "GET") return Response.json(credit);
    if (String(url).includes("/entries/") && init.method === "POST") credit = JSON.parse(init.body);
    return Response.json({ Key: "ok" });
  };
  try {
    const response = await gallery.uploadCommunityPhoto(new Request("https://makeitfly.vercel.app/api/gallery", {
      method: "POST",
      headers: { origin: "https://makeitfly.vercel.app", "content-length": "1000" },
      body: form,
    }));
    assert.equal(response.status, 201);
    const uploaded = (await response.json()).photo;
    assert.equal(uploaded.author, "Pessoa Teste");
    assert.equal(uploaded.instagram, "pessoa.teste");
    assert.equal(uploaded.anonymous, false);
    assert.match(uploaded.src, /\/photos\/.*\.webp$/);
    assert.equal(requests[0].init.headers["Content-Type"], "image/webp");
    const publicImage = Buffer.from(requests[0].init.body);
    const info = await sharp(publicImage).metadata();
    assert.equal(info.format, "webp");
    assert.equal(info.exif, undefined);
    assert.equal(info.width, 160);
    const listed = await gallery.listCommunityPhotos();
    assert.equal(listed.status, 200);
    const page = await listed.json();
    assert.deepEqual(page.photos, [uploaded]);
    assert.equal(page.nextOffset, null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("anonymous publishing discards submitted name and Instagram", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const original = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#aabbcc" } }).webp().toBuffer();
  const form = new FormData();
  form.append("photo", new File([original], "photo.webp", { type: "image/webp" }));
  form.append("author", "Não guardar este nome");
  form.append("instagram", "@nao.guardar");
  form.append("anonymous", "true");
  form.append("consent", "true");
  let storedCredit;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/entries/") && init.method === "POST") storedCredit = JSON.parse(init.body);
    return Response.json({ Key: "ok" });
  };
  try {
    const response = await gallery.uploadCommunityPhoto(new Request("https://makeitfly.vercel.app/api/gallery", {
      method: "POST",
      headers: { origin: "https://makeitfly.vercel.app", "content-length": "1000" },
      body: form,
    }));
    assert.equal(response.status, 201);
    const photo = (await response.json()).photo;
    assert.equal(photo.author, "Anônimo");
    assert.equal(photo.instagram, "");
    assert.equal(photo.anonymous, true);
    assert.equal(storedCredit.author, "Anônimo");
    assert.equal(storedCredit.instagram, "");
    assert.doesNotMatch(JSON.stringify(storedCredit), /Não guardar|nao\.guardar/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("gallery management requires the existing admin token and deletes only the selected pair", async () => {
  setGalleryEnvironment();
  process.env.APPLICATION_EXPORT_TOKEN = "a".repeat(64);
  const gallery = await loadGallery();
  const id = "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073";
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    return Response.json({});
  };
  try {
    const denied = await gallery.manageCommunityPhotos(new Request("https://makeitfly.vercel.app/api/gallery/admin", {
      method: "DELETE",
      headers: { origin: "https://makeitfly.vercel.app", authorization: `Bearer ${"b".repeat(64)}`, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }));
    assert.equal(denied.status, 404);
    assert.equal(requests.length, 0);

    const deleted = await gallery.manageCommunityPhotos(new Request("https://makeitfly.vercel.app/api/gallery/admin", {
      method: "DELETE",
      headers: { origin: "https://makeitfly.vercel.app", authorization: `Bearer ${"a".repeat(64)}`, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }));
    assert.equal(deleted.status, 200);
    assert.deepEqual(requests, [
      { url: `https://test.supabase.co/storage/v1/object/apogee-community-photos/photos/${id}.webp`, method: "DELETE" },
      { url: `https://test.supabase.co/storage/v1/object/apogee-community-photos/entries/${id}.json`, method: "DELETE" },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    delete process.env.APPLICATION_EXPORT_TOKEN;
  }
});

test("the retired identified test photo is removed while anonymous gallery entries remain", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const retiredId = "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073";
  const anonymousId = "2026-09-23T10-57-15-503Z-3033bf41-154b-4294-8a89-5c32c8e423df";
  const anonymous = { id: anonymousId, author: "Anônimo", instagram: "", anonymous: true, width: 900, height: 1600, createdAt: "2026-09-23T10:57:15.503Z" };
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    if (String(url).includes("/object/list/")) return Response.json([{ name: `${anonymousId}.json` }, { name: `${retiredId}.json` }]);
    if (String(url).endsWith(`${anonymousId}.json`) && init.method === "GET") return Response.json(anonymous);
    return Response.json({});
  };
  try {
    const response = await gallery.listCommunityPhotos();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.photos.map((photo) => photo.id), [anonymousId]);
    assert.ok(requests.some((request) => request.url.endsWith(`/photos/${retiredId}.webp`) && request.method === "DELETE"));
    assert.ok(requests.some((request) => request.url.endsWith(`/entries/${retiredId}.json`) && request.method === "DELETE"));
    assert.equal(requests.some((request) => request.url.includes(anonymousId) && request.method === "DELETE"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("gallery accepts browser-prepared JPEG fallback and still stores WebP", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const jpeg = await sharp({ create: { width: 128, height: 96, channels: 3, background: "#abcdef" } }).jpeg().toBuffer();
  const form = new FormData();
  form.append("photo", new File([jpeg], "mobile.jpg", { type: "image/jpeg" }));
  form.append("author", "Pessoa Teste");
  form.append("instagram", "@pessoa.teste");
  form.append("anonymous", "false");
  form.append("consent", "true");
  let publicImage;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/photos/") && init.method === "POST") publicImage = Buffer.from(init.body);
    return Response.json({ Key: "ok" });
  };
  try {
    const response = await gallery.uploadCommunityPhoto(new Request("https://makeitfly.vercel.app/api/gallery", {
      method: "POST",
      headers: { origin: "https://makeitfly.vercel.app", "content-length": "1000" },
      body: form,
    }));
    assert.equal(response.status, 201);
    assert.equal((await sharp(publicImage).metadata()).format, "webp");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("gallery accepts a bounded mobile upload without Content-Length", async () => {
  setGalleryEnvironment();
  const gallery = await loadGallery();
  const jpeg = await sharp({ create: { width: 128, height: 96, channels: 3, background: "#abcdef" } }).jpeg().toBuffer();
  const form = new FormData();
  form.append("photo", new File([jpeg], "mobile.jpg", { type: "image/jpeg" }));
  form.append("author", "Pessoa Teste");
  form.append("instagram", "@pessoa.teste");
  form.append("anonymous", "false");
  form.append("consent", "true");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ Key: "ok" });
  try {
    const response = await gallery.uploadCommunityPhoto(new Request("https://makeitfly.vercel.app/api/gallery", {
      method: "POST",
      headers: { origin: "https://makeitfly.vercel.app" },
      body: form,
    }));
    assert.equal(response.status, 201);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
