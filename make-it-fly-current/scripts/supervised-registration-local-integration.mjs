// Isolated fictional accounts, real local PostgreSQL. No mail or external provider.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {opportunityLoader} from '../tests/helpers/load-opportunity-module.mjs';
const config=JSON.parse(await readFile(new URL((process.argv.includes('--completion')?'../../.local/radar-completion-calendar/config.json':'../../.local/radar-calendar/config.json'),import.meta.url),'utf8'));
const url=new URL(config.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,process.argv.includes('--completion')?'48931':'48763');assert.equal(url.pathname,'/apogee_radar_calendar_local');
const sql=postgres(url.href,{ssl:false,max:3,prepare:false});const prefix='protection-qa-'+randomBytes(6).toString('hex');
const ids=['guardian','other','admin'].map(s=>prefix+'-'+s),[guardian,other,admin]=ids;let checks=0;
const check=(condition)=>{assert.ok(condition);checks++;};
const previous=process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';
const priorCutoff=process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE;delete process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE;
const protection=opportunityLoader({'./db':{getSql:()=>sql}})('lib/members/protection.ts');
try {
  assert.equal((await sql`select marker from radar_local_environment`)[0].marker,'apogee-radar-calendar-local-v1');
  for(const id of ids)await sql`insert into "user"(id,name,email,email_verified,username,role) values (${id},'QA ficticio',${id+'@radar.test'},${id!==guardian},${id.replaceAll('-','_')},${id===admin?'admin':'member'})`;
  check(!(await protection.adultAccess(guardian)));
  await sql`update "user" set created_at=now()-interval '1 day' where id=${guardian}`;
  process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE=new Date(Date.now()-12*3600000).toISOString();
  check(await protection.adultAccess(guardian));
  check(!(await protection.calendarAdultAccess(guardian)));
  check(!(await protection.adultAccess(other)));
  delete process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE;
  await assert.rejects(protection.requestAdultReview(guardian,true));checks++;
  await sql`update "user" set email_verified=true where id=${guardian}`;
  await assert.rejects(protection.requestAdultReview(guardian,false));checks++;
  await protection.requestAdultReview(guardian,true);
  check(!(await protection.adultAccess(guardian)));
  const child={nickname:'QA dependente ficticio',ageBand:'under_12',relationship:'parent',consent:true};
  await assert.rejects(protection.requestDependent(guardian,child));checks++;
  await assert.rejects(protection.reviewProtection(other,'adult',guardian,true,'QA ficticia - caso 01',true));checks++;
  await assert.rejects(protection.reviewProtection(admin,'adult',guardian,true,'QA ficticia - caso 01',false));checks++;
  await protection.reviewProtection(admin,'adult',guardian,true,'QA ficticia - caso 01',true);
  check(await protection.adultAccess(guardian));
  check(await protection.calendarAdultAccess(guardian));
  // Hold the real review revocation open while authorization waits on its lock.
  let releaseReview,reviewLocked,checking;
  const reviewReady=new Promise(resolve=>{reviewLocked=resolve;});
  const release=new Promise(resolve=>{releaseReview=resolve;});
  const checkStarted=new Promise(resolve=>{checking=resolve;});
  const review=sql.begin(async tx=>{
    await tx`select id from "user" where id=${guardian} for update`;
    await tx`update member_adult_review set status='rejected' where user_id=${guardian}`;
    reviewLocked();await release;
  });
  await reviewReady;
  const authorization=sql.begin(async tx=>{
    const [{pid}]=await tx`select pg_backend_pid() as pid`;checking(pid);
    return protection.calendarAdultAccess(guardian,tx);
  });
  const pid=await checkStarted;let waiting=false;
  try {
    for(let attempt=0;attempt<100;attempt++) {
      const [activity]=await sql`select wait_event_type from pg_stat_activity where pid=${pid}`;
      if(activity?.wait_event_type==='Lock'){waiting=true;break;}
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    check(waiting);
  }finally{releaseReview();}
  await review;check(!(await authorization));
  await protection.reviewProtection(admin,'adult',guardian,true,'QA ficticia - apos concorrencia',true);
  const childId=await protection.requestDependent(guardian,child);
  const row=(await sql`select * from member_dependent where id=${childId}`)[0];
  check(row.status==='pending'&&row.consent_version===protection.PROTECTION_POLICY_VERSION);
  check(!(await sql`select 1 from "user" where id=${childId}`).length);
  await assert.rejects(protection.revokeDependent(other,childId));checks++;
  await assert.rejects(protection.reviewProtection(guardian,'dependent',childId,true,'QA ficticia - caso 02',true));checks++;
  await protection.reviewProtection(admin,'dependent',childId,true,'QA ficticia - caso 02',true);
  check((await protection.protectionOverview(guardian)).dependents[0].status==='approved');
  check((await protection.protectionOverview(other)).dependents.length===0);
  await protection.revokeDependent(guardian,childId);
  check((await protection.protectionOverview(guardian)).dependents[0].status==='revoked');
  await assert.rejects(protection.reviewProtection(admin,'dependent',childId,true,'QA ficticia - caso 03',true));checks++;
  const second=await protection.requestDependent(guardian,{...child,ageBand:'12_15'});
  await protection.reviewProtection(admin,'adult',guardian,false,'QA ficticia - caso 04',true);
  check(!(await protection.adultAccess(guardian)));
  check(!(await protection.calendarAdultAccess(guardian)));
  process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE=new Date(Date.now()-12*3600000).toISOString();
  await protection.requestAdultReview(guardian,true);
  check(!(await protection.adultAccess(guardian)));
  delete process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE;
  check((await sql`select status from member_dependent where id=${second}`)[0].status==='revoked');
  const audits=await sql`select action from member_protection_audit where actor_id=any(${ids})`;
  check(audits.some(r=>r.action==='dependent_consent_revoked')&&audits.some(r=>r.action==='adult_approved'));
  await assert.rejects(sql`update member_dependent set status='approved',reviewed_at=null,evidence_reference=null where id=${second}`);checks++;
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='false';
  await assert.rejects(protection.requestDependent(guardian,child));checks++;
  console.log('OK: '+checks+' real local checks; verified-adult gating, human review, private dependent scope, consent, cross-account isolation, revocation and audit.');
}finally {
  await sql`delete from member_protection_audit where actor_id=any(${ids})`;
  await sql`delete from "user" where id=any(${ids})`;
  await sql.end();if(previous===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=previous;
  if(priorCutoff===undefined)delete process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE;else process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE=priorCutoff;
}
