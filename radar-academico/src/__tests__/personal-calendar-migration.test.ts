import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
it("personal calendar migration isolates accounts, enforces unique tokens and cascades account removal", async () => {
  const db=new PGlite();
  try {
    await db.exec('create table "user" (id text primary key); insert into "user" values (\'alice\'),(\'bob\');');
    await db.exec(await readFile(new URL("../../../make-it-fly-current/drizzle/0008_radar_calendar.sql", import.meta.url),"utf8"));
    await db.query("insert into radar_saved_opportunity (user_id,opportunity_id,snapshot) values ($1,$2,$3),($4,$2,$3)",["alice","radar-one",{},"bob"]);
    expect((await db.query("select * from radar_saved_opportunity where user_id=$1",["alice"])).rows).toHaveLength(1);
    await expect(db.query("insert into radar_saved_opportunity (user_id,opportunity_id,snapshot) values ($1,$2,$3)",["alice","../invalid",{}])).rejects.toThrow();
    await db.query("insert into radar_calendar_feed (user_id,token_hash) values ($1,$2)",["alice","a".repeat(64)]);
    await expect(db.query("insert into radar_calendar_feed (user_id,token_hash) values ($1,$2)",["bob","a".repeat(64)])).rejects.toThrow();
    await db.query('delete from "user" where id=$1',["alice"]);
    expect((await db.query("select * from radar_calendar_feed")).rows).toHaveLength(0);
    expect((await db.query("select user_id from radar_saved_opportunity")).rows).toEqual([{user_id:"bob"}]);
  } finally { await db.close(); }
}, 30_000);
