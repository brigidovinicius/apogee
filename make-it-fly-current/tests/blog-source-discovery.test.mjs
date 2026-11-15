import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('source discovery panel distinguishes pending source and media rights without fetching or importing images',()=>{
  const {SourceDiscoveryDetails}=opportunityLoader()('components/blog/source-discovery.tsx');
  const discovery={registered:[{url:'https://www.nasa.gov/news-release/synthetic/',name:'NASA',publisher:'nasa',kind:'primary'}],unregistered:[{url:'https://example.org/research/',host:'example.org'}],images:[{url:'https://www.nasa.gov/images/synthetic.jpg',source_url:'https://www.nasa.gov/news-release/synthetic/',alt:'Synthetic photo',credit:'Synthetic credit <script>bad()</script>',license_url:'https://www.nasa.gov/license/synthetic/',rights_status:'review_required'}]};
  const html=renderToStaticMarkup(React.createElement(SourceDiscoveryDetails,{discovery,className:'details'}));
  assert.ok(html.includes('Referência primária cadastrada'));
  assert.ok(html.includes('não foram acessados nem aprovados automaticamente'));
  assert.ok(html.includes('direito de uso pendente'));
  assert.ok(html.includes('Crédito declarado: Synthetic credit &lt;script&gt;'));
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  const unsafe=renderToStaticMarkup(React.createElement(SourceDiscoveryDetails,{discovery:{...discovery,registered:[{...discovery.registered[0],url:'javascript:alert(1)'}],unregistered:[],images:[]}}));
  assert.ok(!unsafe.includes('href="javascript:'));
});
