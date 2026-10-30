import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluateGoogleRelease,launchEvidenceGates} from '../scripts/google-calendar-release-check.mjs';
const sha='a'.repeat(40),secret='SENSITIVE_SYNTHETIC_SECRET_ONLY';
function fixture() {
  return {candidateSha:sha,checkoutClean:true,
    env:{BETTER_AUTH_URL:'https://www.apogee.community',MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',APOGEE_PRIVACY_APPROVED_VERSION:'2026-10-30',APOGEE_TERMS_APPROVED_VERSION:'2026-10-30',RADAR_CALENDAR_PERSONAL_ENABLED:'true',RADAR_GOOGLE_CALENDAR_ENABLED:'true',GOOGLE_CLIENT_ID:'synthetic-client',GOOGLE_CLIENT_SECRET:secret,GOOGLE_CALENDAR_ENCRYPTION_KEY:'ab'.repeat(32),GOOGLE_CALENDAR_SYNC_SECRET:secret.repeat(2),MEMBERS_EMAIL_ENABLED:'true',MEMBERS_RESEND_DOMAIN_VERIFIED:'true',MEMBERS_RESEND_API_KEY:'re_synthetic_test_only',MEMBERS_RESEND_FROM:'contato@apogee.community',GOOGLE_CALENDAR_ALERT_WEBHOOK_URL:'https://example.invalid/'+secret},
    manifest:['0008_radar_calendar','0009_google_calendar','0010_supervised_registration','0011_google_calendar_retries'].map(tag=>({tag,sha256:'c'.repeat(64)})),
    evidence:{candidateSha:sha,gates:Object.fromEntries(launchEvidenceGates.map(id=>[id,{status:'recorded',reference:'FICTITIOUS_REF_ONLY',checkedAt:'2026-01-01T00:00:00Z'}]))}};
}
test('consistent synthetic config and declared references never authorize a release',()=>{
  const report=evaluateGoogleRelease(fixture());assert.equal(report.readyForHumanReview,true);assert.equal(report.releaseAuthorized,false);
  assert.ok(report.notice.includes('não foram verificadas automaticamente'));
});
test('missing defaults remain blocked instead of assuming real service readiness',()=>{
  const report=evaluateGoogleRelease();assert.equal(report.configurationReady,false);assert.equal(report.evidenceComplete,false);assert.equal(report.releaseAuthorized,false);
  assert.ok(report.evidenceChecks.every(item=>item.status==='pending'));
});
test('evidence is bound to exact candidate and clean checkout',()=>{
  const input=fixture();input.evidence.candidateSha='b'.repeat(40);assert.equal(evaluateGoogleRelease(input).evidenceComplete,false);
  input.evidence.candidateSha=sha;input.checkoutClean=false;assert.equal(evaluateGoogleRelease(input).readyForHumanReview,false);
});
test('partial OAuth overrides, wrong legal version, HTTP destination and invalid retry limits are rejected',()=>{
  for(const patch of [{GOOGLE_CALENDAR_CLIENT_ID:'override-only'},{APOGEE_TERMS_APPROVED_VERSION:'old'},{GOOGLE_CALENDAR_ALERT_WEBHOOK_URL:'http://127.0.0.1:1234'},{GOOGLE_CALENDAR_RETRY_BASE_SECONDS:'120',GOOGLE_CALENDAR_RETRY_MAX_SECONDS:'60'}]){
    const input=fixture();Object.assign(input.env,patch);assert.equal(evaluateGoogleRelease(input).configurationReady,false);
  }
});
test('future dates or empty references do not satisfy operational evidence',()=>{
  for(const patch of [{checkedAt:'2999-01-01T00:00:00Z'},{reference:''},{status:'pending'}]){
    const input=fixture();Object.assign(input.evidence.gates.guardianReviewProcess,patch);assert.equal(evaluateGoogleRelease(input).evidenceComplete,false);
  }
});
test('report cannot expose config values, private webhook or raw evidence references',()=>{
  const text=JSON.stringify(evaluateGoogleRelease(fixture()));assert.ok(!text.includes(secret));assert.ok(!text.includes('FICTITIOUS_REF_ONLY'));assert.ok(!text.includes('synthetic-client'));assert.ok(!text.includes('re_synthetic_test_only'));
});
test('read-only CLI evaluates real local files but exits pending without injected credentials',()=>{
  let result;
  try{execFileSync(process.execPath,['scripts/google-calendar-release-check.mjs','--evidence','../docs/google-calendar-launch-evidence.example.json'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{PATH:process.env.PATH},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.fail('Expected pending status');}
  catch(error){assert.equal(error.status,2);result=JSON.parse(error.stdout);}
  assert.equal(result.releaseAuthorized,false);assert.equal(result.mode,'local-read-only');assert.ok(result.manifest.some(item=>item.tag==='0011_google_calendar_retries'));
});
