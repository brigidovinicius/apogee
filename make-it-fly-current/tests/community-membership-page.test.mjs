import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
function pageFor(status, options={}){
  return opportunityLoader({
    '@/lib/offer-preview':{localFunctionalReview:()=>false},
    '@/lib/members/dal':{requireSignedInMember:async()=>({id:'owner',name:'Pessoa Teste'})},
    '@/components/members/member-bar':{MemberBar:()=>null},
    '@/lib/billing/community-store':{communityMembership:async()=>({active:false,paidUntil:null,paymentStatus:status,
      subscription:{id:'sub_own',status:status==='unpaid'?'past_due':'active',cancelAtPeriodEnd:true},...options.membership})},
    '@/lib/billing/store':{radarAccess:async()=>({active:false,source:null})},
    '@/lib/billing/community-config':{communityBillingEnabled:()=>options.enabled ?? true,COMMUNITY_ACCESS_PATH:'/membros/assinatura'},
    'next/navigation':{useRouter:()=>({refresh:()=>{}})},
    'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  })('app/membros/assinatura/page.tsx').default;
}
test('refunded annual membership explains lost entitlement without calling it an in-progress payment or starting a new charge',async()=>{
  const html=renderToStaticMarkup(await pageFor('refunded')({searchParams:Promise.resolve({})}));
  assert.match(html,/reembolsada integralmente/);assert.match(html,/acessos antigos válidos ao Radar continuam preservados/);
  assert.doesNotMatch(html,/Há uma assinatura ou pagamento em andamento|action="\/api\/comunidade\/assinatura\/checkout|Assinatura ativa/);
});
test('failed renewal shows a pending annual payment without extending or selling another subscription',async()=>{
  const html=renderToStaticMarkup(await pageFor('unpaid')({searchParams:Promise.resolve({})}));
  assert.match(html,/pagamento anual está pendente/);assert.match(html,/renovação não paga não estende o acesso/);
  assert.doesNotMatch(html,/action="\/api\/comunidade\/assinatura\/checkout|Assinatura ativa|reembolsada/);
});

test('checkout return alone waits for server confirmation and never grants access or offers another charge',async()=>{
  const page=pageFor(null,{membership:{subscription:null}});
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({payment:'received',next:'/membros/ferramentas'})}));
  assert.match(html,/aguardando a confirmação do pagamento/);
  assert.doesNotMatch(html,/Assinatura ativa|Pagamento confirmado|action="\/api\/comunidade\/assinatura\/checkout|href="\/membros\/ferramentas"/);
});

test('server-confirmed payment exposes the original destination and stops waiting',async()=>{
  const page=pageFor('paid',{membership:{active:true,paidUntil:'2027-11-16T12:00:00Z'}});
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({payment:'received',next:'/membros/ferramentas'})}));
  assert.match(html,/Pagamento confirmado/);assert.match(html,/href="\/membros\/ferramentas"/);
  assert.doesNotMatch(html,/aguardando a confirmação|action="\/api\/comunidade\/assinatura\/checkout/);
});

for(const status of ['refunded','disputed','fraud','unpaid']) test(`checkout return cannot hide ${status} behind a waiting message`,async()=>{
  const html=renderToStaticMarkup(await pageFor(status)({searchParams:Promise.resolve({payment:'received'})}));
  assert.doesNotMatch(html,/aguardando a confirmação|Pagamento confirmado|action="\/api\/comunidade\/assinatura\/checkout/);
});

test('new checkout remains gated by commercial switch',async()=>{
  for(const options of [{enabled:false},{}]) {
    const page=pageFor(null,{...options,membership:{subscription:null}});
    const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({next:'/membros/ferramentas'})}));
    assert.equal(html.includes('action="/api/comunidade/assinatura/checkout?next=%2Fmembros%2Fferramentas"'),options.enabled !== false);
  }
});
