import test from 'node:test';
import assert from 'node:assert/strict';
import {assessDossier,approvedEvidence,dossierHash,validateDossier,validateComparison,referenceCatalog,referenceUrl,buildComparisonRequest} from '../src/corroboration.mjs';
import {defaultPolicy} from './fixtures.mjs';

import {dossierFixture} from './corroboration-fixture.mjs';
test('44 references preserve exact duplicates as aliases and share publishers across sections',()=>{
  const supplied=referenceCatalog.filter(r=>r.id.startsWith('REF'));assert.equal(supplied.length,44);assert.equal(supplied.reduce((n,r)=>n+r.aliases.length,0),46);
  assert.equal(referenceCatalog.filter(r=>r.publisher==='quanta-magazine').length,3);
  assert.ok(referenceCatalog.every(r=>r.collection_enabled===false));
});
test('90 percent is exact, 8/9 fails without rounded comparison, and empty is incomplete',()=>{
  const a=assessDossier(dossierFixture(10,9),{comparisonVerified:true});assert.equal(a.percentage,90);assert.equal(a.eligible,true);
  const b=assessDossier(dossierFixture(9,8),{comparisonVerified:true});assert.equal(b.eligible,false);assert.ok(b.blockers.includes('compatibility_below_90'));
  const empty=assessDossier(dossierFixture(0),{comparisonVerified:true});assert.equal(empty.percentage,null);assert.equal(empty.eligible,false);
});
test('critical conflict blocks even 90 percent and majority/repeated origin never confirms independence',()=>{
  const d=dossierFixture();d.claims[0].cells[1].status='contradicts';const a=assessDossier(d,{comparisonVerified:true});assert.equal(a.percentage,90);assert.ok(a.blockers.includes('critical_fact_unresolved'));
  d.claims[0].cells[1].status='supports';d.documents[1].origin_url=d.documents[0].origin_url;
  const b=assessDossier(d,{comparisonVerified:true});assert.equal(b.origins,1);assert.equal(b.independent_analyses,0);assert.equal(b.eligible,false);
});
test('verification is bound to the immutable dossier hash and pending facts are excluded from generation',()=>{
  const d=dossierFixture(10,9);assert.equal(assessDossier(d).eligible,false);
  const review={actor_id:'editor-test',hash:dossierHash(d)};
  const evidence=approvedEvidence(d,review);assert.ok(evidence.every(e=>!e.claim_ids.includes('C10')));
  d.claims[0].text+=' alteração';assert.throws(()=>approvedEvidence(d,review),/comparison_required/);
});
test('all matrix cells must exist and quotes must actually occur in a source',()=>{
  const d=dossierFixture();d.claims[0].cells.pop();assert.throws(()=>validateDossier(d),/invalid_claim/);
  const e=dossierFixture();e.claims[0].cells[0].quote='Uma citação inventada pelo modelo.';assert.throws(()=>validateDossier(e),/quote_not_in_document/);
  assert.throws(()=>validateComparison({claims:[] , extra:true},dossierFixture()),/invalid_comparison/);
});
test('same-event confirmation, document caps and official-domain allowlist are enforced',()=>{
  const d=dossierFixture();d.documents[0].same_event=false;assert.ok(assessDossier(d,{comparisonVerified:true}).blockers.includes('event_unverified'));
  const e=dossierFixture();e.documents=Array(11).fill(e.documents[0]);assert.throws(()=>validateDossier(e),/invalid_dossier/);
  for(const u of ['http://www.nasa.gov/','https://user:secret@www.nasa.gov/','https://127.0.0.1/','https://evil.test/'])assert.throws(()=>referenceUrl(u,referenceCatalog.find(r=>r.publisher==='nasa')));
});
test('one bounded Google comparison request contains originals, no silent truncation',()=>{
  const d=dossierFixture();const req=buildComparisonRequest(d,defaultPolicy);assert.equal(JSON.parse(req.input).documents.length,2);
  d.documents[0].text='Texto de evidência. '.repeat(500);d.documents[0].content_hash=dossierHash(d.documents[0].text.trim());d.documents[0].text=d.documents[0].text.trim();d.claims=[];
  assert.throws(()=>buildComparisonRequest(d,defaultPolicy),/input_limit/);
});
test('policy allows the authorized ten daily topics without raising token budgets or permitting overages',()=>{
  assert.equal(defaultPolicy.new_drafts_per_day_cap,10);assert.equal(defaultPolicy.new_drafts_per_week_cap,70);
  assert.equal(defaultPolicy.per_topic_daily_cap,1);assert.equal(defaultPolicy.google_daily_calls_cap,30);
  assert.equal(defaultPolicy.google_daily_tokens_cap,180000);assert.equal(defaultPolicy.google_weekly_tokens_cap,900000);
  assert.equal(defaultPolicy.google_use_g1_credits,false);
});

test('NASA science subdomain is explicitly registered, without authorizing arbitrary NASA subdomains',()=>{
  const nasa=referenceCatalog.find(r=>r.publisher==='nasa');
  assert.equal(referenceUrl('https://science.nasa.gov/test/',nasa),'https://science.nasa.gov/test/');
  assert.throws(()=>referenceUrl('https://unlisted.nasa.gov/test/',nasa),/invalid_reference_url/);
});

test('unknown publication dates stay null, and invalid calendar dates are rejected',()=>{
  const d=dossierFixture();d.documents[0].published_at=null;assert.equal(validateDossier(d).documents[0].published_at,null);
  d.documents[0].published_at='2026-02-30T12:00:00Z';assert.throws(()=>validateDossier(d),/invalid_dossier_document/);
});

test('an unverifiable comparison cell cannot become agreement because another source supports the claim',()=>{
  const d=dossierFixture();d.claims[0].cells[1]={document_id:'E2',status:'unverifiable',quote:'',note:'Escopo não verificável com o trecho disponível.'};
  const result=assessDossier(d,{comparisonVerified:true});assert.equal(result.claims[0].status,'pending');assert.equal(result.percentage,90);assert.equal(result.eligible,false);
  d.claims[0].cells[1].status='not_mentioned';assert.equal(assessDossier(d,{comparisonVerified:true}).claims[0].status,'pending');
  d.claims[0].cells[1].status='supports';d.claims[0].cells[1].quote='A equipe anunciou um experimento inicial.';assert.equal(assessDossier(d,{comparisonVerified:true}).claims[0].status,'convergent');
});
