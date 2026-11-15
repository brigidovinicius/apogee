import assert from 'node:assert/strict';
import test from 'node:test';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const load=opportunityLoader();
const {communityReturnPath}=load('lib/billing/community-navigation.ts');
test('annual journey preserves product context and strips unrelated, private or external destinations',()=>{
  for(const path of ['/membros','/membros/trilha','/membros/beneficios','/membros/ferramentas','/membros/ferramentas?categoria=video','/membros/oportunidades/event-1']) assert.equal(communityReturnPath(path),path);
  assert.equal(communityReturnPath('/membros/ferramentas?categoria=video&token=private&email=private'),'/membros/ferramentas?categoria=video');
  for(const path of ['https://evil.test/membros/trilha','//evil.test/membros/trilha','/membros\\@evil.test','/membros/trilha?token=secret','/admin','/membros/assinatura','/membros/trilha\n']) assert.equal(communityReturnPath(path),'/membros/oportunidades',path);
});
test('functional and Stripe review use real public forms, production never exposes local studies',()=>{
  const saved={...process.env};
  try {
    Object.assign(process.env,{NODE_ENV:'development',APOGEE_LOCAL_PREVIEW:'1',APOGEE_FUNCTIONAL_REVIEW:'1',STRIPE_MODE:'test',DATABASE_URL:'postgres://synthetic@127.0.0.1:9999/own'});
    const guards=load('lib/offer-preview.ts');
    assert.equal(guards.localStaticOfferPreview(),false);assert.equal(guards.localOfferPreview(),true);
    process.env.APOGEE_FUNCTIONAL_REVIEW='0';process.env.APOGEE_STRIPE_SANDBOX_REVIEW='1';process.env.STRIPE_SECRET_KEY='sk_test_Synthetic';assert.equal(guards.localStaticOfferPreview(),false);
    process.env.NODE_ENV='production';assert.equal(guards.localStaticOfferPreview(),false);assert.equal(guards.localFunctionalReview(),false);
  } finally { for(const k of Object.keys(process.env)) if(!(k in saved))delete process.env[k];Object.assign(process.env,saved); }
});
