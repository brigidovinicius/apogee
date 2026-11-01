import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('privacy requires explicit approval of the exact version as well as supervised registration',()=>{
  const load=opportunityLoader({'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}}});
  const page=load('app/privacidade/page.tsx');
  const previous=process.env.APOGEE_LOCAL_PREVIEW,enabled=process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED,approved=process.env.APOGEE_PRIVACY_APPROVED_VERSION;delete process.env.APOGEE_LOCAL_PREVIEW;delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;delete process.env.APOGEE_PRIVACY_APPROVED_VERSION;
  try {
    assert.throws(()=>page.default(),/NOT_FOUND/);
    assert.equal(page.generateMetadata().robots.index,false);
    process.env.APOGEE_LOCAL_PREVIEW='1';assert.ok(page.default());
    delete process.env.APOGEE_LOCAL_PREVIEW;process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';assert.throws(()=>page.default(),/NOT_FOUND/);
    process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-10-29';assert.throws(()=>page.default(),/NOT_FOUND/);
    process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-01.2';assert.ok(page.default());assert.equal(page.generateMetadata().robots.index,true);
    process.env.APOGEE_LOCAL_PREVIEW='1';assert.equal(page.generateMetadata().robots.index,false);
  }finally{if(previous===undefined)delete process.env.APOGEE_LOCAL_PREVIEW;else process.env.APOGEE_LOCAL_PREVIEW=previous;if(enabled===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=enabled;if(approved===undefined)delete process.env.APOGEE_PRIVACY_APPROVED_VERSION;else process.env.APOGEE_PRIVACY_APPROVED_VERSION=approved;}
});
