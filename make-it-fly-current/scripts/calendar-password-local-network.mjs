// Local-only email outbox for real browser registration/verification. Google OAuth stays real.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
assert.equal(process.env.APOGEE_LOCAL_PREVIEW,'1');
assert.equal(process.env.BETTER_AUTH_URL,'http://127.0.0.1:4381');
const db=new URL(process.env.DATABASE_URL);
assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'48941');assert.equal(db.pathname,'/apogee_radar_calendar_local');
assert.equal(process.env.MEMBERS_RESEND_API_KEY,'re_synthetic_calendar_password_only');
const outbox=new URL('../../.local/radar-collections-calendar/password-outbox.json',import.meta.url);
const original=globalThis.fetch;
let pending=Promise.resolve();
globalThis.fetch=async(input,options)=>{
 const target=new URL(input instanceof Request?input.url:input);
 if(target.origin!=='https://api.resend.com')return original(input,options);
 assert.equal(target.pathname,'/emails');assert.equal(options?.method,'POST');
 const message=JSON.parse(options.body);
 assert.ok(Array.isArray(message.to)&&message.to.length===1&&/^calendar-browser-[a-f0-9]+@radar\.test$/.test(message.to[0]),'Only the fictional password browser account can receive local QA messages');
 await (pending=pending.then(async()=>{
  let prior=[];try{prior=JSON.parse(await readFile(outbox,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  prior.push(message);await writeFile(outbox,JSON.stringify(prior),{mode:0o600});
 }));
 return Response.json({id:'synthetic-local-password-message'});
};
