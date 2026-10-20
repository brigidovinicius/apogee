// Somente banco descartável de CI; nunca usa DATABASE_URL de produção.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postgres from "postgres";
import ts from "typescript";
import { migrateGallery } from "../scripts/gallery-migrate.mjs";
import { migrateBlog } from "../scripts/blog-migrate.mjs";
import { migrateMemberAvatar } from "../scripts/members-avatar-migrate.mjs";
import { migrateMemberInvitations } from "../scripts/members-invitations-migrate.mjs";
const initial = await readFile(new URL("../drizzle/0000_init.sql", import.meta.url), "utf8");
const source = await readFile(new URL("../lib/gallery-repository.ts", import.meta.url), "utf8");
const id = "2026-10-11T19-00-00-000Z-3033bf41-154b-4294-8a89-5c32c8e423df";

test("reviewed migration, atomic image storage, pagination and deletion work on PostgreSQL", async () => {
  const url = new URL(process.env.GALLERY_TEST_DATABASE_URL || "http://missing");
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.pathname, "/apogee_gallery_ci");
  const sql = postgres(url.href, { ssl: false, prepare: false, max: 1 });
  try {
    await sql.unsafe(initial);
    await sql`CREATE SCHEMA drizzle`;
    await sql`CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${createHash("sha256").update(initial).digest("hex")}, ${1790736196779})`;
    // Um registro sintético existente verifica que o schema/data de membros é preservado.
    await sql`INSERT INTO public."user" (id, name, email) VALUES ('ci-existing-user', 'Synthetic CI', 'ci@example.test')`;
    assert.deepEqual(await migrateGallery(sql), { changed: true, migration: "0001_gallery_postgres" });
    assert.deepEqual(await migrateGallery(sql), { changed: false, migration: "0001_gallery_postgres" });
    const loadedModule = { exports: {} };
    new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(specifier => {
      if (specifier === "server-only") return {};
      if (specifier === "./members/db") return { getSql: () => sql };
      throw new Error(`Unexpected import ${specifier}`);
    }, loadedModule, loadedModule.exports);
    const repo = loadedModule.exports;
    const photo = { id, author: "Anônimo", instagram: "", anonymous: true, width: 10, height: 10, createdAt: "2026-10-11T19:00:00.000Z", consentVersion: "2026-09-22", consentedAt: "2026-10-11T19:00:00.000Z" };
    const image = Buffer.from([0, 1, 127, 128, 255]);
    await repo.saveStoredPhoto(photo, image);
    assert.deepEqual(await repo.readStoredImage(id), image);
    const listed = await repo.listStoredPhotos(0, 25);
    assert.equal(listed.length, 1); assert.equal(listed[0].createdAt, photo.createdAt);
    assert.equal(listed[0].image, undefined); assert.equal(listed[0].consentVersion, undefined);
    assert.equal((await repo.listStoredPhotos(1, 25)).length, 0);
    await assert.rejects(repo.saveStoredPhoto({ ...photo, id: id.replace('3033bf41', '3033bf42'), author: "Identity must not be saved" }, image));
    await assert.rejects(repo.saveStoredPhoto({ ...photo, id: id.replace('3033bf41', '3033bf43') }, Buffer.alloc(3145729)));
    assert.equal((await repo.listStoredPhotos(0, 25)).length, 1);
    await repo.saveStoredPhoto({ ...photo, id: repo.RETIRED_PHOTO_ID }, image);
    assert.equal((await repo.listStoredPhotos(0, 25)).length, 1); assert.equal(await repo.readStoredImage(repo.RETIRED_PHOTO_ID), null);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM public.gallery_photo`)[0].count), 2);
    await repo.deleteStoredPhoto(id);
    assert.equal(await repo.readStoredImage(id), null); assert.equal((await repo.listStoredPhotos(0, 25)).length, 0);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM public."user" WHERE id = 'ci-existing-user'`)[0].count), 1);

    assert.deepEqual(await migrateBlog(sql), { changed: true, migration: "0002_rapid_queen_noir" });
    assert.deepEqual(await migrateBlog(sql), { changed: false, migration: "0002_rapid_queen_noir" });
    const [post] = await sql`INSERT INTO public.blog_post (slug, title, excerpt, body, category, author_id, author_name)
      VALUES ('ci-post', 'Synthetic post', 'Synthetic excerpt for CI', 'Synthetic body for CI', 'estudos', 'ci-existing-user', 'Synthetic CI') RETURNING id`;
    const mediaId = "3033bf41-154b-4294-8a89-5c32c8e423df";
    await sql`INSERT INTO public.blog_media (id, post_id, alt, width, height, image)
      VALUES (${mediaId}, ${post.id}, 'Synthetic image', 10, 10, ${image})`;
    assert.deepEqual((await sql`SELECT image FROM public.blog_media WHERE id = ${mediaId}`)[0].image, image);
    await assert.rejects(sql`INSERT INTO public.blog_media (id, post_id, alt, width, height, image)
      VALUES ('3033bf41-154b-4294-8a89-5c32c8e423de', ${post.id}, 'Synthetic image', 10, 10, ${Buffer.alloc(2097153)})`);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM public.blog_media`)[0].count), 1);
    assert.deepEqual(await migrateMemberAvatar(sql), { changed: true, migration: "0003_bored_logan" });
    await sql`ALTER TABLE public."user" ADD COLUMN blocked boolean`;
    await assert.rejects(migrateMemberInvitations(sql), /divergente/);
    assert.equal((await sql`SELECT to_regclass('public.member_invitation') AS name`)[0].name, null);
    await sql`ALTER TABLE public."user" DROP COLUMN blocked`;
    assert.deepEqual(await migrateMemberInvitations(sql), { changed: true, migration: "0004_member_invitations" });
    assert.deepEqual(await migrateMemberInvitations(sql), { changed: false, migration: "0004_member_invitations" });
    const [preserved] = await sql`SELECT name, role, blocked, can_manage_admins, name_needs_confirmation FROM public."user" WHERE id = 'ci-existing-user'`;
    assert.deepEqual({ ...preserved }, { name: "Synthetic CI", role: "member", blocked: false, can_manage_admins: false, name_needs_confirmation: false });
    await sql`UPDATE drizzle.__drizzle_migrations SET hash = 'divergent' WHERE id = 5`;
    await assert.rejects(migrateMemberInvitations(sql), /divergente/);
    await sql`UPDATE drizzle.__drizzle_migrations SET hash = ${createHash("sha256").update(await readFile(new URL("../drizzle/0004_member_invitations.sql", import.meta.url), "utf8")).digest("hex")} WHERE id = 5`;
    await sql`UPDATE drizzle.__drizzle_migrations SET hash = 'divergent' WHERE id = 3`;
    await assert.rejects(migrateBlog(sql), /divergente/);
    await sql`UPDATE drizzle.__drizzle_migrations SET hash = ${createHash("sha256").update(await readFile(new URL("../drizzle/0002_rapid_queen_noir.sql", import.meta.url), "utf8")).digest("hex")} WHERE id = 3`;
    await sql`UPDATE drizzle.__drizzle_migrations SET hash = 'divergent' WHERE id = 2`;
    await assert.rejects(migrateGallery(sql), /divergente/);
    await assert.rejects(migrateBlog(sql), /divergente/);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM public.gallery_photo`)[0].count), 1);
  } finally { await sql.end(); }
});
