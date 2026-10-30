import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('unconfirmed privacy policy cannot be published in production or indexed',()=>{
  const load=opportunityLoader({'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}}});
  const page=load('app/privacidade/page.tsx');
  const previous=process.env.APOGEE_LOCAL_PREVIEW;delete process.env.APOGEE_LOCAL_PREVIEW;
  try {
    assert.throws(()=>page.default(),/NOT_FOUND/);
    assert.equal(page.generateMetadata().robots.index,false);
    process.env.APOGEE_LOCAL_PREVIEW='1';assert.ok(page.default());
  }finally{if(previous===undefined)delete process.env.APOGEE_LOCAL_PREVIEW;else process.env.APOGEE_LOCAL_PREVIEW=previous;}
});
