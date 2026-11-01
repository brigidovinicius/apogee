import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const keys=['APOGEE_LOCAL_PREVIEW','MEMBERS_SUPERVISED_REGISTRATION_ENABLED','APOGEE_PRIVACY_APPROVED_VERSION','APOGEE_TERMS_APPROVED_VERSION'];
async function scoped(fn){const prior=keys.map(k=>process.env[k]);for(const key of keys)delete process.env[key];try{await fn();}finally{keys.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i];});}}
const load=opportunityLoader({'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},'@/lib/blog/data':{listPublicPostUrls:async()=>[]},'@/lib/opportunities/radar-client':{listRadarOpportunities:async()=>[]},'@/lib/opportunities/discovery':{CALENDARS:[],publicOpportunityPath:()=>''}});
const page=load('app/termos/page.tsx');
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(' '):node?.props?text(node.props.children):'';

test('footer links follow legal-page availability and keep drafts accessible in the local preview',()=>scoped(()=>{
  const footer=load('components/site/site-footer.tsx').SiteFooter;
  const links=node=>Array.isArray(node)?node.flatMap(links):node?.props?[...(node.props.href?[node.props.href]:[]),...links(node.props.children)]:[];
  const has=path=>links(footer()).includes(path);
  assert.equal(has('/privacidade'),false);assert.equal(has('/termos'),false);
  process.env.APOGEE_LOCAL_PREVIEW='1';assert.equal(has('/privacidade'),true);assert.equal(has('/termos'),true);
  delete process.env.APOGEE_LOCAL_PREVIEW;
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-01.2';
  assert.equal(has('/privacidade'),true);assert.equal(has('/termos'),false);
  process.env.APOGEE_TERMS_APPROVED_VERSION='2026-11-01.2';assert.equal(has('/termos'),true);
}));

test('terms draft is local only and states that viewing is not acceptance or a contract change',()=>scoped(()=>{
  assert.throws(()=>page.default(),/NOT_FOUND/);process.env.APOGEE_LOCAL_PREVIEW='1';
  const content=text(page.default());assert.match(content,/Minuta para revisão/);assert.match(content,/não constitui aceite/);assert.match(content,/(?:não|nem) altera contratos existentes/);
  assert.match(content,/Versão\s+2026-11-01\.2/);
  assert.match(content,/contato@apogee.community/);assert.equal(page.generateMetadata().robots.index,false);
}));
test('publishing terms requires both exact document approvals and the actual protection flag',()=>scoped(()=>{
  process.env.APOGEE_TERMS_APPROVED_VERSION='2026-11-01.2';assert.throws(()=>page.default(),/NOT_FOUND/);
  process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-01.2';assert.throws(()=>page.default(),/NOT_FOUND/);
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';assert.ok(page.default());assert.equal(page.generateMetadata().robots.index,true);
  process.env.APOGEE_TERMS_APPROVED_VERSION='old-version';assert.throws(()=>page.default(),/NOT_FOUND/);
}));
test('sitemap omits drafts and local previews; only approved public documents are included',()=>scoped(async()=>{
  const sitemap=load('app/sitemap.ts').default;
  const urls=async()=>(await sitemap()).map(item=>item.url);
  assert.ok(!(await urls()).some(url=>/\/(termos|privacidade)$/.test(url)));
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-01.2';
  assert.ok((await urls()).includes('https://www.apogee.community/privacidade'));assert.ok(!(await urls()).includes('https://www.apogee.community/termos'));
  process.env.APOGEE_TERMS_APPROVED_VERSION='2026-11-01.2';assert.ok((await urls()).includes('https://www.apogee.community/termos'));
  process.env.APOGEE_LOCAL_PREVIEW='1';assert.ok(!(await urls()).some(url=>/\/(termos|privacidade)$/.test(url)));
}));
