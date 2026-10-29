import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const root = new URL("../", import.meta.url);
async function actions(adminAllowed, mutations) {
 const source = await readFile(new URL("app/admin/radar/actions.ts", root), "utf8");
 const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const loaded = { exports: {} };
 const mocks = {
  "next/cache": { revalidatePath() {} }, "next/navigation": { redirect(path) { throw new Error(`REDIRECT ${path}`); } },
  "@/lib/admin/access": { async requireAdmin() { if (!adminAllowed) throw new Error("Unauthorized"); return { id: "real-admin" }; } },
  "@/lib/opportunities/radar-editorial-client": { async mutateRadarCatalogue(method, input) { mutations.push({ method, input }); return { ok: false, error: "conflict" }; } },
 };
 new Function("require", "module", "exports", js)((name) => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, loaded, loaded.exports);
 return loaded.exports;
}
test("create edit and delete enforce admin authorization before any mutation", async () => {
 const mutations = []; const handlers = await actions(false, mutations);
 const data = new FormData(); data.set("id", "forged-id"); data.set("confirmDelete", "on");
 await assert.rejects(handlers.saveRadarOpportunity({ error: "" }, data), /Unauthorized/);
 await assert.rejects(handlers.deleteRadarOpportunity({ error: "" }, data), /Unauthorized/);
 assert.equal(mutations.length, 0);
});
test("management uses session actor and returns errors without redirecting away from entered data", async () => {
 const mutations = []; const handlers = await actions(true, mutations); const data = new FormData();
 data.set("actor", "forged"); data.set("title", "Entered title");
 data.append("categories", "formacao"); data.append("categories", "bolsas");
 assert.deepEqual(await handlers.saveRadarOpportunity({ error: "" }, data), { error: "conflict" });
 assert.equal(mutations[0].method, "POST"); assert.equal(mutations[0].input.actor, "apogee:real-admin");
 assert.deepEqual(mutations[0].input.categories, ["formacao", "bolsas"]);
 data.set("id", "test-id"); data.set("version", "3");
 await handlers.saveRadarOpportunity({ error: "" }, data);
 assert.equal(mutations[1].method, "PATCH"); assert.equal(mutations[1].input.version, 3);
 await handlers.deleteRadarOpportunity({ error: "" }, data); assert.equal(mutations.length, 2);
 data.set("confirmDelete", "on"); await handlers.deleteRadarOpportunity({ error: "" }, data);
 assert.equal(mutations[2].method, "DELETE");
});
test("editorial form carries classification and stages while preserving the session actor", async () => {
 const mutations=[];const handlers=await actions(true,mutations);const data=new FormData();
 const discovery={primaryType:"competicoes",subtype:"olimpiada",areas:["matematica"],editions:[{id:"2026",name:"2026",stages:[{id:"exam",name:"Prova",kind:"exam",start:"2026-11-10",sourceUrl:"https://official.edu.br/edital",checkedAt:"2026-10-28T12:00:00Z"}]}]};
 data.set("id","test-id");data.set("version","4");data.set("actor","forged");data.set("discovery",JSON.stringify(discovery));
 await handlers.saveRadarOpportunity({error:""},data);
 assert.deepEqual(mutations[0].input.discovery,discovery);assert.equal(mutations[0].input.actor,"apogee:real-admin");
});
test("editorial form rejects malformed and oversized stage JSON before calling the service", async () => {
 const mutations=[];const handlers=await actions(true,mutations);const data=new FormData();
 data.set("discovery","{invalid");
 assert.deepEqual(await handlers.saveRadarOpportunity({error:""},data),{error:"Calendário inválido."});
 data.set("discovery"," ".repeat(40001));
 assert.deepEqual(await handlers.saveRadarOpportunity({error:""},data),{error:"Calendário muito extenso."});
 assert.equal(mutations.length,0);
});
