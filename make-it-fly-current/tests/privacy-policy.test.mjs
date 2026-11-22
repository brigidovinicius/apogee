import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
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
    process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-08.1';
    const previousPolicy=renderToStaticMarkup(page.default());
    assert.match(previousPolicy,/Versão 2026-11-08.1/);
    assert.match(previousPolicy,/Para a medição de uso, guardamos/);
    assert.doesNotMatch(previousPolicy,/radar-amplitude/);
    assert.equal(page.generateMetadata().robots.index,true);

    process.env.APOGEE_LOCAL_PREVIEW='1';
    const preview=renderToStaticMarkup(page.default());
    assert.match(preview,/Versão 2026-11-22.1/);
    assert.match(preview,/id="radar-amplitude"/);
    assert.equal(page.generateMetadata().robots.index,false);

    delete process.env.APOGEE_LOCAL_PREVIEW;
    process.env.APOGEE_PRIVACY_APPROVED_VERSION='2026-11-22.1';
    const nextPolicy=renderToStaticMarkup(page.default());
    assert.match(nextPolicy,/Versão 2026-11-22.1/);
    assert.match(nextPolicy,/Para a medição agregada de uso do site e do Radar, guardamos/);
    assert.match(nextPolicy,/id="dados".*href="#radar-amplitude".*id="finalidades"/);
    assert.match(nextPolicy,/id="retencao".*href="#radar-amplitude".*id="direitos"/);
    assert.match(nextPolicy,/id="radar-amplitude".*<strong>três meses<\/strong>.*href="mailto:contato@apogee.community"/);
    assert.equal(page.generateMetadata().robots.index,true);
  }finally{if(previous===undefined)delete process.env.APOGEE_LOCAL_PREVIEW;else process.env.APOGEE_LOCAL_PREVIEW=previous;if(enabled===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=enabled;if(approved===undefined)delete process.env.APOGEE_PRIVACY_APPROVED_VERSION;else process.env.APOGEE_PRIVACY_APPROVED_VERSION=approved;}
});

test('behavior notice explains opt-in aggregates, browser refusal and historical data separately',()=>{
  const content=opportunityLoader()("lib/privacy-policy.ts").privacySections.flatMap(section=>section.paragraphs).join(" ");
  assert.match(content,/Se você permitir a medição de uso/);
  assert.match(content,/sem nome, e-mail, conteúdo digitado, termos buscados/);
  assert.match(content,/Não associamos as novas contagens/);
  assert.match(content,/Global Privacy Control/);
  assert.match(content,/Registros eventualmente mantidos pelo modelo anterior/);
});
