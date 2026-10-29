import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

const {CatalogueForm}=opportunityLoader({'./actions':{saveRadarOpportunity:async()=>({error:''}),deleteRadarOpportunity:async()=>({error:''})}})('app/admin/radar/catalogue-form.tsx');
const item={id:'qa',title:'Vestibular',categories:['formacao'],opportunityStatus:'closed',deadlineAt:null,deadlinePrecision:'not_informed',evidence:{},discovery:{subtype:'vestibular',areas:[],editions:[{id:'2026',name:'2026',stages:[{id:'exam',name:'Prova',kind:'exam',start:'2026-11-10',sourceUrl:'https://example.edu.br/edital',checkedAt:'2026-10-28T12:00:00Z'}]}]}};
const render=patch=>renderToStaticMarkup(React.createElement(CatalogueForm,{item:{...item,...patch},sources:[]}));
test('closed vestibular and published results can retain an unknown enrollment deadline in the editor',()=>{
  for(const opportunityStatus of ['closed','result_published']) {
    const html=render({opportunityStatus});
    assert.match(html,/<option value="not_informed" selected="">/);
    assert.doesNotMatch(html,/name="deadlineInput"/);
    assert.match(html,/value="exam" selected=""/);
  }
});
test('future verified stages do not force a separate legacy event date after registration closes',()=>{
  const html=render({categories:['eventos']});
  const select=html.match(/<select[^>]*aria-describedby="event-start-help"[^>]*>/)[0];
  assert.doesNotMatch(select,/required/);
});
test('open opportunities keep the existing rule for unknown deadlines',()=>{
  const ordinary=render({opportunityStatus:'open'});
  assert.doesNotMatch(ordinary,/<option value="not_informed"/);
  const event=render({opportunityStatus:'open',categories:['eventos']});
  assert.match(event.match(/<select[^>]*aria-describedby="event-start-help"[^>]*>/)[0],/required/);
});
