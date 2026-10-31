import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/db/client", () => ({ withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) => state.db!.transaction(tx => work(tx as unknown as PoolClient)) }));
import { recordDiscoveryObservation, recordDiscoveryObservationChanged, listDiscoveryWatchlist } from "@/lib/discovery/watchlist";
const moduleUrl = new URL("../../scripts/radar-expansion-package.mjs", import.meta.url).href;
const now = new Date("2026-10-30T18:00:00Z");
beforeAll(async () => {
 state.db = new PGlite({ extensions: { pgcrypto } });
 const dir = new URL("../../db/migrations/", import.meta.url);
 for (const name of (await readdir(dir)).filter(name=>name.endsWith('.sql')).sort()) await state.db.exec(await readFile(new URL(name,dir),"utf8"));
},30000);
afterAll(async()=>{await state.db?.close();});
it("installs only fresh exact audited sources, preserves disabled records and is idempotent", async () => {
 const { expansionPackage, installExpansionPackage }=await import(moduleUrl);
 const full=await expansionPackage(), target=full.targets[0], source=full.sources[0];
 const pkg={...full,targets:[target,{...target,id:'exp-test-pending',url:'https://pending.example.org/'}],sources:[source]};
 const audit={complete:true,manifestHash:pkg.manifestHash,checkedAt:now.toISOString(),results:[{kind:'target',id:target.id,url:target.url,outcome:'checked'},{kind:'source',id:source.id,url:source.url,outcome:'checked'}]};
 const apply=()=>state.db!.transaction(tx=>installExpansionPackage(tx,pkg,audit,now));
 expect(await apply()).toEqual({targetsAdded:2,targetsEnabled:1,targetsPending:1,sourcesAdded:1});
 await state.db!.query('update discovery_targets set enabled=false where id=$1',[target.id]);
 await state.db!.query('update official_sources set active=false where id=$1',[source.id]);
 expect(await apply()).toEqual({targetsAdded:0,targetsEnabled:0,targetsPending:0,sourcesAdded:0});
 expect((await state.db!.query<{enabled:boolean}>('select enabled from discovery_targets where id=$1',[target.id])).rows[0].enabled).toBe(false);
 expect((await state.db!.query<{active:boolean}>('select active from official_sources where id=$1',[source.id])).rows[0].active).toBe(false);
 await expect(installExpansionPackage(state.db!,pkg,{...audit,manifestHash:'wrong'},now)).rejects.toThrow();
 await expect(installExpansionPackage(state.db!,pkg,{...audit,complete:false},now)).rejects.toThrow();
 await expect(installExpansionPackage(state.db!,pkg,audit,new Date('2026-11-02T18:00:00Z'))).rejects.toThrow();
 // A same-host unrelated URL never grants publication authority.
 const altered={...pkg,sources:[{...source,id:'exp-wrong',url:source.url+'unverified'}],targets:[]};
 expect((await installExpansionPackage(state.db!,altered,audit,now)).sourcesAdded).toBe(0);
 // Canonical root URLs cannot bypass a previously disabled target via a trailing slash.
 const alias={...pkg,targets:[{...target,id:'exp-root-alias',url:target.url.endsWith('/')?target.url.slice(0,-1):target.url+'/'}],sources:[]};
 const aliasAudit={...audit,results:[{kind:'target',id:'exp-root-alias',url:alias.targets[0].url,outcome:'checked'}]};
 expect((await installExpansionPackage(state.db!,alias,aliasAudit,now)).targetsAdded).toBe(0);
});
it("audits same-URL changes, retains baselines and never revives dismissed or completed leads",async()=>{
 const targetId='exp-observation-test';
 await state.db!.query(`insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url) values($1,'Olimpíada','Organizador','event_series','https://example.edu.br/','https://example.edu.br/')`,[targetId]);
 expect(await recordDiscoveryObservation(targetId,{hash:'closed',excerpt:'Inscrições encerradas'})).toBe(false);
 expect(await recordDiscoveryObservation(targetId,{hash:'closed',excerpt:'Inscrições encerradas'})).toBe(false);
 await state.db!.query(`insert into discovery_leads(target_id,url,title,status,processing_status) values
 ($1,'https://example.edu.br/blocked','Olimpíada','new','blocked'),
 ($1,'https://example.edu.br/dismissed','Descartada','dismissed','ignored'),
 ($1,'https://example.edu.br/mapped','Mapeada','mapped','completed')`,[targetId]);
 expect(await recordDiscoveryObservation(targetId,{hash:'open',excerpt:'Inscrições abertas 2027'})).toBe(true);
 await recordDiscoveryObservationChanged(targetId);
 const leads=(await state.db!.query<{title:string;processing_status:string}>("select title,processing_status from discovery_leads where target_id=$1 order by title",[targetId])).rows;
 expect(leads).toEqual([{title:'Descartada',processing_status:'ignored'},{title:'Mapeada',processing_status:'completed'},{title:'Olimpíada',processing_status:'pending'}]);
 const watchlist=await listDiscoveryWatchlist();
 expect(watchlist.targets.find(t=>t.id===targetId)?.last_changed_at).toBeInstanceOf(Date);
 const audit=(await state.db!.query<{execution_metadata:{changed:boolean;previous_hash:string}}>("select execution_metadata from ingestion_runs where execution_metadata->>'target_id'=$1 and execution_metadata->>'hash'='open'",[targetId])).rows[0].execution_metadata;
 expect(audit).toMatchObject({changed:true,previous_hash:'closed'});
});
