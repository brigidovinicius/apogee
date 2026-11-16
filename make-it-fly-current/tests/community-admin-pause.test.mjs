import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('an operator can reconcile existing contracts during a sales pause, but incomplete configuration stays disabled',async()=>{
  const saved={...process.env};
  const load=opportunityLoader({
    '@/lib/billing/community-operations':{listAnnualMemberships:async()=>({livemode:false,page:1,pages:1,rows:[{id:'sub_Synthetic',username:'synthetic',status:'active',payment_status:'paid',cancel_at_period_end:true}]})},
    '@/components/admin/admin-ui':{AdminPageHeader:({title})=>createElement('h1',null,title)},
    './reconcile-form':{ReconcileForm:({enabled})=>createElement('button',{disabled:!enabled},'Conciliar com a Stripe')},
    'next/link':{__esModule:true,default:({children,href})=>createElement('a',{href},children)},
  });
  const Page=load('app/admin/assinaturas/page.tsx').default;
  const render=async()=>renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
  try{
    Object.assign(process.env,{COMMUNITY_BILLING_ENABLED:'false',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_COMMUNITY_PRODUCT_ID:'prod_Synthetic',STRIPE_COMMUNITY_ANNUAL_PRICE_ID:'price_Synthetic'});
    const paused=await render();assert.match(paused,/Novas assinaturas pausadas/);assert.match(paused,/contratos existentes continuam disponíveis/);assert.doesNotMatch(paused,/disabled=""|sk_test_synthetic/);
    process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID='';const incomplete=await render();assert.match(incomplete,/disabled=""/);assert.match(incomplete,/configuração do serviço estiver incompleta/);
  }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
