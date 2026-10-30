import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('privacy page is published only with supervised registration enabled',()=>{
  const load=opportunityLoader({'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}}});
  const page=load('app/privacidade/page.tsx');
  const previous=process.env.APOGEE_LOCAL_PREVIEW,enabled=process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;delete process.env.APOGEE_LOCAL_PREVIEW;delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;
  try {
    assert.throws(()=>page.default(),/NOT_FOUND/);
    assert.equal(page.generateMetadata().robots.index,false);
    process.env.APOGEE_LOCAL_PREVIEW='1';assert.ok(page.default());
    delete process.env.APOGEE_LOCAL_PREVIEW;process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';assert.ok(page.default());assert.equal(page.generateMetadata().robots.index,true);
  }finally{if(previous===undefined)delete process.env.APOGEE_LOCAL_PREVIEW;else process.env.APOGEE_LOCAL_PREVIEW=previous;if(enabled===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=enabled;}
});
