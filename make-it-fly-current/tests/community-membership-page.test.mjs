import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
function pageFor(status){
  return opportunityLoader({
    '@/lib/offer-preview':{localFunctionalReview:()=>false},
    '@/lib/members/dal':{requireSignedInMember:async()=>({id:'owner',name:'Pessoa Teste'})},
    '@/lib/members/protection':{adultAccess:async()=>true},
    '@/components/members/member-bar':{MemberBar:()=>null},
    '@/lib/billing/community-store':{communityMembership:async()=>({active:false,paidUntil:null,paymentStatus:status,
      subscription:{id:'sub_own',status:status==='unpaid'?'past_due':'active',cancelAtPeriodEnd:true}})},
    '@/lib/billing/store':{radarAccess:async()=>({active:false,source:null})},
    '@/lib/billing/community-config':{communityBillingEnabled:()=>true,COMMUNITY_ACCESS_PATH:'/membros/assinatura'},
    'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  })('app/membros/assinatura/page.tsx').default;
}
test('refunded annual membership explains lost entitlement without calling it an in-progress payment or starting a new charge',async()=>{
  const html=renderToStaticMarkup(await pageFor('refunded')({searchParams:Promise.resolve({})}));
  assert.match(html,/reembolsada integralmente/);assert.match(html,/acessos antigos válidos ao Radar continuam preservados/);
  assert.doesNotMatch(html,/Há uma assinatura ou pagamento em andamento|Continuar para assinatura anual|Assinatura ativa/);
});
test('failed renewal shows a pending annual payment without extending or selling another subscription',async()=>{
  const html=renderToStaticMarkup(await pageFor('unpaid')({searchParams:Promise.resolve({})}));
  assert.match(html,/pagamento anual está pendente/);assert.match(html,/renovação não paga não estende o acesso/);
  assert.doesNotMatch(html,/Continuar para assinatura anual|Assinatura ativa|reembolsada/);
});
