import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migration = readFileSync(new URL("../../db/migrations/0023_user_source_candidates.sql", import.meta.url), "utf8");

it("imports candidates paused, skips existing URLs and preserves official audits on repeat", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table official_sources(id text primary key, base_url text, listing_urls text[]);
      create table discovery_targets(
        id text primary key, name text, organizer text, kind text, official_url text,
        topics text[], priority integer, enabled boolean, check_interval_hours integer,
        evidence_url text, notes text, official_verified_at timestamptz,
        official_verified_url text, official_verified_by text, official_review_note text,
        constraint enabled_review check (not enabled or
          official_verified_at is not null and official_verified_url=official_url and
          official_verified_by is not null and official_review_note is not null)
      );
      insert into discovery_targets(id,name,official_url,priority,enabled,official_verified_at,
        official_verified_url,official_verified_by,official_review_note)
      values('existing-fapesc','FAPESC','https://fapesc.sc.gov.br/',99,true,now(),
        'https://fapesc.sc.gov.br/','real-audit','preserve');
      insert into official_sources values('existing-iel','https://iel.org.br/',array['https://iel.org.br/']);
    `);
    await db.exec(migration);
    const first = await db.query("select * from discovery_targets order by id");
    // 93 candidates minus the existing FAPESC target and IEL source, plus the preserved target.
    expect(first.rows).toHaveLength(92);
    await db.exec(migration);
    expect((await db.query("select * from discovery_targets order by id")).rows).toEqual(first.rows);
    const imported = await db.query<{ enabled: boolean; priority: number; official_verified_at: null }>(
      "select enabled,priority,official_verified_at from discovery_targets where id like 'xlsx-%'",
    );
    expect(imported.rows.every(row => !row.enabled && row.priority === 0 && row.official_verified_at === null)).toBe(true);
    expect((await db.query("select official_review_note,priority,enabled from discovery_targets where id='existing-fapesc'")).rows)
      .toEqual([{ official_review_note: "preserve", priority: 99, enabled: true }]);
    expect((await db.query("select id from discovery_targets where official_url like '%devpost%'")).rows).toEqual([]);
  } finally { await db.close(); }
});
