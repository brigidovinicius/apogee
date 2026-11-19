
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import test from "node:test";


const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");


test("a conta com acesso antigo ao Radar mantém Radar completo e Benefícios na navegação",async()=>{
  const {opportunityLoader}=await import("./helpers/load-opportunity-module.mjs");
  const {renderToStaticMarkup}=await import("react-dom/server");
  const page=opportunityLoader({
    "@/lib/billing/community-store":{communityAccess:async()=>({active:false})},
    "@/lib/billing/store":{radarAccess:async()=>({active:true,source:"legacy"})},
    "@/lib/members/dal":{requireSignedInMember:async()=>({id:"a",name:"Ana Apogee",username:"ana"})},
    "@/lib/members/protection":{adultAccess:async()=>true},
    "@/lib/members/forum":{listCategories:async()=>[]},
    "@/components/members/member-bar":{MemberBar:()=>null},
    "next/link":{__esModule:true,default:"a"},
  })("app/membros/page.tsx").default;
  const html=renderToStaticMarkup(await page());
  assert.match(html,/href="\/membros\/oportunidades"/);
  assert.match(html,/href="\/membros\/beneficios"/);
  assert.match(html,/href="\/membros\/assinatura"/);
  assert.doesNotMatch(html,/href="\/membros\/(?:trilha|ferramentas)"/);
  assert.match(html,/Conversas da comunidade/);
  assert.match(html,/Radar completo ativo/);
});

test("visitantes continuam redirecionados e não recebem os dados completos do Radar", async () => {
  const [proxy, memberPage, access] = await Promise.all([
    source("proxy.ts"),
    source("app/membros/oportunidades/page.tsx"),
    source("lib/opportunities/access.ts"),
  ]);

  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*", "\/admin", "\/admin\/:path\*"\]/);
  assert.match(proxy, /login\.searchParams\.set\("next", pathname \+ search \+ anchor\)/);
  assert.match(memberPage, /await requireSignedInMember\(memberRadarPath\(params\)\)/);
  assert.match(access, /await requireSignedInMember\("\/membros\/oportunidades"\)/);
});
