import test from 'node:test';
import assert from 'node:assert/strict';
import {FOCUSED_EDITORIAL_PLAN,focusPool,topicAvailable,baselinePostIds,dailyDraftCap,focusProgress} from '../../make-it-fly-current/lib/blog/editorial-plan.mjs';
import {balancedResearchCandidates} from '../src/automatic-research.mjs';
const at=new Date('2026-11-15T20:00:00Z');
const policy={editorial_focus:FOCUSED_EDITORIAL_PLAN,new_drafts_per_day_cap:10};
const tech={category:'tecnologia',subcategory:'software-ferramentas'},ai={category:'tecnologia',subcategory:'ia'},business={category:'negocios',subcategory:null};
test('IA is a separate allocation; general, software and hardware share Technology',()=>{
  assert.equal(focusPool(ai),'ia');assert.equal(focusPool(tech),'tecnologia');assert.equal(focusPool({category:'tecnologia',subcategory:null}),'tecnologia');assert.equal(focusPool(business),'negocios');assert.equal(focusPool({category:'ciencia',subcategory:'aeroespacial'}),null);
  const used=[{...tech,day:2,week:2},{category:'tecnologia',subcategory:'hardware-robotica',day:2,week:2},{...ai,day:2,week:2}];
  assert.equal(topicAvailable(policy,used,tech,at),false);assert.equal(topicAvailable(policy,used,ai,at),true);
  assert.equal(topicAvailable(policy,[...used,{...ai,day:1,week:1}],ai,at),false);
  assert.equal(topicAvailable(policy,[],{category:'ciencia',subcategory:null},at),false);
});
test('weekly group allowance cannot be bypassed through a different subcategory',()=>{
  assert.equal(topicAvailable(policy,[{...tech,day:0,week:28}],{category:'tecnologia',subcategory:'hardware-robotica'},at),false);
  assert.equal(topicAvailable(policy,[{...business,day:0,week:21}],{category:'negocios',subcategory:'marketing'},at),false);
});
test('extra ten exclude only identified baseline progress, never weekly usage, and expire in Brasilia',()=>{
  const baseline=Array.from({length:10},(_,i)=>41+i),p={...policy,google_daily_completion:{day:'2026-11-15',extra_drafts:10,baseline_post_ids:baseline}};
  const used=[{...tech,day:3,baseline_day:3,week:3},{...ai,day:1,baseline_day:1,week:1},{...business,day:3,baseline_day:3,week:3}];
  assert.equal(dailyDraftCap(p,at),20);assert.deepEqual(baselinePostIds(p,at),baseline);
  assert.equal(topicAvailable(p,used,business,at),true);
  assert.equal(topicAvailable(p,[{...business,day:6,baseline_day:3,week:6}],business,at),false);
  assert.equal(topicAvailable(p,[{...business,day:3,baseline_day:3,week:21}],business,at),false);
  assert.equal(dailyDraftCap(p,new Date('2026-11-16T02:59:59Z')),20);
  assert.equal(dailyDraftCap(p,new Date('2026-11-16T03:00:00Z')),10);
  assert.deepEqual(baselinePostIds(p,new Date('2026-11-16T03:00:00Z')),[]);
  assert.equal(topicAvailable(p,used,business,new Date('2026-11-16T03:00:00Z')),false);
});
test('legacy topics retain the one-per-topic behavior without focus enabled',()=>{
  assert.equal(topicAvailable(null,[{...tech,day:1,week:1}],tech,at),false);
  assert.equal(topicAvailable(null,[],{category:'ciencia',subcategory:null},at),true);
});
test('focused research does not relabel AI into the general Technology slot',()=>{
  const row=(id,topic)=>({id,title:'Synthetic editorial subject',evidence:[],artifact:{research:{topic}}});
  const plan=balancedResearchCandidates([row('ai',ai),row('tech',tech),row('science',{category:'ciencia',subcategory:null})],[],30,policy,at);
  assert.equal(plan.length,2);assert.equal(plan.filter(p=>p.candidate.id==='ai').length,1);
  assert.deepEqual(plan.find(p=>p.candidate.id==='ai').topic,ai);
  const fullAi=balancedResearchCandidates([row('ai',ai),row('tech',tech)],[{...ai,day:3,week:3}],30,policy,at);
  assert.deepEqual(fullAi.map(p=>p.candidate.id),['tech']);
});
test('dashboard extra-batch totals retain raw production but display four/three/three once',()=>{
  const snapshot={editorial_focus:FOCUSED_EDITORIAL_PLAN,extra_batch:{day:'2026-11-15',extra_drafts:10,baseline_post_ids:Array.from({length:10},(_,i)=>i+41)}};
  const rows=[{...tech,drafts:7,complete:7,news:4,explainers:3,baseline_drafts:3,baseline_complete:3,baseline_explainers:3},{...ai,drafts:4,complete:4,news:3,explainers:1,baseline_drafts:1,baseline_complete:1,baseline_explainers:1},{...business,drafts:6,complete:6,news:3,explainers:3,baseline_drafts:3,baseline_complete:3,baseline_explainers:3}];
  const before=JSON.stringify(rows),progress=focusProgress(rows,snapshot,at);
  assert.deepEqual(progress.map(r=>[r.key,r.target,r.drafts,r.complete]),[['tecnologia',4,4,4],['ia',3,3,3],['negocios',3,3,3]]);
  assert.equal(progress.reduce((n,r)=>n+r.news,0),10);assert.equal(progress.reduce((n,r)=>n+r.explainers,0),0);assert.equal(JSON.stringify(rows),before);
  assert.equal(focusProgress(rows,snapshot,new Date('2026-11-16T03:00:00Z')).reduce((n,r)=>n+r.drafts,0),17,'expired baseline is never subtracted');
});
