import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const origin = "https://www.apogee.community";
const id = "2026-09-23T10-57-15-503Z-3033bf41-154b-4294-8a89-5c32c8e423df";
const retiredId = "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073";
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../lib/${path}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", output)(specifier => {
    if (specifier === "server-only") return {};
    return specifier in mocks ? mocks[specifier] : require(specifier);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
async function fixture(overrides = {}) {
  // Ausência/valor inválido de Supabase nunca interfere na galeria PostgreSQL.
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "invalid";
  process.env.BETTER_AUTH_SECRET = "test-auth-secret-longer-than-32-characters";
  process.env.APPLICATION_HOSTING_PROVIDER = "caddy";
  const calls = [];
  const rows = new Map();
  const repository = {
    async listStoredPhotos(offset, limit) { calls.push({ method: "list", offset, limit }); return [...rows.values()].map(row => row.photo).filter(photo => photo.id !== retiredId).sort((a,b) => b.id.localeCompare(a.id)).slice(offset, offset + limit); },
    async saveStoredPhoto(photo, image) { calls.push({ method: "save", photo, image }); rows.set(photo.id, { photo, image }); },
    async readStoredImage(id) { calls.push({ method: "image", id }); return rows.get(id)?.image ?? null; },
    async deleteStoredPhoto(id) { calls.push({ method: "delete", id }); rows.delete(id); },
    ...overrides,
  };
  const gallery = await load("gallery", {
    "./admin-auth": await load("admin-auth"), "./instagram": await load("instagram"),
    "./gallery-pagination": await load("gallery-pagination"), "./gallery-repository": repository,
  });
  return { gallery, calls, rows };
}
async function uploadRequest({ anonymous = false, mime = "image/webp", length, consent = true } = {}) {
  const image = sharp({ create: { width: 160, height: 120, channels: 3, background: "#aabbcc" } });
  const original = await (mime === "image/jpeg" ? image.jpeg() : image.webp()).toBuffer();
  const form = new FormData();
  form.append("photo", new File([original], "photo", { type: mime }));
  form.append("author", "Pessoa Teste"); form.append("instagram", "https://www.instagram.com/pessoa.teste/");
  form.append("anonymous", String(anonymous)); form.append("consent", String(consent));
  return new Request(`${origin}/api/gallery`, { method: "POST", headers: { origin, ...(length ? { "content-length": length } : {}) }, body: form });
}
function deleteRequest(photoId = id, token) {
  return new Request(`${origin}/api/gallery/admin`, { method: "DELETE", headers: { origin, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id: photoId }) });
}
test("Instagram credit accepts handles/profile links and rejects other destinations", async () => {
  const { normalizeInstagram } = await load("instagram");
  for (const value of [" @pessoa.teste ", "https://www.instagram.com/pessoa.teste/?igsh=abc", "instagram.com/pessoa.teste/"]) assert.equal(normalizeInstagram(value), "pessoa.teste");
  for (const value of ["https://www.instagram.com/p/abc/", "https://instagram.com.evil.test/pessoa"]) assert.equal(normalizeInstagram(value), null);
});
test("cross-origin uploads fail before PostgreSQL access or signing configuration", async () => {
  const { gallery, calls } = await fixture(); delete process.env.BETTER_AUTH_SECRET;
  const response = await gallery.uploadCommunityPhoto(new Request(`${origin}/api/gallery`, { method: "POST", headers: { origin: "https://other.example" }, body: "bad" }));
  assert.equal(response.status, 403); assert.equal(calls.length, 0);
});
test("PostgreSQL upload saves processed WebP and credits atomically, with no Supabase requests", async () => {
  const { gallery, calls } = await fixture();
  const previous = globalThis.fetch; globalThis.fetch = () => { throw new Error("External storage must not be contacted"); };
  try {
    const response = await gallery.uploadCommunityPhoto(await uploadRequest()); assert.equal(response.status, 201);
    const photo = (await response.json()).photo;
    assert.equal(photo.author, "Pessoa Teste"); assert.equal(photo.instagram, "pessoa.teste");
    assert.equal(photo.anonymous, false); assert.equal(photo.src, `/galeria/fotos/${photo.id}.webp`);
    assert.deepEqual(calls.map(call => call.method), ["save"]);
    const info = await sharp(calls[0].image).metadata();
    assert.equal(info.format, "webp"); assert.equal(info.exif, undefined); assert.equal(info.width, 160);
    assert.ok(calls[0].photo.consentVersion); assert.ok(calls[0].photo.consentedAt);
    const page = await (await gallery.listCommunityPhotos()).json(); assert.deepEqual(page, { photos: [photo], nextOffset: null });
  } finally { globalThis.fetch = previous; }
});
test("anonymous publication discards entered identity from both saved and public data", async () => {
  const { gallery, calls } = await fixture();
  const response = await gallery.uploadCommunityPhoto(await uploadRequest({ anonymous: true })); assert.equal(response.status, 201);
  const photo = (await response.json()).photo;
  assert.equal(photo.author, "Anônimo"); assert.equal(photo.instagram, ""); assert.equal(photo.anonymous, true);
  assert.doesNotMatch(JSON.stringify(calls[0].photo), /Pessoa Teste|pessoa\.teste/);
});
test("failed atomic storage reports 503 without a successful public photo", async () => {
  const { gallery } = await fixture({ saveStoredPhoto: async () => { throw new Error("private database details"); } });
  const response = await gallery.uploadCommunityPhoto(await uploadRequest()); assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database/);
});
test("public reads whitelist credits, paginate and never delete retired data", async () => {
  const raw = { id, author: "Anônimo", instagram: "", anonymous: true, width: 900, height: 1600, createdAt: "2026-09-23T10:57:15.503Z", consentVersion: "private", image: "private", secret: "private" };
  const { gallery, calls } = await fixture({ listStoredPhotos: async (offset, limit) => { calls.push({ method: "list", offset, limit }); return Array.from({ length: 25 }, () => raw); } });
  const body = await (await gallery.listCommunityPhotos(new Request(`${origin}/api/gallery?offset=24`))).json();
  assert.equal(body.photos.length, 24); assert.equal(body.nextOffset, 48);
  assert.deepEqual(Object.keys(body.photos[0]).sort(), ["id", "src", "author", "instagram", "anonymous", "width", "height", "createdAt"].sort());
  assert.deepEqual(calls, [{ method: "list", offset: 24, limit: 25 }]);
  assert.equal((await gallery.listCommunityPhotos(new Request(`${origin}/api/gallery?offset=-1`))).status, 400);
  assert.equal(calls.length, 1);
});
test("retired photos are excluded without deleting them during reads", async () => {
  const { gallery, calls, rows } = await fixture();
  rows.set(retiredId, { photo: { id: retiredId } });
  assert.deepEqual(await (await gallery.listCommunityPhotos()).json(), { photos: [], nextOffset: null });
  assert.equal(rows.size, 1); assert.deepEqual(calls.map(call => call.method), ["list"]);
});
test("management authorizes admin role and rejects members before touching PostgreSQL", async () => {
  const { gallery, calls } = await fixture();
  assert.equal((await gallery.manageCommunityPhotos(deleteRequest(), { memberRole: "member" })).status, 404); assert.equal(calls.length, 0);
  const response = await gallery.manageCommunityPhotos(deleteRequest(), { memberRole: "admin" });
  assert.equal(response.status, 200); assert.deepEqual(calls, [{ method: "delete", id }]); assert.match(response.headers.get("cache-control"), /private/);
});
test("management preserves the authorized operational token and deletes only the selected record", async () => {
  process.env.APPLICATION_EXPORT_TOKEN = "a".repeat(64);
  try {
    const { gallery, calls } = await fixture();
    assert.equal((await gallery.manageCommunityPhotos(deleteRequest(id, "b".repeat(64)))).status, 404); assert.equal(calls.length, 0);
    assert.equal((await gallery.manageCommunityPhotos(deleteRequest(id, "a".repeat(64)))).status, 200);
    assert.deepEqual(calls, [{ method: "delete", id }]);
  } finally { delete process.env.APPLICATION_EXPORT_TOKEN; }
});
test("oversized streamed deletion is cancelled before PostgreSQL access", async () => {
  const { gallery, calls } = await fixture(); let pulls = 0; let cancelled = false;
  const body = new ReadableStream({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(700)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const request = new Request(`${origin}/api/gallery/admin`, { method: "DELETE", headers: { origin, "content-type": "application/json" }, body, duplex: "half" });
  assert.equal((await gallery.manageCommunityPhotos(request, { memberRole: "admin" })).status, 413);
  assert.equal(pulls, 2); assert.equal(cancelled, true); assert.equal(calls.length, 0);
});
test("authenticated administration keeps GET responses private", async () => {
  const { gallery } = await fixture();
  const response = await gallery.manageCommunityPhotos(new Request(`${origin}/api/gallery/admin`), { memberRole: "admin" });
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private, no-store/); assert.match(response.headers.get("x-robots-tag"), /noindex/);
});
for (const mime of ["image/jpeg", "image/webp"]) test(`bounded ${mime} mobile upload works without Content-Length`, async () => {
  const { gallery, calls } = await fixture();
  assert.equal((await gallery.uploadCommunityPhoto(await uploadRequest({ mime }))).status, 201);
  assert.equal((await sharp(calls[0].image).metadata()).format, "webp");
});
test("image route returns only processed bytes and makes removed/invalid images noindex", async () => {
  const { gallery, rows, calls } = await fixture();
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#abc" } }).webp().toBuffer();
  rows.set(id, { image });
  const response = await gallery.communityPhotoImage(`${id}.webp`);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-robots-tag"), null); assert.equal(response.headers.get("content-length"), String(image.length));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  const count = calls.length;
  for (const value of ["../private", `${retiredId}.webp`, `${id}.jpg`]) { const missing = await gallery.communityPhotoImage(value); assert.equal(missing.status, 404); assert.equal(missing.headers.get("x-robots-tag"), "noindex"); }
  assert.equal(calls.length, count);
  rows.clear(); assert.equal((await gallery.communityPhotoImage(`${id}.webp`)).status, 404);
});
