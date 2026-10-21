import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const row = { id: 1, name: 'Ana "Apogee"', phone: "+5511999991234", email: "ana@example.test", consentedAt: new Date("2026-10-20T15:30:00Z") };
const dialect = new PgDialect();
const request = search => new Request(`https://www.apogee.community/api/admin/loja/drops/exportar?${new URLSearchParams({ busca: search ?? "" })}`);

function fixture({ member = { role: "admin" }, rows = [row], total = rows.length, error = false } = {}) {
  const calls = [];
  const db = { select(fields) {
    const query = { fields };
    calls.push(query);
    const chain = {
      from() { return chain; },
      where(value) { query.where = value ? dialect.sqlToQuery(value) : undefined; return chain; },
      orderBy(...value) { query.order = value.map(item => dialect.sqlToQuery(item).sql); return chain; },
      limit(value) { query.limit = value; return chain; },
      offset(value) { query.offset = value; return chain; },
      then(resolve, reject) { return (error ? Promise.reject(new Error("private database details")) : Promise.resolve("value" in fields ? [{ value: total }] : rows)).then(resolve, reject); },
    };
    return chain;
  } };
  const load = opportunityLoader({
    "@/lib/members/db": { getDb() { calls.push("db"); return db; } },
    "@/lib/members/dal": {
      getCurrentMember: async () => member,
      getMemberFromHeaders: async () => member,
    },
    "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => createElement("a", props, children) },
  });
  return { load, calls, ...load("lib/admin/drop-signups.ts") };
}

test("drop list and direct export authorize before accessing contacts", async () => {
  for (const member of [null, { role: "member" }]) {
    const state = fixture({ member });
    await assert.rejects(state.listDropSignups("Ana", "1"), /redirect:/);
    const response = await state.load("app/api/admin/loja/drops/exportar/route.ts").GET(request());
    assert.equal(response.status, member ? 403 : 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.doesNotMatch(await response.text(), /ana@example|private database/);
    assert.deepEqual(state.calls, []);
  }
});

test("drop list bounds pages, preserves sorting and searches escaped literal text", async () => {
  const state = fixture({ total: 125 });
  const result = await state.listDropSignups("  Ana%_\\  ", "99999");
  assert.equal(result.page, 3);
  assert.equal(result.pageCount, 3);
  assert.equal(result.total, 125);
  assert.equal(result.search, "Ana%_\\");
  const queries = state.calls.filter(item => typeof item === "object");
  assert.deepEqual(queries[0].where, queries[1].where);
  assert.deepEqual(queries[0].where.params, ["%Ana\\%\\_\\\\%", "%Ana\\%\\_\\\\%", "%Ana\\%\\_\\\\%"]);
  assert.equal(queries[1].limit, 50);
  assert.equal(queries[1].offset, 100);
  assert.deepEqual(queries[1].order, ['"store_drop_signup"."consented_at" desc', '"store_drop_signup"."id" desc']);
  for (const page of [undefined, ["2"], "-1", "NaN", "1e5", "0"]) assert.equal((await state.listDropSignups([], page)).page, 1);
  assert.equal(state.normalizeDropSearch("x".repeat(500)).length, 120);
});

test("formatted telephone searches and filtered exports use the same predicate", async () => {
  const state = fixture();
  await state.listDropSignups("(11) 99999-1234", "1");
  const response = await state.exportDropSignups(request("(11) 99999-1234"));
  assert.equal(response.status, 200);
  const queries = state.calls.filter(item => typeof item === "object");
  assert.deepEqual(queries[0].where, queries[2].where);
  assert.equal(queries[0].where.params[2], "%11999991234%");
  assert.equal(queries[2].limit, 10001);
  assert.equal(queries[2].offset, undefined);
});

test("CSV preserves accents, quotes, phones and Brasília dates, and neutralizes formulas", async () => {
  const { dropSignupsToCsv } = fixture();
  const csv = dropSignupsToCsv([row, { ...row, name: '\t =HYPERLINK("bad")', phone: "0011999991234", email: "+formula@example.test" }, { ...row, name: "João; Silva\nNova linha" }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Nome";"Telefone";"E-mail";"Data do cadastro \(Brasília\)"/);
  assert.match(csv, /"Ana ""Apogee""";"'\+5511999991234";"ana@example.test";"20\/10\/2026, 12:30:00"/);
  assert.match(csv, /"'  =HYPERLINK\(""bad""\)";"'0011999991234";"'\+formula@example.test"/);
  assert.match(csv, /"João; Silva Nova linha"/);
  assert.equal(csv.split("\r\n").length, 5);
});

test("export downloads all filtered pages and never silently truncates or leaks errors", async () => {
  const state = fixture({ rows: Array.from({ length: 60 }, (_, id) => ({ ...row, id })) });
  const response = await state.exportDropSignups(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment; filename="cadastros-drops-apogee.csv"/);
  assert.match(response.headers.get("content-type"), /text\/csv; charset=utf-8/);
  assert.equal((await response.text()).match(/ana@example.test/g).length, 60);
  const excessive = await fixture({ rows: Array(10001).fill(row) }).exportDropSignups(request());
  assert.equal(excessive.status, 413);
  assert.match((await excessive.json()).message, /Refine a busca/);
  const unavailable = await fixture({ error: true }).exportDropSignups(request());
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private database details/);
});

test("admin page shows contacts and pagination, escapes content and handles empty filters", async () => {
  const state = fixture({ rows: [{ ...row, name: '<img src=x onerror="alert(1)">' }], total: 80 });
  const Page = state.load("app/admin/loja/drops/page.tsx").default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "Ana & João", pagina: "1" }) }));
  assert.match(html, /Cadastros dos drops/);
  assert.match(html, /ana@example.test/);
  assert.match(html, /\+5511999991234/);
  assert.match(html, /20\/10\/2026, 12:30/);
  assert.match(html, /Exportar para planilha/);
  assert.match(html, /todos os resultados da busca/);
  assert.match(html, /pagina=2/);
  assert.match(html, /Ana\+%26\+Jo%C3%A3o/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x|consent_text|session_token/);
  const Empty = fixture({ rows: [], total: 0 }).load("app/admin/loja/drops/page.tsx").default;
  const empty = renderToStaticMarkup(await Empty({ searchParams: Promise.resolve({ busca: "Inexistente" }) }));
  assert.match(empty, /Nenhum cadastro encontrado/);
  assert.match(empty, /disabled=""/);
  assert.match(empty, /Limpar busca/);
});
